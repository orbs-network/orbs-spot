"use client";

import { DEMO_ACCOUNT, DEMO_SIGNATURE, type DeveloperExecutionMode } from "./demo-order";
import { useDataChainId } from "@/lib/hooks/use-data-chain-id";
import { useBalance } from "@/lib/hooks/use-balances";
import BN from "bignumber.js";
import { remainingWrapAmount, rewindFlow } from "./flow-navigation";
import { QuotePriceChangeDialog } from "./quote-price-change-dialog";
import { DownloadIntegrationButton } from "./download-integration-button";
import { formatLiquidityHubSdkFlow } from "./sdk-flow-examples";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  isFreshQuote,
  permit2Address,
  type Quote,
} from "@orbs-network/liquidity-hub-sdk";
import { CheckIcon } from "lucide-react";
import {
  type ReactElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useConnection } from "wagmi";

import { Button } from "@/components/ui/button";
import { getSpotDocsHref } from "@/lib/developer-docs";
import { DeveloperGuideLink } from "./developer-guide-link";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import { useApproval } from "@/lib/hooks/use-approval";
import { useRefetchSelectedCurrenciesBalances } from "@/lib/hooks/use-balances";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useGetTransactionReceiptCallback } from "@/lib/hooks/use-get-transaction-receipt";
import { useLiquidityHub } from "@/lib/hooks/liquidity-hub";
import { useSettings } from "@/lib/hooks/use-settings";
import { useSignEip } from "@/lib/hooks/use-sign-eip";
import { useWrap } from "@/lib/hooks/use-wrap";
import { getActiveLiquidityHubPartnerId } from "@/lib/partners/liquidity-hub";
import {
  isUserRejectedError,
  dismissTransactionRejectedToast,
} from "@/lib/tx-rejection";
import { getWrappedNativeCurrency, isNativeAddress } from "@/lib/utils";
import {
  getLiquidityHubFieldExplanation,
  LIQUIDITY_HUB_ALLOWANCE_CODE_SNIPPET,
  LIQUIDITY_HUB_APPROVAL_CODE_SNIPPET,
  LIQUIDITY_HUB_FULL_FLOW_CODE_SNIPPET,
  LIQUIDITY_HUB_SIGN_CODE_SNIPPET,
  LIQUIDITY_HUB_SWAP_AND_CONFIRM_CODE_SNIPPET,
  LIQUIDITY_HUB_WRAP_CODE_SNIPPET,
} from "./liquidity-hub-code-examples";
import { LiquidityHubGuideLink } from "./liquidity-hub-guide-link";
import {
  JsonInspectorPanel,
  type CodeSnippetOptions,
  type JsonContainer,
  type JsonValue,
} from "./json-inspector";
import {
  getLiveFlowPhaseIndex,
  LiveFlowNotice,
  type LiveFlowPhase,
} from "./live-flow-notice";

type LiquidityHubFlowStep =
  | "flow"
  | "check"
  | "wrap"
  | "approve"
  | "sign"
  | "swap"
  | "success";

type StepNavigation = {
  history: LiquidityHubFlowStep[];
  viewedIndex: number;
};

type StepPresentation = {
  codeSnippet: CodeSnippetOptions;
  data: JsonContainer;
  explanation: string;
  title: string;
};

type LiquidityHubFlowPhase = LiveFlowPhase<LiquidityHubFlowStep>;

const DEMO_SWAP_EXPLANATIONS: Record<LiquidityHubFlowStep, string> = {
  flow: "Live quote, simulated execution. No wallet or gas required. A sample address is used when disconnected. The demo assumes enough tokens and gas; it does not verify execution. Downloaded integration code performs real actions if you run it.",
  check: "Simulated allowance: zero, so you can explore approval. Your wallet allowance is not read or changed.",
  wrap: "Simulated wrapping. No native tokens are deposited and no gas is spent.",
  approve: "Simulated Permit2 approval. No spending permission is granted and no transaction is sent.",
  sign: "Simulated signing of the live quote. The demo uses example hex bytes; no wallet opens or valid signature is generated.",
  swap: "The actual quote and demo hex signature are shown below. This call is not executed; no swap is sent to Liquidity Hub and no receipt is requested.",
  success: "Local demo result. No swap was executed, no funds moved, and no receipt or gas usage was produced.",
};

