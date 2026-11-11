"use client";

import { confirmAllowance } from "@/lib/spot/allowance";
import { isQuoteWorse, MAX_QUOTE_AGE_MILLIS, toBestTradeQuote } from "@/lib/swap/quote-review";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isQuoteFresh, type Order, type PreparedSwap } from "@orbs-network/spot-ui";
import { OrderSettlementError, waitForOrder } from "@/lib/swap/settlement";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import BN from "bignumber.js";
import { CheckIcon } from "lucide-react";
import { type ReactElement, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createLoadingToast } from "@/lib/loading-toast";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";
import { erc20Abi } from "viem";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import { useBalance, useBalances } from "@/lib/hooks/use-balances";
import { useDataChainId } from "@/lib/hooks/use-data-chain-id";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useSettings } from "@/lib/hooks/use-settings";
import { useSignTypedDataPayload } from "@/lib/hooks/use-sign-typed-data";
import { useSpotSwapClient } from "@/lib/hooks/use-spot-swap-client";
import { useGetTokenAllowance } from "@/lib/hooks/use-token-allowance";
import { useApproveToken } from "@/lib/hooks/use-token-approval";
import { useWrapNativeToken } from "@/lib/hooks/use-wrap";
import { useBestTradeSwapStore, useSwapStore } from "@/lib/hooks/store";
import { acquireSwapExecutionLock } from "@/lib/swap/execution";
import { resolveSwapSettlementOrder, useSwapActivity } from "@/lib/swap/activity";
import { invalidateOrderQueries } from "@/lib/spot/queries";
import { MIN_SWAP_VALUE_USD, spotSwapQuoteQueryOptions } from "@/lib/swap/quotes";
import { SwapStatus, SwapStep, type BestTradeQuote } from "@/lib/types";
import { dismissTransactionRejectedToast, isUserRejectedError } from "@/lib/tx-rejection";
import { getWrappedNativeCurrency, isNativeAddress } from "@/lib/utils";
import { DEMO_SIGNATURE, type DeveloperExecutionMode } from "./demo-order";
import { DownloadIntegrationButton } from "./download-integration-button";
import { remainingWrapAmount, rewindFlow } from "./flow-navigation";
import { JsonInspectorPanel, type CodeSnippetOptions, type JsonContainer, type JsonValue } from "./json-inspector";
import { getLiveFlowPhaseIndex, LiveFlowNotice, type LiveFlowPhase } from "./live-flow-notice";
import { QuotePriceChangeDialog } from "./quote-price-change-dialog";
import { useQuoteInspectionData } from "./quote-inspection-data";
import { SpotSwapGuideLink } from "./spot-swap-guide-link";
import { formatSpotSwapSdkFlow } from "./snippets/sdk-flow-examples";
import {
  getSpotSwapFieldExplanation, SPOT_SWAP_ALLOWANCE_CODE_SNIPPET,
  SPOT_SWAP_APPROVAL_CODE_SNIPPET, SPOT_SWAP_FULL_FLOW_CODE_SNIPPET,
  SPOT_SWAP_SIGN_CODE_SNIPPET, SPOT_SWAP_SWAP_AND_CONFIRM_CODE_SNIPPET,
  SPOT_SWAP_WRAP_CODE_SNIPPET,
} from "./snippets/spot-swap-code-examples";

type SpotSwapFlowStep = "flow" | "check" | "wrap" | "approve" | "sign" | "swap" | "success";
type StepNavigation = { history: SpotSwapFlowStep[]; viewedIndex: number };
type StepPresentation = { codeSnippet: CodeSnippetOptions; data: JsonContainer; explanation: string; title: string };
type SpotSwapFlowPhase = LiveFlowPhase<SpotSwapFlowStep>;
type ExecutionSession = {
  controller: AbortController;
  contextKey: string;
  release: () => void;
};

