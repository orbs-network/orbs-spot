import {
  isNativeAddress,
  isTxRejected,
  type AllowanceRequest,
  type ApprovalRequest,
  type CancelOrderRequest,
  type OrderSigningRequest,
  type CalculatedOrderForm,
  type Order,
  type SpotClient,
  type Token,
} from "@orbs-network/spot-ui";

/** App-owned wallet adapter. On-chain writes resolve only after successful receipts. */
export interface SpotWalletPort {
  getAllowance(request: AllowanceRequest): Promise<string>;
  wrapNativeToken(amountRaw: string, onSubmitted?: (hash: `0x${string}`) => void): Promise<`0x${string}`>;
  approveToken(request: ApprovalRequest, onSubmitted?: (hash: `0x${string}`) => void): Promise<`0x${string}`>;
  signOrder(request: OrderSigningRequest): Promise<`0x${string}`>;
  cancelOrder(request: CancelOrderRequest): Promise<`0x${string}`>;
  assertContext(account: string, chainId: number): Promise<void>;
}

export enum ExecutionPhase {
  IDLE = "idle",
  PREPARING = "preparing",
  WRAPPING = "wrapping",
  APPROVING = "approving",
  SIGNING = "signing",
  SUBMITTING = "submitting",
  SUCCESS = "success",
  FAILED = "failed",
  REJECTED = "rejected",
}
export enum ExecutionStatus {
  LOADING = 1,
  SUCCESS = 2,
  FAILED = 3,
}
export enum Steps {
  WRAP = "wrap",
  APPROVE = "approve",
  CREATE = "create",
}
export interface ParsedError {
  message: string;
  code?: number;
}
export interface ExecutionSnapshot {
  phase: ExecutionPhase;
  status?: ExecutionStatus;
  error?: ParsedError;
  failedPhase?: ExecutionPhase;
  currentStep?: Steps;
  currentStepIndex?: number;
  totalSteps?: number;
  inputToken?: Token;
  outputToken?: Token;
  chainId?: number;
  form?: CalculatedOrderForm;
  steps?: Steps[];
  wrapTxHash?: string;
  approvalTxHash?: string;
  order?: Order;
}

export interface SubmitOrderInput {
  client: SpotClient;
  wallet: SpotWalletPort;
  account: string;
  form: CalculatedOrderForm;
  inputToken: Token;
  outputToken: Token;
  wrappedNativeToken?: Token;
}