const EMPTY_QUOTE_RESPONSE = {} satisfies JsonContainer;

const ALLOWANCE_PHASE: LiquidityHubFlowPhase = {
  effect: "Wallet transaction if needed",
  label: "Approve token",
  step: "check",
};
const WRAP_PHASE: LiquidityHubFlowPhase = {
  effect: "Wallet transaction",
  label: "Wrap",
  step: "wrap",
};
const APPROVE_PHASE: LiquidityHubFlowPhase = {
  effect: "Wallet transaction",
  label: "Approve",
  step: "approve",
};
const SIGN_PHASE: LiquidityHubFlowPhase = {
  effect: "Review message + wallet signature",
  label: "Sign quote",
  step: "sign",
};
const SWAP_PHASE: LiquidityHubFlowPhase = {
  effect: "SDK transaction + receipt",
  label: "Swap & confirm",
  step: "swap",
};

const STEP_ACTION_LABELS: Record<LiquidityHubFlowStep, string> = {
  flow: "Start",
  check: "Approve token if needed",
  wrap: "Wrap token",
  approve: "Approve token",
  sign: "Sign quote",
  swap: "Swap & confirm",
  success: "Close",
};

const STEP_LOADING_MESSAGES: Record<
  Exclude<LiquidityHubFlowStep, "success">,
  string
> = {
  flow: "Starting the Liquidity Hub flow…",
  check: "Checking Permit2 allowance and approving if needed…",
  wrap: "Waiting for the native-token wrap transaction…",
  approve: "Waiting for the Permit2 approval transaction…",
  sign: "Waiting for the quote signature…",
  swap: "Submitting the signed quote and waiting for confirmation…",
};

function toJsonContainer(value: unknown): JsonContainer | undefined {
  if (!value) return undefined;

  try {
    const parsed: unknown = JSON.parse(JSON.stringify(value));
    return Array.isArray(parsed) ||
      (parsed !== null && typeof parsed === "object")
      ? (parsed as JsonContainer)
      : undefined;
  } catch {
    return undefined;
  }
}

function asRecord(value: JsonValue | undefined): Record<string, JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The Liquidity Hub step could not be completed.";
}

function getPresentation({
  data,
  step,
}: {
  data: JsonContainer;
  step: LiquidityHubFlowStep;
}): StepPresentation {
  if (step === "flow") {
    return {
      codeSnippet: LIQUIDITY_HUB_FULL_FLOW_CODE_SNIPPET,
      data,
      explanation:
        "Use the TypeScript SDK to refresh, sign, and execute the selected quote, with wrapping and approval when needed.",
      title: "Liquidity Hub TypeScript SDK flow",
    };
  }
  if (step === "check") {
    return {
      codeSnippet: LIQUIDITY_HUB_ALLOWANCE_CODE_SNIPPET,
      data,
      explanation:
        "Check the input token’s Permit2 allowance. If it is below the quoted input amount, approve the token and wait for confirmation.",
      title: "Approve token if needed",
    };
  }
  if (step === "wrap") {
    return {
      codeSnippet: LIQUIDITY_HUB_WRAP_CODE_SNIPPET,
      data,
      explanation:
        "Liquidity Hub does not support a native asset as inToken. Deposit the quoted native amount into the wrapped ERC-20 contract and wait for confirmation. This step appears only when the DEX source is native.",
      title: "Wrap native input",
    };
  }
  if (step === "approve") {
    return {
      codeSnippet: LIQUIDITY_HUB_APPROVAL_CODE_SNIPPET,
      data,
      explanation:
        "The allowance check confirmed that Permit2 approval is required. Approve the input token and wait for the wallet transaction to confirm.",
      title: "Approve Permit2",
    };
  }
  if (step === "sign") {
    const quote = asRecord(asRecord(data).quote);
    return {
      codeSnippet: LIQUIDITY_HUB_SIGN_CODE_SNIPPET,
      data: { message: asRecord(asRecord(quote.eip712).message) },
      explanation:
        "signQuote() refetches the quote if it is stale before signing. Click Edit to inspect and change quote.eip712.message, then save before signing. Submit the same quote with its signature.",
      title: "Sign the quote",
    };
  }
  if (step === "swap") {
    return {
      codeSnippet: LIQUIDITY_HUB_SWAP_AND_CONFIRM_CODE_SNIPPET,
      data,
      explanation:
        "Submit the same quote payload and signature to Liquidity Hub, then wait for the returned transaction hash to be confirmed.",
      title: "Swap and confirm",
    };
  }

  return {
    codeSnippet: LIQUIDITY_HUB_SWAP_AND_CONFIRM_CODE_SNIPPET,
    data,
    explanation:
      "The Liquidity Hub swap transaction was confirmed on-chain.",
    title: "Swap confirmed",
  };
}