const DEMO_SWAP_EXPLANATIONS: Record<SpotSwapFlowStep, string> = {
  flow: "Live quote, simulated execution. No wallet or gas required. The demo assumes enough tokens and gas. Downloaded integration code performs real actions if you run it.",
  check: "Simulated allowance: zero, so you can explore approval. Your wallet allowance is not read or changed.",
  wrap: "Simulated wrapping. No native tokens are deposited and no gas is spent.",
  approve: "Simulated token approval. No spending permission is granted and no transaction is sent.",
  sign: "The SDK prepares this swap locally from the live quote and its service minimum. The demo uses example signature bytes and does not open a wallet.",
  swap: "The prepared order and demo signature are shown below. No order is submitted and no settlement is requested.",
  success: "Local demo result. No swap was executed, no funds moved, and no order was created.",
};
const ALLOWANCE_PHASE: SpotSwapFlowPhase = { effect: "Read allowance", label: "Check token", step: "check" };
const WRAP_PHASE: SpotSwapFlowPhase = { effect: "Wallet transaction", label: "Wrap", step: "wrap" };
const APPROVE_PHASE: SpotSwapFlowPhase = { effect: "Wallet transaction", label: "Approve", step: "approve" };
const SIGN_PHASE: SpotSwapFlowPhase = { effect: "Review message + wallet signature", label: "Sign order", step: "sign" };
const SWAP_PHASE: SpotSwapFlowPhase = { effect: "Accepted order + completed fill", label: "Swap & confirm", step: "swap" };
const STEP_ACTION_LABELS: Record<SpotSwapFlowStep, string> = {
  flow: "Start", check: "Check allowance", wrap: "Wrap token", approve: "Approve token",
  sign: "Sign order", swap: "Swap & confirm", success: "Close",
};
const STEP_LOADING_MESSAGES: Record<Exclude<SpotSwapFlowStep, "success">, string> = {
  flow: "Starting the Spot swap flow…", check: "Checking the configured spender allowance…",
  wrap: "Waiting for the native token wrap transaction…", approve: "Waiting for token approval confirmation…",
  sign: "Waiting for the order signature…", swap: "Submitting the order and waiting for its completed fill…",
};
function toJsonContainer(value: unknown): JsonContainer | undefined {
  if (!value) return undefined;
  try { return JSON.parse(JSON.stringify(value)) as JsonContainer; } catch { return undefined; }
}
function asRecord(value: JsonValue | undefined): Record<string, JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The Spot swap step could not be completed.";
}
function getQuoteValueError(quote?: BestTradeQuote): string | undefined {
  const value = BN(quote?.originalQuote.inputAmountUsd ?? "");
  if (!value.isFinite() || !value.gt(0)) return "Quote USD value unavailable. Refresh the quote before continuing.";
  if (value.lt(MIN_SWAP_VALUE_USD)) return `Minimum swap is $${MIN_SWAP_VALUE_USD}.`;
}
function getPresentation({ data, step }: { data: JsonContainer; step: SpotSwapFlowStep }): StepPresentation {
  const snippets = {
    flow: SPOT_SWAP_FULL_FLOW_CODE_SNIPPET, check: SPOT_SWAP_ALLOWANCE_CODE_SNIPPET,
    wrap: SPOT_SWAP_WRAP_CODE_SNIPPET, approve: SPOT_SWAP_APPROVAL_CODE_SNIPPET,
    sign: SPOT_SWAP_SIGN_CODE_SNIPPET, swap: SPOT_SWAP_SWAP_AND_CONFIRM_CODE_SNIPPET,
    success: SPOT_SWAP_SWAP_AND_CONFIRM_CODE_SNIPPET,
  };
  const titles = {
    flow: "Spot TypeScript SDK swap flow", check: "Check token allowance", wrap: "Wrap native input",
    approve: "Approve the configured spender", sign: "Sign the prepared order", swap: "Submit and confirm the fill", success: "Swap completed",
  };
  const explanations = {
    flow: "Quote, wrap and approve when needed, prepare a swap from the reviewed quote and connected account, sign the original request, submit the order, and wait for a completed fill.",
    check: "Read the input token allowance for client.spenderAddress. Native input uses its wrapped ERC-20 token.",
    wrap: "Deposit the exact native input into its wrapped ERC-20 contract and wait for a successful receipt before continuing.",
    approve: "Approve the exact input amount for client.spenderAddress, confirm the transaction, and verify allowance with bounded retries.",
    sign: "await client.prepareSwap({ quote, account, signal }) refreshes stale quotes and signs prepared.quote.minimumAmountOut unchanged with a three-minute expiration. The connected account signs this original signingRequest unchanged. The quote itself contains no signing payload.",
    swap: "Submit the exact prepared order and original signature once. submitSwap returns an accepted order; host polling through client.getOrder confirms the completed fill.",
    success: "Host status polling returned a completed order. Its fills contain the actual settlement transaction hashes and amounts.",
  };
  return {
    codeSnippet: snippets[step],
    data: step === "sign" ? asRecord(asRecord(data).prepared) : data,
    explanation: explanations[step], title: titles[step],
  };
}
export function SpotSwapDeveloperContent({ trigger, mode }: { mode: DeveloperExecutionMode; trigger: ReactElement }) {
  const isDemo = mode === "demo";
  const flowToastId = useId();
  const flowToastDismissed = useRef(false);
  const actionToastId = useId();
  const dismissFlowToast = useCallback(() => {
    flowToastDismissed.current = true;
    toast.dismiss(flowToastId);
  }, [flowToastId]);
  const { address: account, isConnecting, isReconnecting } = useConnection();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const isWalletLoading = isConnecting || isReconnecting;
  const chainId = useDataChainId();
  const { openConnectModal } = useConnectModal();
  const { slippage } = useSettings();
  const { inputCurrency, inputAmount, isLoadingTrade, outputCurrency, parsedInputAmount, trade } = useDerivedSwap();
  const inputBalance = useBalance(inputCurrency).wei;
  const hasBalance = Boolean(account && BN(inputBalance ?? "0").gte(parsedInputAmount));
  const { data: client } = useSpotSwapClient();
  const { requestData } = useQuoteInspectionData();
  const queryClient = useQueryClient();
  const { setInputAmount } = useActionHandlers();
  const { refetch: refetchBalances } = useBalances();
  const { mutateAsync: signTypedData } = useSignTypedDataPayload();
  const { mutateAsync: wrapNativeToken } = useWrapNativeToken();
  const { mutateAsync: approveToken } = useApproveToken();
  const getAllowance = useGetTokenAllowance();
  const [open, setOpen] = useState(false);
  const [triggerTooltipOpen, setTriggerTooltipOpen] = useState(false);
  const [navigation, setNavigation] = useState<StepNavigation>({ history: ["flow"], viewedIndex: 0 });
  const [reviewedContextKey, setReviewedContextKey] = useState("");
  const [executionQuote, setExecutionQuote] = useState<BestTradeQuote>();
  const [priceChange, setPriceChange] = useState<{ previous: BestTradeQuote; next: BestTradeQuote }>();
  const [sourceIsNative, setSourceIsNative] = useState(false);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [prepared, setPrepared] = useState<PreparedSwap>();
  const [signature, setSignature] = useState<`0x${string}`>();
  const [acceptedOrder, setAcceptedOrder] = useState<Order>();
  const [completedOrder, setCompletedOrder] = useState<Order>();
  const [submissionUncertain, setSubmissionUncertain] = useState(false);
  const suppressTriggerTooltipRef = useRef(false);
  const wrappedCreditRef = useRef<{ key: string; amount: bigint } | undefined>(undefined);
  const acceptedOrderRef = useRef<Order | undefined>(undefined);
  const [reviewedQuote, setReviewedQuote] = useState<BestTradeQuote>();
  const sessionRef = useRef<ExecutionSession | undefined>(undefined);
  const executionInFlight = useRef(false);
  const submittedRef = useRef(false);
  const step = navigation.history.at(-1) ?? "flow";
  const viewedStep = navigation.history[navigation.viewedIndex] ?? step;
  const liveQuote = trade;
  const inputIsNative = isNativeAddress(inputCurrency?.address);
  const contextKey = [account?.toLowerCase(), chainId, client?.partner, inputCurrency?.address.toLowerCase(), outputCurrency?.address.toLowerCase(), parsedInputAmount, slippage].join(":");
  const stopSession = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    session.controller.abort(new Error("Swap flow stopped. Review before continuing."));
    void queryClient.cancelQueries({ queryKey: ["spot-swap-execution-quote"] });
    // Wallet prompts and a submission POST cannot be cancelled. Keep the shared
    // lock until this action returns, persisting any late accepted order first.
    if (executionInFlight.current) return;
    session.release();
    sessionRef.current = undefined;
    useSwapStore.getState().setPauseQuote(false);
  }, [queryClient]);

  // A session survives step changes; a different wallet or swap request ends it.
  useEffect(() => {
    if (sessionRef.current && sessionRef.current.contextKey !== contextKey) stopSession();
  }, [contextKey, stopSession]);
  useEffect(() => () => { stopSession(); toast.dismiss(flowToastId); }, [flowToastId, stopSession]);

  const quoteData = useMemo(() => toJsonContainer(executionQuote?.originalQuote ?? reviewedQuote?.originalQuote ?? liveQuote?.originalQuote) ?? {}, [executionQuote, reviewedQuote, liveQuote]);
  const integrationData = useMemo<JsonContainer>(() => ({
    ...asRecord(requestData), quote: asRecord(quoteData), demo: isDemo,
    userAddress: account ?? "<connected-account>",
    prepared: toJsonContainer(prepared) ?? {},
    execution: { signature: signature ?? "<wallet-signature>", order: toJsonContainer(completedOrder ?? acceptedOrder) ?? {} },
  }), [acceptedOrder, account, completedOrder, isDemo, prepared, quoteData, requestData, signature]);
  const liveFlowPhases = useMemo(() => {
    const visitedSteps = new Set(navigation.history);
    const phases: SpotSwapFlowPhase[] = [ALLOWANCE_PHASE];
    if (sourceIsNative || visitedSteps.has("wrap")) phases.push(WRAP_PHASE);
    if (visitedSteps.has("approve")) phases.push(APPROVE_PHASE);
    phases.push(SIGN_PHASE, SWAP_PHASE);
    return isDemo ? phases.map((phase) => ({ ...phase, effect: "Simulated" })) : phases;
  }, [isDemo, navigation.history, sourceIsNative]);
  const advanceToStep = useCallback((nextStep: SpotSwapFlowStep) => {
    setNavigation((current) => ({ history: [...current.history, nextStep], viewedIndex: current.history.length }));
  }, []);
  const returnToSigning = useCallback(() => {
    setSignature(undefined);
    setPrepared(undefined);
    setNavigation((current) => {
      const index = current.history.lastIndexOf("sign");
      return index >= 0 ? rewindFlow(current, index) : { history: [...current.history, "sign"], viewedIndex: current.history.length };
    });
  }, []);

  const { mutate: executeCurrentStep, isPending: isRunning } = useMutation({
    networkMode: isDemo ? "always" : "online", retry: false,
    mutationFn: async () => {
      if (executionInFlight.current || step === "success") return;
      executionInFlight.current = true;
      const loadingToast = createLoadingToast(actionToastId);
      loadingToast.show(isDemo ? "Simulating this step…" : STEP_LOADING_MESSAGES[step], { position: "bottom-right" });
      try {
        const selected = executionQuote ?? reviewedQuote ?? liveQuote;
        if (!selected || !BN(selected.inAmount).gt(0) || !BN(selected.outAmount).gt(0) || !client) {
          throw new Error("Enter a valid amount and wait for a live Spot quote and configuration.");
        }
        if (isDemo) {
          if (step === "flow") advanceToStep("check");
          else if (step === "check") { setApprovalRequired(true); advanceToStep(sourceIsNative ? "wrap" : "approve"); }
          else if (step === "wrap") advanceToStep("approve");
          else if (step === "approve") {
            const preview = await client.prepareSwap({ quote: selected.originalQuote, account: account ?? selected.originalQuote.request.user });
            setPrepared(preview);
            setExecutionQuote(toBestTradeQuote(preview.quote, selected.inToken));
            advanceToStep("sign");
          } else if (step === "sign") { setSignature(DEMO_SIGNATURE); advanceToStep("swap"); }
          else if (step === "swap") advanceToStep("success");
          toast.dismiss(actionToastId);
          return;
        }
        if (!account || !walletClient || !publicClient || publicClient.chain.id !== chainId) throw new Error("Connect a wallet to execute a real swap.");
        if (reviewedContextKey !== contextKey) throw new Error("Wallet or swap inputs changed. Close and reopen the flow to review a fresh quote.");
        const valueError = getQuoteValueError(selected);
        if (valueError) throw new Error(valueError);
        if (submissionUncertain && !acceptedOrder) throw new Error("Submission status is uncertain. Check order history before starting another swap.");
        if (step === "flow" && !hasBalance) throw new Error("Insufficient balance for this swap.");
        let session = sessionRef.current;
        if (!session) {
          const owner = {};
          const release = acquireSwapExecutionLock(owner);
          session = { controller: new AbortController(), contextKey, release };
          sessionRef.current = session;
          useSwapStore.getState().setPauseQuote(true);
          await queryClient.cancelQueries({ queryKey: ["spot-swap-quote"] });
        }
        const { signal } = session.controller;
        const request = selected.originalQuote.request;
        const assertContext = async () => {
          signal.throwIfAborted();
          if (sessionRef.current !== session || session.contextKey !== contextKey) throw new Error("Swap changed. Review the swap again.");
          const [addresses, connectedChain] = await Promise.all([walletClient.getAddresses(), walletClient.getChainId()]);
          signal.throwIfAborted();
          if (connectedChain !== chainId || addresses[0]?.toLowerCase() !== account.toLowerCase()) {
            throw new Error("Wallet account or network changed. Reopen the flow for a fresh quote.");
          }
        };
        await assertContext();
        if (request.chainId !== chainId || request.partner !== client.partner ||
            selected.inAmount !== request.inAmount || selected.outToken.toLowerCase() !== request.outToken.toLowerCase() ||
            selected.outAmount !== selected.originalQuote.netAmountOut || selected.minAmountOut !== selected.originalQuote.minimumAmountOut) {
          throw new Error("Quote does not match the reviewed swap. Request a new quote.");
        }
        const wrapKey = [chainId, account.toLowerCase(), request.inToken.toLowerCase(), request.inAmount].join(":");
        const getWrappedAmount = () => wrappedCreditRef.current?.key === wrapKey ? wrappedCreditRef.current.amount : BigInt(0);
        const readSpendBalance = () => publicClient.readContract({
          address: request.inToken as `0x${string}`, abi: erc20Abi, functionName: "balanceOf", args: [account],
        });
        const assertBalance = async (requireWrapped = false) => {
          await assertContext();
          const amount = BigInt(request.inAmount);
          const wrappedBalance = await readSpendBalance();
          if (sourceIsNative && getWrappedAmount() > BigInt(0) && wrappedBalance < getWrappedAmount()) wrappedCreditRef.current = undefined;
          const remaining = sourceIsNative ? remainingWrapAmount(amount, getWrappedAmount()) : amount;
          const sufficient = sourceIsNative && !requireWrapped
            ? (await publicClient.getBalance({ address: account })) >= remaining
            : wrappedBalance >= amount;
          await assertContext();
          if (!sufficient) throw new Error("Insufficient input balance for this swap.");
        };
        if (!acceptedOrder) await assertBalance(step === "sign" || step === "swap");
        const allowanceRequest = { tokenAddress: request.inToken, spenderAddress: client.spenderAddress, ownerAddress: account };
        const hasAllowance = async () => {
          await assertContext();
          const value = await getAllowance(allowanceRequest);
          signal.throwIfAborted();
          return BigInt(value) >= BigInt(request.inAmount);
        };
        const reviewQuote = (next: BestTradeQuote): boolean => {
          const valueError = getQuoteValueError(next);
          if (valueError) throw new Error(valueError);
          const reviewed = reviewedQuote ?? selected;
          if (isQuoteWorse(reviewed, next)) {
            returnToSigning();
            setPriceChange({ previous: reviewed, next });
            toast.dismiss(actionToastId);
            return false;
          }
          setExecutionQuote(next);
          return true;
        };
        const prepareForSigning = async (quote: BestTradeQuote) => {
          const valueError = getQuoteValueError(quote);
          if (valueError) throw new Error(valueError);
          const prepared = await client.prepareSwap({ quote: quote.originalQuote, account, signal });
          await assertContext();
          return reviewQuote(toBestTradeQuote(prepared.quote, quote.inToken)) ? prepared : undefined;
        };
        const refreshIfNeeded = async (): Promise<BestTradeQuote | undefined> => {
          if (isQuoteFresh(selected.originalQuote, MAX_QUOTE_AGE_MILLIS)) return selected;
          if (!inputCurrency || !outputCurrency) throw new Error("Select both swap tokens.");
          const options = spotSwapQuoteQueryOptions(client, account, inputCurrency, outputCurrency, request.inAmount, request.slippage, getWrappedNativeCurrency(chainId)?.address);
          const fresh = await queryClient.fetchQuery({ ...options, queryKey: ["spot-swap-execution-quote", ...options.queryKey], staleTime: 0, retry: false });
          await assertContext();
          if (!fresh) throw new Error("A fresh Spot quote is unavailable.");
          return reviewQuote(fresh) ? fresh : undefined;
        };
        const advanceToSigning = async () => {
          const quote = await refreshIfNeeded();
          if (!quote) return;
          const prepared = await prepareForSigning(quote);
          if (!prepared) return;
          setPrepared(prepared);
          advanceToStep("sign");
        };
        if (step === "flow") {
          setReviewedQuote((current) => current ?? structuredClone(selected));
          advanceToStep("check");
        } else if (step === "check") {
          const approved = await hasAllowance();
          setApprovalRequired(!approved);
          const needsWrap = sourceIsNative && remainingWrapAmount(BigInt(request.inAmount), getWrappedAmount()) > BigInt(0);
          if (needsWrap) advanceToStep("wrap");
          else if (!approved) advanceToStep("approve");
          else {
            await advanceToSigning();
          }
        } else if (step === "wrap") {
          const amount = remainingWrapAmount(BigInt(request.inAmount), getWrappedAmount());
          if (amount > BigInt(0)) {
            await assertContext();
            const { receipt } = await wrapNativeToken({ amount: amount.toString() });
            if (receipt.status !== "success") throw new Error("Native token wrapping reverted");
            wrappedCreditRef.current = { key: wrapKey, amount: getWrappedAmount() + amount };
            void refetchBalances().catch(() => undefined);
            await assertContext();
          }
          if (approvalRequired) advanceToStep("approve");
          else {
            await advanceToSigning();
          }
        } else if (step === "approve") {
          if (!(await hasAllowance())) {
            await assertContext();
            const { receipt } = await approveToken({ tokenAddress: request.inToken, spenderAddress: client.spenderAddress, amount: request.inAmount });
            if (receipt.status !== "success") throw new Error("Token approval reverted");
            await confirmAllowance(hasAllowance, {
              message: "Approval is not available. Check allowance before retrying.",
              attempts: 3, delayMillis: 1_000, signal,
            });
          }
          setApprovalRequired(false);
          await advanceToSigning();
        } else if (step === "sign") {
          const quote = await refreshIfNeeded();
          if (!quote) return;
          if (!(await hasAllowance())) { setApprovalRequired(true); advanceToStep("approve"); return; }
          await assertContext();
          // The inspector preview may have been open for a while. Prepare fresh
          // timestamps and nonce immediately before requesting the signature.
          const nextPrepared = await prepareForSigning(quote);
          if (!nextPrepared) return;
          setPrepared(nextPrepared);
          const { signerAddress, typedData } = nextPrepared.signingRequest;
          const originalSignature = await signTypedData({ ...typedData, message: { ...typedData.message }, account: signerAddress });
          await assertContext();
          if (!isQuoteFresh(nextPrepared.quote, MAX_QUOTE_AGE_MILLIS)) {
            returnToSigning();
            toast.info("Quote expired during signing. Review and sign again.", { id: actionToastId, duration: 3_000, position: "bottom-right" });
            return;
          }
          setSignature(originalSignature); advanceToStep("swap");
        } else if (step === "swap") {
          let order = acceptedOrder;
          if (!order) {
            if (!prepared || !signature || submittedRef.current) throw new Error("Sign the prepared order before submitting. Reconcile any previous submission in order history.");
            if (!isQuoteFresh(prepared.quote, MAX_QUOTE_AGE_MILLIS)) {
              returnToSigning();
              const quote = await refreshIfNeeded();
              if (quote) toast.info("Quote refreshed. Sign the prepared order again.", { id: actionToastId, duration: 3_000, position: "bottom-right" });
              return;
            }
            if (!(await hasAllowance())) { returnToSigning(); setApprovalRequired(true); advanceToStep("approve"); return; }
            await assertContext();
            await assertBalance(true);
            signal.throwIfAborted();
            if (!isQuoteFresh(prepared.quote, MAX_QUOTE_AGE_MILLIS)) {
              returnToSigning();
              await refreshIfNeeded();
              toast.dismiss(actionToastId);
              return;
            }
            submittedRef.current = true;
            setSubmissionUncertain(true);
            order = await client.submitSwap(prepared.order, signature, { signal });
            useSwapActivity.getState().add({ kind: "spot", orderId: order.id, order, account, chainId, partner: client.partner,
              inputAmount, inputSymbol: inputCurrency?.symbol ?? "", outputSymbol: outputCurrency?.symbol ?? "",
              createdAt: Date.now(), status: "pending" });
            void invalidateOrderQueries(queryClient, { partner: client.partner, chainId, account });
            acceptedOrderRef.current = order;
            setAcceptedOrder(order);
            useBestTradeSwapStore.getState().updateStore({ status: SwapStatus.LOADING, currentStep: SwapStep.SWAP,
              orderId: order.id, order, isAwaitingWallet: false });
            setSubmissionUncertain(false);
            wrappedCreditRef.current = undefined;
          }
          signal.throwIfAborted();
          useBestTradeSwapStore.getState().updateStore({ status: SwapStatus.LOADING, currentStep: SwapStep.SWAP,
            orderId: order.id, order, isAwaitingWallet: false });
          const completed = await waitForOrder({ client, order, signal });
          signal.throwIfAborted();
          setCompletedOrder(completed);
          useBestTradeSwapStore.getState().updateStore({ status: SwapStatus.SUCCESS, order: completed, isAwaitingWallet: false });
          useSwapActivity.getState().settle(chainId, completed.id, "confirmed", completed);
          void invalidateOrderQueries(queryClient, { partner: client.partner, chainId, account });
          advanceToStep("success");
          stopSession();
          toast.success("Swap completed", { id: actionToastId, duration: 3_000, description: "The Spot order filled successfully.", position: "bottom-right" });
          void refetchBalances().catch(() => undefined);
          return;
        }
        toast.dismiss(actionToastId);
      } catch (error) {
        if (error instanceof OrderSettlementError && error.reason !== "aborted") {
          useSwapActivity.getState().settle(chainId, error.orderId, error.reason,
            resolveSwapSettlementOrder(acceptedOrderRef.current, error));
        }
        const accepted = acceptedOrderRef.current;
        if (accepted && useBestTradeSwapStore.getState().orderId === accepted.id) {
          useBestTradeSwapStore.getState().updateStore({ status: SwapStatus.FAILED, isAwaitingWallet: false,
            error: { message: getErrorMessage(error) } });
        }
        stopSession();
        throw error;
      } finally {
        executionInFlight.current = false;
        if (sessionRef.current?.controller.signal.aborted) stopSession();
      }
    },
    onError: (error) => {
      if (!submittedRef.current && isUserRejectedError(error)) dismissTransactionRejectedToast({ id: actionToastId, position: "bottom-right" });
      else toast.error("Spot swap step failed", { id: actionToastId, duration: 5_000, description: submittedRef.current && !acceptedOrder && !(error instanceof OrderSettlementError) ? "Submission status is uncertain. Check order history before trying again." : getErrorMessage(error), position: "bottom-right" });
    },
  });
  const handleTriggerTooltipOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen && suppressTriggerTooltipRef.current) return;
    setTriggerTooltipOpen(nextOpen);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setTriggerTooltipOpen(false);
      setPriceChange(undefined);
      if (nextOpen) flowToastDismissed.current = false;
      if (!nextOpen) {
        suppressTriggerTooltipRef.current = true;
        stopSession();
        if (step === "success" && !isDemo) setInputAmount("");
      } else if (!submittedRef.current || completedOrder) {
        setNavigation({ history: ["flow"], viewedIndex: 0 });
        setReviewedContextKey(contextKey);
        setExecutionQuote(liveQuote);
        setReviewedQuote(liveQuote ? structuredClone(liveQuote) : undefined);
        setSourceIsNative(inputIsNative);
        setApprovalRequired(false);
        setSignature(undefined);
        setPrepared(undefined);
        setAcceptedOrder(undefined);
        acceptedOrderRef.current = undefined;
        setCompletedOrder(undefined);
        setSubmissionUncertain(false);
        submittedRef.current = false;
      }
      setOpen(nextOpen);
    },
    [completedOrder, contextKey, inputIsNative, isDemo, liveQuote, setInputAmount, step, stopSession],
  );

  const presentation = useMemo(() => {
    if (isDemo && viewedStep === "success")
      return {
        title: "Demo complete — no swap executed",
        explanation:
          "Local demo result. No transaction was sent, no funds moved, and no receipt or gas usage was produced.",
        data: {
          demo: true,
          submitted: false,
          status: "simulated",
          quote: quoteData,
        },
        codeSnippet: {
          language: "JSON",
          syntaxLanguage: "json",
          fileName: "demo-swap-result.json",
          format: (data: JsonContainer) => JSON.stringify(data, null, 2),
        },
      } satisfies StepPresentation;
    return getPresentation({ data: integrationData, step: viewedStep });
  }, [isDemo, integrationData, quoteData, viewedStep]);
  const actionLabel = isDemo
    ? {
        flow: "Start demo",
        check: "Simulate allowance check",
        wrap: "Simulate wrap",
        approve: "Simulate approval",
        sign: "Simulate signature",
        swap: "Simulate swap",
        success: "Close demo",
      }[step]
    : step === "swap" && acceptedOrder ? "Check settlement" : STEP_ACTION_LABELS[step];
  const disabledReason = useMemo(() => {
    if (step === "success") return undefined;
    if (submissionUncertain && !acceptedOrder) return "Submission status is uncertain. Check order history before starting another swap.";
    if (!client) return "Wait for the Spot client configuration.";
    if (!isDemo && reviewedContextKey !== contextKey) return "Wallet or swap inputs changed. Close and reopen this flow for a fresh review.";
    if (!isDemo) {
      const valueError = getQuoteValueError(executionQuote ?? reviewedQuote ?? liveQuote);
      if (valueError) return valueError;
    }
    if (!isDemo && step === "flow" && !hasBalance)
      return "Insufficient balance for a real swap.";
    if (!parsedInputAmount || parsedInputAmount === "0") {
      return "Enter a swap amount before running the live flow.";
    }
    if (isLoadingTrade && !liveQuote) {
      return "Wait for the current Spot quote.";
    }
    if (!executionQuote && !liveQuote) {
      return "A live Spot quote is required.";
    }
    return undefined;
  }, [
    acceptedOrder,
    client,
    contextKey,
    reviewedQuote,
    reviewedContextKey,
    submissionUncertain,
    isDemo,
    hasBalance,
    executionQuote,
    isLoadingTrade,
    liveQuote,
    parsedInputAmount,
    step,
  ]);
  const guideSection =
    viewedStep === "flow" ? "end-to-end-flow" : "execute-swap";
  const selectablePhaseIndexes = useMemo(
    () =>
      isRunning || acceptedOrder || submissionUncertain
        ? []
        : Array.from(
            new Set(
              navigation.history
                .map((historyStep) =>
                  getLiveFlowPhaseIndex(historyStep, liveFlowPhases, "success"),
                )
                .filter(
                  (phaseIndex) =>
                    phaseIndex >= 0 && phaseIndex < liveFlowPhases.length,
                ),
            ),
          ),
    [acceptedOrder, isRunning, liveFlowPhases, navigation.history, submissionUncertain],
  );
  const handleReturnToStep = useCallback(
    (targetIndex: number) => {
      if (isRunning || submittedRef.current) return;
      const next = rewindFlow(navigation, targetIndex);
      if (next === navigation) return;
      if (next.history.at(-1) !== "swap") {
        setSignature(undefined);
        setPrepared(undefined);
      }
      setNavigation(next);
    },
    [isRunning, navigation],
  );

  const handleSelectPhase = useCallback(
    (phaseIndex: number) => {
      const targetIndex = navigation.history.findLastIndex(
        (historyStep) =>
          getLiveFlowPhaseIndex(historyStep, liveFlowPhases, "success") ===
          phaseIndex,
      );
      handleReturnToStep(targetIndex);
    },
    [handleReturnToStep, liveFlowPhases, navigation.history],
  );

  useEffect(() => {
    if (!open || viewedStep === "flow" || flowToastDismissed.current) {
      toast.dismiss(flowToastId);
      return;
    }

    toast.custom(
      () => (
        <LiveFlowNotice
          actualStep={step}
          flowStep="flow"
          flowSummary="Wrap / Approve appear only if needed"
          flowTitle={isDemo ? "Demo swap flow" : "Live swap flow"}
          onDismiss={dismissFlowToast}
          onSelectPhase={handleSelectPhase}
          phases={liveFlowPhases}
          progressLabel="Spot swap progress"
          selectablePhaseIndexes={selectablePhaseIndexes}
          successStep="success"
          successTitle={
            isDemo ? "Demo complete · No swap executed" : "Swap complete"
          }
          viewedStep={viewedStep}
        />
      ),
      {
        id: flowToastId,
        closeButton: false,
        dismissible: false,
        duration: Infinity,
        position: "top-right",
        unstyled: true,
      },
    );
  }, [
    dismissFlowToast,
    isDemo,
    flowToastId,
    handleSelectPhase,
    liveFlowPhases,
    open,
    selectablePhaseIndexes,
    step,
    viewedStep,
  ]);

  useEffect(
    () => () => {
      toast.dismiss(flowToastId);
    },
    [flowToastId],
  );

  return (
    <Dialog open={open} dismissible={!isRunning} onOpenChange={handleOpenChange}>
      <Tooltip
        action
        open={triggerTooltipOpen}
        onOpenChange={handleTriggerTooltipOpenChange}
      >
        <TooltipTrigger
          asChild
          onBlur={() => {
            suppressTriggerTooltipRef.current = false;
          }}
          onPointerMove={() => {
            suppressTriggerTooltipRef.current = false;
          }}
        >
          <DialogTrigger asChild>{trigger}</DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {isDemo
            ? "Live quote, simulated execution — no wallet or funds needed"
            : "Real swap — wallet and funds required"}
        </TooltipContent>
      </Tooltip>
      <DialogContent
        presentation="center"
        onInteractOutside={(event) => event.preventDefault()}
        showCloseButton
        className="overflow-clip h-[min(1040px,98dvh)] max-w-[960px] max-md:h-[90dvh] max-md:grid-rows-[auto_minmax(0,1fr)] grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-0 overscroll-contain p-0 [&>button[data-slot=dialog-close]]:right-2 [&>button[data-slot=dialog-close]]:top-2 [&>button[data-slot=dialog-close]]:grid [&>button[data-slot=dialog-close]]:size-12 [&>button[data-slot=dialog-close]]:place-items-center [&>button[data-slot=dialog-close]>svg]:size-6"
      >
        <DialogTitle className="sr-only">Swap execution</DialogTitle>
        <div className="h-full min-h-0 overflow-hidden">
          <JsonInspectorPanel
            key={viewedStep}
            data={presentation.data}
            codeSnippet={presentation.codeSnippet}
            codeScrollResetKey={viewedStep}
            codeSnippetState="active"
            description=""
            explanation={
              isDemo
                ? DEMO_SWAP_EXPLANATIONS[viewedStep]
                : presentation.explanation
            }
            explanationDisplay="tooltip"
            getFieldExplanation={getSpotSwapFieldExplanation}
            getResponseFieldExplanation={getSpotSwapFieldExplanation}
            headerBackAction={
              navigation.viewedIndex > 0 && !isRunning && !acceptedOrder && !submissionUncertain
                ? {
                    ariaLabel: "View previous Spot step",
                    onClick: () =>
                      handleReturnToStep(navigation.viewedIndex - 1),
                  }
                : undefined
            }
            title={
              isDemo && viewedStep !== "success"
                ? `Demo · ${presentation.title}`
                : presentation.title
            }
            codeToolbarAction={
              <DownloadIntegrationButton
                flow="spot-swap"
                getCode={() => formatSpotSwapSdkFlow(integrationData)}
              />
            }
            viewModeAction={
              <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-2 sm:basis-0">
                  <SpotSwapGuideLink section={guideSection} />
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                  >
                    {isRunning ? acceptedOrder ? "Stop tracking" : "Cancel flow" : "Close"}
                  </Button>
                  {!isDemo && (!account || isWalletLoading) ? (
                    <Button
                      data-submit-button
                      type="button"
                      className="motion-reduce:[&_svg]:animate-none"
                      isLoading={isWalletLoading}
                      aria-busy={isWalletLoading}
                      onClick={() => openConnectModal?.()}
                    >
                      {isWalletLoading ? "Connecting…" : "Connect Wallet"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => {
                        if (step === "success") {
                          handleOpenChange(false);
                          return;
                        }

                        void executeCurrentStep();
                      }}
                      disabled={
                        step !== "success" &&
                        (Boolean(disabledReason) || isRunning)
                      }
                      isLoading={isRunning}
                    >
                      {step === "success" ? (
                        <CheckIcon aria-hidden="true" className="size-4" />
                      ) : null}
                      {actionLabel}
                    </Button>
                  )}
                </div>
              </div>
            }
          />
        </div>
      </DialogContent>
      {priceChange && (
        <QuotePriceChangeDialog
          previousMinimum={priceChange.previous.minAmountOut}
          newMinimum={priceChange.next.minAmountOut}
          outputDecimals={outputCurrency?.decimals}
          outputSymbol={outputCurrency?.symbol}
          onClose={() => setPriceChange(undefined)}
          onAccept={() => {
            setReviewedQuote(structuredClone(priceChange.next));
            setExecutionQuote(priceChange.next);
            returnToSigning();
            setPriceChange(undefined);
          }}
        />
      )}
    </Dialog>
  );
}
