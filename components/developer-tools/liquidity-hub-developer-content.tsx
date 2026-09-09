"use client";

import { remainingWrapAmount, rewindFlow } from "./flow-navigation";

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
  showTransactionRejectedToast,
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

const EMPTY_QUOTE_RESPONSE = {} satisfies JsonContainer;

const ALLOWANCE_PHASE: LiquidityHubFlowPhase = {
  effect: "Read only",
  label: "Allowance",
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
  effect: "Freshness check + wallet signature",
  label: "Get latest & sign",
  step: "sign",
};
const SWAP_PHASE: LiquidityHubFlowPhase = {
  effect: "SDK transaction + receipt",
  label: "Swap & confirm",
  step: "swap",
};

const STEP_ACTION_LABELS: Record<LiquidityHubFlowStep, string> = {
  flow: "Start",
  check: "Check allowance",
  wrap: "Wrap token",
  approve: "Approve token",
  sign: "Get latest & sign",
  swap: "Swap & confirm",
  success: "Close",
};

const STEP_LOADING_MESSAGES: Record<
  Exclude<LiquidityHubFlowStep, "success">,
  string
> = {
  flow: "Starting the Liquidity Hub flow…",
  check: "Reading the current Permit2 allowance…",
  wrap: "Waiting for the native-token wrap transaction…",
  approve: "Waiting for the Permit2 approval transaction…",
  sign: "Checking quote freshness and waiting for its signature…",
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
      title: "Liquidity Hub SDK flow",
    };
  }
  if (step === "check") {
    return {
      codeSnippet: LIQUIDITY_HUB_ALLOWANCE_CODE_SNIPPET,
      data,
      explanation:
        "Read the input token’s current Permit2 allowance and compare it with the quoted input amount. This step is read-only and does not open the wallet.",
      title: "Check Permit2 allowance",
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
    return {
      codeSnippet: LIQUIDITY_HUB_SIGN_CODE_SNIPPET,
      data,
      explanation:
        "Call getLatestQuote() immediately before signing. It returns the current payload when isFreshQuote() passes or fetches a replacement, then keeps that exact quote paired with its signature for swap.",
      title: "Get the latest quote and sign",
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
}: {
  trigger: ReactElement;
}) {
  const flowToastId = useId();
  const actionToastId = useId();
  const { address: account, chainId } = useConnection();
  const { openConnectModal } = useConnectModal();
  const { slippage } = useSettings();
  const {
    inputCurrency,
    isLoadingTrade,
    outputCurrency,
    parsedInputAmount,
    refetchTrade,
    trade,
  } = useDerivedSwap();
  const liquidityHub = useLiquidityHub();
  const { setInputAmount } = useActionHandlers();
  const { mutateAsync: refetchBalances } =
    useRefetchSelectedCurrenciesBalances();
  const { mutateAsync: getTransactionReceipt } =
    useGetTransactionReceiptCallback();
  const { mutateAsync: signQuote } = useSignEip();
  const { mutateAsync: wrap } = useWrap();
  const { approve, ensureAllowance } = useApproval(
    permit2Address,
    inputCurrency?.address,
    parsedInputAmount,
  );
  const [open, setOpen] = useState(false);
  const [triggerTooltipOpen, setTriggerTooltipOpen] = useState(false);
  const [navigation, setNavigation] = useState<StepNavigation>({
    history: ["flow"],
    viewedIndex: 0,
  });
  const [executionQuote, setExecutionQuote] = useState<Quote>();
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
        account: account ?? "<connected-wallet-address>",
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
  const integrationData = useMemo<JsonContainer>(
    () => ({
      ...asRecord(requestData),
      quote: asRecord(quoteData),
      execution: {
        signature: signature ?? "<wallet-signature>",
        txHash: txHash ?? "<swap-transaction-hash>",
      },
    }),
    [quoteData, requestData, signature, txHash],
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

    return phases;
  }, [navigation.history, sourceIsNative]);

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
      } else if (step === "success") {
        setInputAmount("");
      }

      setOpen(nextOpen);
    }, [inputIsNative, isRunning, liveQuote, setInputAmount, step]);

  const advanceToStep = useCallback((nextStep: LiquidityHubFlowStep) => {
    setNavigation((current) => ({
      history: [...current.history, nextStep],
      viewedIndex: current.history.length,
    }));
  }, []);

  const executeCurrentStep = useCallback(async () => {
    if (isRunning || step === "success") return;

    setIsRunning(true);
    toast.loading(STEP_LOADING_MESSAGES[step], {
      id: actionToastId,
      position: "bottom-right",
    });

    try {
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
        const nextApprovalRequired = !hasAllowance;
        setApprovalRequired(nextApprovalRequired);

        const needsWrap = sourceIsNative && remainingWrapAmount(
          BigInt(executionQuote?.inAmount ?? parsedInputAmount), wrappedAmountRef.current,
        ) > BigInt(0);
        const nextStep = needsWrap
          ? "wrap"
          : nextApprovalRequired
            ? "approve"
            : "sign";
        advanceToStep(nextStep);
        toast.success("Allowance checked", {
          id: actionToastId,
          description: needsWrap
            ? "Native input must be wrapped before signing."
            : nextApprovalRequired
              ? "Permit2 approval is required."
              : "The existing Permit2 allowance is sufficient.",
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
            : "Quote freshness will be checked before signing.",
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
            "Approval confirmed. Next, get the latest quote and sign it.",
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

        if (!isFreshQuote(quoteToSign)) {
          const refreshedTrade = await refetchTrade();
          if (refreshedTrade.error) {
            throw refreshedTrade.error;
          }
          quoteToSign = refreshedTrade.data?.originalQuote as Quote | undefined;
          if (!quoteToSign || quoteToSign.error) {
            throw new Error(
              quoteToSign?.error || "A fresh Liquidity Hub quote is required",
            );
          }
        }

        setExecutionQuote(quoteToSign);
        const nextSignature = await signQuote(quoteToSign);
        setSignature(nextSignature);

        advanceToStep("swap");
        toast.success("Quote signed", {
          id: actionToastId,
          description:
            "The freshness-checked quote and signature are paired for submission.",
          position: "bottom-right",
        });
        return;
      }

      if (step === "swap") {
        if (!executionQuote || !signature) {
          throw new Error("Sign the quote payload before submitting the swap");
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
        showTransactionRejectedToast({
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
    refetchTrade,
    signQuote,
    signature,
    sourceIsNative,
    step,
    txHash,
    wrap,
  ]);

  const presentation = useMemo(
    () =>
      getPresentation({
        data: integrationData,
        step: viewedStep,
      }),
    [integrationData, viewedStep],
  );
  const actionLabel = STEP_ACTION_LABELS[step];
  const disabledReason = useMemo(() => {
    if (step === "success") return undefined;
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
  }, [executionQuote, isLoadingTrade, liveQuote, parsedInputAmount, step]);
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
          flowTitle="Live swap flow"
          onSelectPhase={handleSelectPhase}
          phases={liveFlowPhases}
          progressLabel="Liquidity Hub swap progress"
          selectablePhaseIndexes={selectablePhaseIndexes}
          successStep="success"
          successTitle="Swap complete"
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
          Inspect the complete Liquidity Hub flow
        </TooltipContent>
      </Tooltip>
      <DialogContent
        presentation="center"
        mobilePresentation="fullscreen"
        onInteractOutside={(event) => event.preventDefault()}
        showCloseButton
        className="h-[min(1040px,98dvh)] max-w-[960px] grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-0 overscroll-contain p-0 [&>button[data-slot=dialog-close]]:right-2 [&>button[data-slot=dialog-close]]:top-2 [&>button[data-slot=dialog-close]]:grid [&>button[data-slot=dialog-close]]:size-12 [&>button[data-slot=dialog-close]]:place-items-center [&>button[data-slot=dialog-close]>svg]:size-6"
      >
        <div className="h-full min-h-0 overflow-hidden">
          <JsonInspectorPanel
            data={presentation.data}
            codeSnippet={presentation.codeSnippet}
            codeScrollResetKey={viewedStep}
            codeSnippetState="active"
            description=""
            explanation={presentation.explanation}
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
            title={presentation.title}
            viewModeAction={
              <div className="flex w-full flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <LiquidityHubGuideLink section={guideSection} />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isRunning}
                    onClick={() => handleOpenChange(false)}
                  >
                    Close
                  </Button>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {!account ? (
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
    </Dialog>
  );
}