export function LiquidityHubDeveloperContent({
  trigger,
  mode,
}: {
  mode: DeveloperExecutionMode;
  trigger: ReactElement;
}) {
  const isDemo = mode === "demo";
  const flowToastId = useId();
  const actionToastId = useId();
  const { address: account } = useConnection();
  const chainId = useDataChainId();
  const { openConnectModal } = useConnectModal();
  const { slippage } = useSettings();
  const {
    inputCurrency,
    isLoadingTrade,
    outputCurrency,
    parsedInputAmount,
    trade,
  } = useDerivedSwap();
  const inputBalance = useBalance(inputCurrency).wei;
  const hasBalance = Boolean(account && BN(inputBalance ?? "0").gte(parsedInputAmount));
  const liquidityHub = useLiquidityHub();
  const { setInputAmount } = useActionHandlers();
  const { mutateAsync: refetchBalances } =
    useRefetchSelectedCurrenciesBalances();
  const { mutateAsync: getTransactionReceipt } =
    useGetTransactionReceiptCallback();
  const { mutateAsync: signQuote } = useSignEip();
  const { mutateAsync: wrap } = useWrap();
  const [open, setOpen] = useState(false);
  const [triggerTooltipOpen, setTriggerTooltipOpen] = useState(false);
  const [navigation, setNavigation] = useState<StepNavigation>({
    history: ["flow"],
    viewedIndex: 0,
  });
  const [executionQuote, setExecutionQuote] = useState<Quote>();
  const { approve, ensureAllowance } = useApproval(
    permit2Address,
    executionQuote?.inToken ?? inputCurrency?.address,
    executionQuote?.inAmount ?? parsedInputAmount,
  );
  const [priceChange, setPriceChange] = useState<{ previous: Quote; next: Quote }>();
  const [sourceIsNative, setSourceIsNative] = useState(false);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [signature, setSignature] = useState<string>();
  const [txHash, setTxHash] = useState<`0x${string}`>();
  const suppressTriggerTooltipRef = useRef(false);
  const wrappedAmountRef = useRef(BigInt(0));
  const step = navigation.history.at(-1) ?? "flow";
  const viewedStep = navigation.history[navigation.viewedIndex] ?? step;
  const liveQuote = trade?.originalQuote as Quote | undefined;
  const partner = getActiveLiquidityHubPartnerId();
  const inputIsNative = isNativeAddress(inputCurrency?.address);
  const requestData = useMemo<JsonContainer>(() => {
    const fromToken = inputIsNative
      ? getWrappedNativeCurrency(chainId)?.address
      : inputCurrency?.address;

    return {
      partner,
      chainId: chainId ?? 1,
      inputIsNative,
      quoteArgs: {
        fromToken: fromToken ?? "<wrapped-input-token-address>",
        toToken: outputCurrency?.address ?? "<output-token-address>",
        inAmount: parsedInputAmount || "0",
        dexMinAmountOut: "-1",
        slippage,
        account: account ?? DEMO_ACCOUNT,
      },
    };
  }, [
    account,
    chainId,
    inputCurrency?.address,
    inputIsNative,
    outputCurrency?.address,
    parsedInputAmount,
    partner,
    slippage,
  ]);
  const currentQuote = useMemo(
    () => toJsonContainer(executionQuote ?? liveQuote),
    [executionQuote, liveQuote],
  );
  const quoteData = currentQuote ?? EMPTY_QUOTE_RESPONSE;
  const handleSaveSigningMessage = useCallback((data: JsonContainer) => {
    const quote = executionQuote ?? liveQuote;
    const message = asRecord(data).message;
    if (!quote || !message || typeof message !== "object" || Array.isArray(message)) {
      throw new Error("A quote and an EIP-712 message object are required");
    }
    const permitted = asRecord(message).permitted;
    const amount = asRecord(permitted).amount;
    const nextAmount = BigInt(String(amount));
    if (nextAmount <= BigInt(0)) throw new Error("Input amount must be positive");
    setExecutionQuote({
      ...quote,
      inAmount: nextAmount.toString(),
      eip712: { ...quote.eip712, message },
    });
    setSignature(undefined);
    setTxHash(undefined);
    if (nextAmount > BigInt(quote.inAmount)) {
      // Recheck Permit2 against the edited amount before signing again.
      setNavigation((current) => rewindFlow(current, current.history.indexOf("check")));
    }
  }, [executionQuote, liveQuote]);
  const integrationData = useMemo<JsonContainer>(
    () => ({
      ...asRecord(requestData),
      quote: asRecord(quoteData),
      demo: isDemo,
      execution: {
        signature: signature ?? "<wallet-signature>",
        txHash: txHash ?? "<swap-transaction-hash>",
      },
    }),
    [isDemo, quoteData, requestData, signature, txHash],
  );
  const liveFlowPhases = useMemo(() => {
    const visitedSteps = new Set(navigation.history);
    const phases: LiquidityHubFlowPhase[] = [ALLOWANCE_PHASE];

    if (sourceIsNative || visitedSteps.has("wrap")) {
      phases.push(WRAP_PHASE);
    }
    if (visitedSteps.has("approve")) {
      phases.push(APPROVE_PHASE);
    }
    phases.push(SIGN_PHASE, SWAP_PHASE);

    return isDemo ? phases.map((phase) => ({ ...phase, effect: "Simulated" })) : phases;
  }, [isDemo, navigation.history, sourceIsNative]);

  const handleTriggerTooltipOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen && suppressTriggerTooltipRef.current) return;
      setTriggerTooltipOpen(nextOpen);
    },
    [],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isRunning) return;

      setTriggerTooltipOpen(false);
      setPriceChange(undefined);
      if (!nextOpen) {
        suppressTriggerTooltipRef.current = true;
      }

      if (nextOpen) {
        setNavigation({ history: ["flow"], viewedIndex: 0 });
        wrappedAmountRef.current = BigInt(0);
        setExecutionQuote(liveQuote);
        setSourceIsNative(inputIsNative);
        setApprovalRequired(false);
        setSignature(undefined);
        setTxHash(undefined);
      } else if (step === "success" && !isDemo) {
        setInputAmount("");
      }

      setOpen(nextOpen);
    }, [inputIsNative, isDemo, isRunning, liveQuote, setInputAmount, step]);

  const advanceToStep = useCallback((nextStep: LiquidityHubFlowStep) => {
    setNavigation((current) => ({
      history: [...current.history, nextStep],
      viewedIndex: current.history.length,
    }));
  }, []);

  const returnToSigning = useCallback(() => {
    setSignature(undefined);
    setTxHash(undefined);
    setNavigation((current) => rewindFlow(current, current.history.lastIndexOf("sign")));
  }, []);

  const executeCurrentStep = useCallback(async () => {
    if (isRunning || step === "success") return;

    setIsRunning(true);
    toast.loading(isDemo ? "Simulating this step…" : STEP_LOADING_MESSAGES[step], {
      id: actionToastId,
      position: "bottom-right",
    });

    const fetchReplacementQuote = (quote: Quote) => liquidityHub.getQuote({
      fromToken: quote.inToken,
      toToken: quote.outToken,
      inAmount: quote.inAmount,
      dexMinAmountOut: "-1",
      slippage: quote.slippage,
      account: quote.user,
    });

    try {
      const quote = executionQuote ?? liveQuote;
      if (!quote || quote.error || !BN(quote.inAmount).gt(0) || !BN(quote.outAmount).gt(0)) {
        throw new Error("Enter a valid amount and wait for a live quote.");
      }
      if (isDemo) {
        // Never reach allowance mutations, wallet signing, swaps, or receipt polling.
        if (step === "flow") advanceToStep("check");
        else if (step === "check") {
          setApprovalRequired(true);
          advanceToStep(sourceIsNative ? "wrap" : "approve");
        } else if (step === "wrap") advanceToStep("approve");
        else if (step === "approve") advanceToStep("sign");
        else if (step === "sign") {
          setExecutionQuote(quote);
          setSignature(DEMO_SIGNATURE);
          advanceToStep("swap");
        } else if (step === "swap") advanceToStep("success");
        toast.success(step === "swap" ? "Demo complete — no swap executed" : "Demo step complete", {
          id: actionToastId,
          description: "Simulated locally. No funds used or transaction sent.",
          position: "bottom-right",
        });
        return;
      }
      if (!account) throw new Error("Connect a wallet to execute a real swap.");
      if (step === "flow" && !hasBalance) throw new Error("Insufficient balance for this swap.");
      if (quote.user.toLowerCase() !== account.toLowerCase()) throw new Error("The wallet changed. Reopen the flow for a fresh quote.");
      if (step === "flow") {
        advanceToStep("check");
        toast.success("Swap flow started", {
          id: actionToastId,
          description: "Next, check the quote input token’s Permit2 allowance.",
          position: "bottom-right",
        });
        return;
      }

      if (step === "check") {
        const hasAllowance = await ensureAllowance();
        if (!hasAllowance) await approve();
        setApprovalRequired(false);

        const needsWrap = sourceIsNative && remainingWrapAmount(
          BigInt(executionQuote?.inAmount ?? parsedInputAmount), wrappedAmountRef.current,
        ) > BigInt(0);
        advanceToStep(needsWrap ? "wrap" : "sign");
        toast.success("Token ready", {
          id: actionToastId,
          description: needsWrap
            ? "Native input must be wrapped before signing."
            : "The Permit2 allowance is sufficient.",
          position: "bottom-right",
        });
        return;
      }

      if (step === "wrap") {
        const amount = remainingWrapAmount(
          BigInt(executionQuote?.inAmount ?? parsedInputAmount), wrappedAmountRef.current,
        );
        if (amount > BigInt(0)) {
          const receipt = await wrap(amount.toString());
          if (receipt.status !== "success") throw new Error("Native token wrapping reverted");
          wrappedAmountRef.current += amount;
        }

        advanceToStep(approvalRequired ? "approve" : "sign");
        toast.success("Native token wrapped", {
          id: actionToastId,
          description: approvalRequired
            ? "Permit2 approval is still required."
            : "Next, review and sign the quote.",
          position: "bottom-right",
        });
        return;
      }

      if (step === "approve") {
        if (!await ensureAllowance()) await approve();

        setApprovalRequired(false);
        advanceToStep("sign");
        toast.success("Permit2 approved", {
          id: actionToastId,
          description:
            "Approval confirmed. Next, review and sign the quote.",
          position: "bottom-right",
        });
        return;
      }

      if (step === "sign") {
        let quoteToSign = executionQuote ?? liveQuote;
        if (!quoteToSign || quoteToSign.error) {
          throw new Error(
            quoteToSign?.error || "A Liquidity Hub quote is required",
          );
        }

        if (!isFreshQuote(quoteToSign, 60)) {
          const freshQuote = await fetchReplacementQuote(quoteToSign);
          if (BigInt(freshQuote.minAmountOut) < BigInt(quoteToSign.minAmountOut)) {
            setPriceChange({ previous: quoteToSign, next: freshQuote });
            toast.dismiss(actionToastId);
            return;
          }
          quoteToSign = freshQuote;
        }

        setExecutionQuote(quoteToSign);
        const nextSignature = await signQuote(quoteToSign);
        setSignature(nextSignature);

        advanceToStep("swap");
        toast.success("Quote signed", {
          id: actionToastId,
          description:
            "The quote and signature are paired for submission.",
          position: "bottom-right",
        });
        return;
      }

      if (step === "swap") {
        if (!executionQuote || !signature) {
          throw new Error("Sign the quote payload before submitting the swap");
        }

        // A quote can expire while the wallet is open or before this step is run.
        // A replacement must be signed again; never reuse its predecessor's signature.
        if (!txHash && !isFreshQuote(executionQuote, 60)) {
          const freshQuote = await fetchReplacementQuote(executionQuote);
          returnToSigning();
          if (BigInt(freshQuote.minAmountOut) < BigInt(executionQuote.minAmountOut)) {
            setPriceChange({ previous: executionQuote, next: freshQuote });
            toast.dismiss(actionToastId);
          } else {
            setExecutionQuote(freshQuote);
            toast.info("Quote refreshed. Sign the updated quote to continue.", {
              id: actionToastId,
              position: "bottom-right",
            });
          }
          return;
        }

        const hash =
          txHash ??
          ((await liquidityHub.swap(
            executionQuote,
            signature,
          )) as `0x${string}`);
        if (!txHash) setTxHash(hash);

        await getTransactionReceipt(hash);
        advanceToStep("success");
        toast.success("Swap confirmed", {
          id: actionToastId,
          description: "The final output and gas details are ready.",
          position: "bottom-right",
        });
        void refetchBalances();
        return;
      }
    } catch (executionError) {
      if (isUserRejectedError(executionError)) {
        dismissTransactionRejectedToast({
          id: actionToastId,
          position: "bottom-right",
        });
      } else {
        toast.error("Liquidity Hub step failed", {
          id: actionToastId,
          description: getErrorMessage(executionError),
          position: "bottom-right",
        });
      }
    } finally {
      setIsRunning(false);
    }
  }, [
    isDemo,
    account,
    hasBalance,
    actionToastId,
    advanceToStep,
    approvalRequired,
    approve,
    ensureAllowance,
    executionQuote,
    getTransactionReceipt,
    isRunning,
    liquidityHub,
    liveQuote,
    parsedInputAmount,
    refetchBalances,
    returnToSigning,
    signQuote,
    signature,
    sourceIsNative,
    step,
    txHash,
    wrap,
  ]);

  const presentation = useMemo(
    () => {
      if (isDemo && viewedStep === "success") return {
        title: "Demo complete — no swap executed",
        explanation: "Local demo result. No transaction was sent, no funds moved, and no receipt or gas usage was produced.",
        data: { demo: true, submitted: false, status: "simulated", quote: quoteData },
        codeSnippet: { language: "JSON", syntaxLanguage: "json", fileName: "demo-swap-result.json", format: (data: JsonContainer) => JSON.stringify(data, null, 2) },
      } satisfies StepPresentation;
      return getPresentation({ data: integrationData, step: viewedStep });
    },
    [isDemo, integrationData, quoteData, viewedStep],
  );
  const actionLabel = isDemo ? ({ flow: "Start demo", check: "Simulate allowance check", wrap: "Simulate wrap", approve: "Simulate approval", sign: "Simulate signature", swap: "Simulate swap", success: "Close demo" })[step] : STEP_ACTION_LABELS[step];
  const disabledReason = useMemo(() => {
    if (step === "success") return undefined;
    if (!isDemo && step === "flow" && !hasBalance) return "Insufficient balance for a real swap.";
    if (!parsedInputAmount || parsedInputAmount === "0") {
      return "Enter a swap amount before running the live flow.";
    }
    if (isLoadingTrade && !liveQuote) {
      return "Wait for the current Liquidity Hub quote.";
    }
    if (!executionQuote && !liveQuote) {
      return "A live Liquidity Hub quote is required.";
    }
    return undefined;
  }, [isDemo, hasBalance, executionQuote, isLoadingTrade, liveQuote, parsedInputAmount, step]);
  const guideSection =
    viewedStep === "flow" ? "end-to-end-flow" : "execute-swap";
  const selectablePhaseIndexes = useMemo(
    () =>
      isRunning
        ? []
        : Array.from(
            new Set(
              navigation.history
                .map((historyStep) =>
                  getLiveFlowPhaseIndex(
                    historyStep,
                    liveFlowPhases,
                    "success",
                  ),
                )
                .filter(
                  (phaseIndex) =>
                    phaseIndex >= 0 && phaseIndex < liveFlowPhases.length,
                ),
            ),
          ),
    [isRunning, liveFlowPhases, navigation.history],
  );
  const handleReturnToStep = useCallback((targetIndex: number) => {
    if (isRunning) return;
    const next = rewindFlow(navigation, targetIndex);
    if (next === navigation) return;
    if (next.history.at(-1) !== "swap") {
      setSignature(undefined);
      setTxHash(undefined);
    }
    setNavigation(next);
  }, [isRunning, navigation]);

  const handleSelectPhase = useCallback((phaseIndex: number) => {
    const targetIndex = navigation.history.findLastIndex((historyStep) =>
      getLiveFlowPhaseIndex(historyStep, liveFlowPhases, "success") === phaseIndex,
    );
    handleReturnToStep(targetIndex);
  }, [handleReturnToStep, liveFlowPhases, navigation.history]);

  useEffect(() => {
    if (!open || viewedStep === "flow") {
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
          onSelectPhase={handleSelectPhase}
          phases={liveFlowPhases}
          progressLabel="Liquidity Hub swap progress"
          selectablePhaseIndexes={selectablePhaseIndexes}
          successStep="success"
          successTitle={isDemo ? "Demo complete · No swap executed" : "Swap complete"}
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip
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
          {isDemo ? "Live quote, simulated execution — no wallet or funds needed" : "Real swap — wallet and funds required"}
        </TooltipContent>
      </Tooltip>
      <DialogContent
        presentation="center"
        mobilePresentation="fullscreen"
        onInteractOutside={(event) => event.preventDefault()}
        showCloseButton
        className="overflow-clip h-[min(1040px,98dvh)] max-w-[960px] grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-0 overscroll-contain p-0 [&>button[data-slot=dialog-close]]:right-2 [&>button[data-slot=dialog-close]]:top-2 [&>button[data-slot=dialog-close]]:grid [&>button[data-slot=dialog-close]]:size-12 [&>button[data-slot=dialog-close]]:place-items-center [&>button[data-slot=dialog-close]>svg]:size-6"
      >
        <div className="h-full min-h-0 overflow-hidden">
          <JsonInspectorPanel
            key={viewedStep}
            data={presentation.data}
            editable={viewedStep === "sign" && step === "sign" && !isRunning}
            isValueEditable={(path) => path[0] === "message"}
            onSave={viewedStep === "sign" ? handleSaveSigningMessage : undefined}
            codeSnippet={presentation.codeSnippet}
            codeScrollResetKey={viewedStep}
            codeSnippetState="active"
            description=""
            explanation={isDemo ? DEMO_SWAP_EXPLANATIONS[viewedStep] : presentation.explanation}
            explanationDisplay="tooltip"
            getFieldExplanation={getLiquidityHubFieldExplanation}
            getResponseFieldExplanation={getLiquidityHubFieldExplanation}
            headerBackAction={
              navigation.viewedIndex > 0 && !isRunning
                ? {
                    ariaLabel: "View previous Liquidity Hub step",
                    onClick: () => handleReturnToStep(navigation.viewedIndex - 1),
                  }
                : undefined
            }
            title={isDemo && viewedStep !== "success" ? `Demo · ${presentation.title}` : presentation.title}
            codeToolbarAction={
              <DownloadIntegrationButton
                flow="liquidity-hub"
                getCode={() => formatLiquidityHubSdkFlow(integrationData)}
              />
            }
            viewModeAction={
              <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-2 sm:basis-0">
                  <DeveloperGuideLink baseHref={getSpotDocsHref("/liquidity-hub/direct")}>
                    Direct API
                  </DeveloperGuideLink>
                  <LiquidityHubGuideLink section={guideSection} />
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isRunning}
                    onClick={() => handleOpenChange(false)}
                  >
                    Close
                  </Button>
                  {!isDemo && !account ? (
                    <Button
                      data-submit-button
                      type="button"
                      onClick={() => openConnectModal?.()}
                    >
                      Connect Wallet
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
            setExecutionQuote(priceChange.next);
            returnToSigning();
            setPriceChange(undefined);
          }}
        />
      )}
    </Dialog>
  );
}