/** One executor per host order form. No React, providers, hooks, or wallet-library dependency. */
export function createOrderExecutor(
  onChange: (snapshot: ExecutionSnapshot) => void,
) {
  // Keep this lock outside UI state: two clicks can arrive before the next render.
  let busy = false;
  let snapshot: ExecutionSnapshot = { phase: ExecutionPhase.IDLE };
  const publish = (patch: Partial<ExecutionSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    onChange(snapshot);
  };
  const reset = () => {
    if (busy) return false;
    snapshot = { phase: ExecutionPhase.IDLE };
    onChange(snapshot);
    return true;
  };

  const submit = async (input: SubmitOrderInput): Promise<Order> => {
    if (busy) throw new Error("An order is already being submitted");
    busy = true;
    const {
      client,
      wallet,
      account,
      inputToken,
      outputToken,
      wrappedNativeToken,
    } = input;
    // Capture values before the first await, so edits cannot change an in-flight order.
    const form = structuredClone(input.form);
    const native = isNativeAddress(inputToken.address);
    const token = native ? wrappedNativeToken : inputToken;
    let submitting = false;
    snapshot = {
      phase: ExecutionPhase.PREPARING,
      status: ExecutionStatus.LOADING,
      form,
      inputToken,
      outputToken,
      chainId: client.chainId,
    };
    onChange(snapshot);
    try {
      if (!form.canSubmit || !token)
        throw new Error("Resolve the order inputs before submitting");
      await wallet.assertContext(account, client.chainId);
      // 1. Check allowance for the ERC-20 the order will sell. Native input
      // uses its wrapped token. SDK amounts are integer strings in base units.
      const amount = BigInt(form.values.inputAmount);
      const allowanceRequest = {
        tokenAddress: token.address,
        spenderAddress: client.spenderAddress,
      };
      const allowance = BigInt(await wallet.getAllowance(allowanceRequest));
      const approved = allowance >= amount;
      // Native input always spends native funds. A retry using an earlier
      // deposit must explicitly select the wrapped token in the form.
      const steps: Steps[] = [];
      if (native) steps.push(Steps.WRAP);
      if (!approved) steps.push(Steps.APPROVE);
      steps.push(Steps.CREATE);
      publish({
        totalSteps: steps.length,
        steps,
        currentStepIndex: 0,
      });
      // 2. Wrap only when the user selected native input.
      if (native) {
        await wallet.assertContext(account, client.chainId);
        publish({ phase: ExecutionPhase.WRAPPING, currentStep: Steps.WRAP });
        const txHash = await wallet.wrapNativeToken(amount.toString(), (wrapTxHash) => publish({ wrapTxHash }));
        publish({
          wrapTxHash: txHash,
          currentStepIndex: (snapshot.currentStepIndex ?? 0) + 1,
        });
      }
      // 3. Approve only when allowance is insufficient, then verify it.
      if (!approved) {
        await wallet.assertContext(account, client.chainId);
        publish({
          phase: ExecutionPhase.APPROVING,
          currentStep: Steps.APPROVE,
        });
        const txHash = await wallet.approveToken({
          ...allowanceRequest,
          amount: amount.toString(),
        }, (approvalTxHash) => publish({ approvalTxHash }));
        publish({ approvalTxHash: txHash });
        // Confirmation and RPC reads can briefly disagree. Reread a bounded
        // number of times; do not send another approval just because a read lags.
        let sufficient = false;
        for (let attempt = 0; attempt < 4; attempt++) {
          await wallet.assertContext(account, client.chainId);
          if (BigInt(await wallet.getAllowance(allowanceRequest)) >= amount) {
            sufficient = true;
            break;
          }
          if (attempt < 3)
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
        if (!sufficient)
          throw new Error(
            "Confirmed allowance is still below the order amount",
          );
        publish({ currentStepIndex: (snapshot.currentStepIndex ?? 0) + 1 });
      }
      await wallet.assertContext(account, client.chainId);
      // 4. The SDK prepares both the order and its signing request. Do this
      // after wallet transactions so the order's nonce and expiry are fresh.
      const prepared = client.prepareOrder({
        form,
        inputTokenAddress: token.address,
        outputTokenAddress: outputToken.address,
        swapperAddress: account,
      });
      publish({ phase: ExecutionPhase.SIGNING, currentStep: Steps.CREATE });
      const signature = await wallet.signOrder(prepared.signingRequest);
      publish({ phase: ExecutionPhase.SUBMITTING });
      await wallet.assertContext(account, client.chainId);
      submitting = true;
      // 5. Submit the same prepared order and signature. Recalculating here
      // would change the signed values and invalidate the signature.
      const order = await client.submitOrder(prepared.order, signature);
      publish({
        phase: ExecutionPhase.SUCCESS,
        status: ExecutionStatus.SUCCESS,
        order,
      });
      return order;
    } catch (error) {
      const rejected = !submitting && isTxRejected(error);
      const message = error instanceof Error ? error.message : String(error);
      // A lost HTTP response does not prove that submission failed on the server.
      // Surface that ambiguity so the caller checks history before resubmitting.
      const parsed = {
        message: submitting
          ? `${message}. Check order history before retrying; the order may have been accepted.`
          : message,
      };
      publish({
        failedPhase: snapshot.phase,
        phase: rejected ? ExecutionPhase.REJECTED : ExecutionPhase.FAILED,
        status: rejected ? undefined : ExecutionStatus.FAILED,
        error: rejected ? undefined : parsed,
      });
      throw error;
    } finally {
      busy = false;
    }
  };
  return { submit, reset, isBusy: () => busy };
}
