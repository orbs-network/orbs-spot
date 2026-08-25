"use client";

import {
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  RefreshCwIcon,
} from "lucide-react";
import { toast } from "sonner";
import { maxUint256, parseSignature, toHex } from "viem";
import { useConnection } from "wagmi";
import {
  isNativeAddress,
  submitOrder,
  useSpot,
  type Signature,
} from "@orbs-network/spot-react";

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
import { useRefetchSelectedCurrenciesBalances } from "@/lib/hooks/use-balances";
import { useSignTypedDataPayload } from "@/lib/hooks/use-sign-typed-data";
import { useApproveToken } from "@/lib/hooks/use-token-approval";
import { useGetTokenAllowance } from "@/lib/hooks/use-token-allowance";
import { useFormTabStore } from "@/lib/hooks/store";
import { useWrapNativeToken } from "@/lib/hooks/use-wrap";
import { getActiveSpotPartner } from "@/lib/partners/spot";
import {
  isUserRejectedError,
  showTransactionRejectedToast,
} from "@/lib/tx-rejection";

import {
  CREATE_ORDER_CODE_SNIPPET,
  getSignatureFieldExplanation,
  FULL_ORDER_FLOW_CODE_SNIPPET,
  isApprovalValueEditable,
  isSignatureValueEditable,
  LIVE_APPROVE_TOKEN_CODE_SNIPPET,
  LIVE_CHECK_APPROVAL_CODE_SNIPPET,
  LIVE_WRAP_NATIVE_TOKEN_CODE_SNIPPET,
  SIGNATURE_EXAMPLE_CODE_SNIPPET,
} from "./code-examples";
import {
  JsonInspectorPanel,
  type CodeSnippetOptions,
  type JsonContainer,
  type JsonValue,
} from "./json-inspector";
import { OrdersSinkGuideLink } from "./orders-sink-guide-link";

type LivePermitData = NonNullable<
  ReturnType<typeof useSpot>["derivedFormData"]["rePermitData"]
>;

type DeveloperOrderStep =
  | "flow"
  | "check"
  | "sign"
  | "wrap"
  | "approve"
  | "submit"
  | "success";

type StepNavigation = {
  history: DeveloperOrderStep[];
  viewedIndex: number;
};

type StepPresentation = {
  codeSnippet: CodeSnippetOptions;
  data: JsonContainer;
  editable?: boolean;
  explanation: string;
  title: string;
};

type CreatedOrderSummary = {
  id: string;
  status: "Pending";
};

const PLACEHOLDER_ACCOUNT = "0x5555555555555555555555555555555555555555";

const asRecord = (value: JsonValue | undefined) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};

const clonePermitData = (permitData: LivePermitData) =>
  JSON.parse(JSON.stringify(permitData)) as LivePermitData;

function refreshPermitTiming(
  permitData: LivePermitData,
  freshPermitData: LivePermitData,
) {
  const nextPermitData = clonePermitData(permitData);

  nextPermitData.order.nonce = freshPermitData.order.nonce;
  nextPermitData.order.deadline = freshPermitData.order.deadline;
  nextPermitData.order.witness.nonce =
    freshPermitData.order.witness.nonce;
  nextPermitData.order.witness.start =
    freshPermitData.order.witness.start;
  nextPermitData.order.witness.deadline =
    freshPermitData.order.witness.deadline;

  return nextPermitData;
}

function refreshSignatureTiming(
  signatureData: JsonContainer,
  freshPermitData: LivePermitData,
): JsonContainer {
  const root = Array.isArray(signatureData) ? {} : signatureData;
  const message = asRecord(root.message);
  const witness = asRecord(message.witness);

  return JSON.parse(
    JSON.stringify({
      ...root,
      message: {
        ...message,
        nonce: freshPermitData.order.nonce,
        deadline: freshPermitData.order.deadline,
        witness: {
          ...witness,
          nonce: freshPermitData.order.witness.nonce,
          start: freshPermitData.order.witness.start,
          deadline: freshPermitData.order.witness.deadline,
        },
      },
    }),
  ) as JsonContainer;
}

const STEP_ACTION_LABELS: Record<DeveloperOrderStep, string> = {
  flow: "Start with allowance",
  check: "Check allowance",
  wrap: "Wrap token",
  approve: "Approve token",
  sign: "Sign order",
  submit: "Submit order",
  success: "View order",
};

function createSignatureData(
  permitData: LivePermitData,
  partner: string,
  sourceTokenAddress?: string,
): JsonContainer {
  const account = permitData.order.witness.swapper || PLACEHOLDER_ACCOUNT;
  const order = {
    ...permitData.order,
    witness: {
      ...permitData.order.witness,
      swapper: account,
      output: {
        ...permitData.order.witness.output,
        recipient:
          permitData.order.witness.output.recipient || account,
      },
    },
  };

  return JSON.parse(
    JSON.stringify({
      partner,
      sourceTokenAddress,
      message: order,
      domain: permitData.domain,
      primaryType: permitData.primaryType,
      types: permitData.types,
      account,
    }),
  ) as JsonContainer;
}

function applySignatureData(
  permitData: LivePermitData,
  signatureData: JsonContainer,
) {
  const root = Array.isArray(signatureData) ? {} : signatureData;
  const message = asRecord(root.message);
  const permitted = asRecord(message.permitted);
  const witness = asRecord(message.witness);
  const input = asRecord(witness.input);
  const output = asRecord(witness.output);

  return JSON.parse(
    JSON.stringify({
      ...permitData,
      order: {
        ...permitData.order,
        ...message,
        permitted: {
          ...permitData.order.permitted,
          ...permitted,
        },
        witness: {
          ...permitData.order.witness,
          ...witness,
          input: {
            ...permitData.order.witness.input,
            ...input,
          },
          output: {
            ...permitData.order.witness.output,
            ...output,
          },
        },
      },
    }),
  ) as LivePermitData;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Order submission failed.";
}

const LIVE_FLOW_PHASES = [
  { label: "Allowance", effect: "Read only" },
  { label: "Prepare", effect: "Conditional transaction" },
  { label: "Sign", effect: "Wallet signature" },
  { label: "Submit", effect: "HTTP request" },
] as const;

function getPhaseIndex(step: DeveloperOrderStep) {
  if (step === "check") return 0;
  if (step === "wrap" || step === "approve") return 1;
  if (step === "sign") return 2;
  if (step === "submit") return 3;
  if (step === "success") return LIVE_FLOW_PHASES.length;
  return -1;
}

function LiveFlowNotice({
  actualStep,
  createdOrder,
  disabledReason,
  error,
  isReviewing,
  outcome,
  viewedStep,
}: {
  actualStep: DeveloperOrderStep;
  createdOrder?: CreatedOrderSummary;
  disabledReason?: string;
  error?: string;
  isReviewing: boolean;
  outcome?: string;
  viewedStep: DeveloperOrderStep;
}) {
  const actualPhaseIndex = getPhaseIndex(actualStep);
  const viewedPhaseIndex = getPhaseIndex(viewedStep);
  const viewedPhase =
    viewedPhaseIndex >= 0 && viewedPhaseIndex < LIVE_FLOW_PHASES.length
      ? (LIVE_FLOW_PHASES as readonly {
          effect: string;
          label: string;
        }[])[viewedPhaseIndex]
      : undefined;
  const message = createdOrder
    ? undefined
    : error
      ? {
          icon: <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />,
          text: `${error} Try this step again.`,
          tone: "error",
        }
      : disabledReason
        ? {
            icon: <InfoIcon className="mt-0.5 size-3.5 shrink-0" />,
            text: disabledReason,
            tone: "info",
          }
        : isReviewing
          ? {
              icon: <InfoIcon className="mt-0.5 size-3.5 shrink-0" />,
              text: "Reviewing a completed step. Returning will not rerun it.",
              tone: "info",
            }
          : outcome
            ? {
                icon: <CircleCheckIcon className="mt-0.5 size-3.5 shrink-0" />,
                text: outcome,
                tone: "success",
              }
            : undefined;

  return (
    <div className="max-w-[660px] rounded-[12px] border border-border/75 bg-background/35 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
        <span className="text-foreground">
          {viewedStep === "flow"
            ? "Four-phase live flow"
            : viewedStep === "success"
              ? "Order complete"
              : viewedPhase?.label}
        </span>
        <span className="text-muted-foreground">
          {viewedStep === "flow"
            ? "Prepare runs only when needed"
            : viewedStep === "success"
              ? "4 of 4 complete"
              : `Step ${viewedPhaseIndex + 1} of 4 · ${viewedPhase?.effect}`}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5" aria-label="Order creation progress">
        {LIVE_FLOW_PHASES.map((phase, index) => (
          <div key={phase.label}>
            <span
              className={`block h-1 rounded-full ${
                index <= actualPhaseIndex
                  ? "bg-primary"
                  : index === viewedPhaseIndex
                    ? "bg-primary/55"
                    : "bg-secondary"
              }`}
            />
            <span className="mt-1 block truncate text-[9px] text-muted-foreground">
              {phase.label}
            </span>
          </div>
        ))}
      </div>
      {createdOrder ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-emerald-400/10 px-2.5 py-2 text-[11px] text-emerald-300">
          <CircleCheckIcon className="size-3.5 shrink-0" />
          <span className="font-semibold">Order created</span>
          <code className="max-w-full truncate text-[10px] text-foreground">
            {createdOrder.id}
          </code>
          <span>{createdOrder.status}</span>
        </div>
      ) : message ? (
        <div
          className={`mt-2 flex items-start gap-2 text-[11px] leading-4 ${
            message.tone === "error"
              ? "text-destructive"
              : message.tone === "success"
                ? "text-emerald-300"
                : "text-muted-foreground"
          }`}
        >
          {message.icon}
          <span>{message.text}</span>
        </div>
      ) : null}
    </div>
  );
}

function LiveOrderFlowModalContent({
  currentPermitData,
  submitDisabled,
  trigger,
  triggerTooltip = "Open order flow",
}: {
  currentPermitData: LivePermitData;
  submitDisabled?: boolean;
  trigger: ReactElement;
  triggerTooltip?: string;
}) {
  const spot = useSpot();
  const { address: connectedAccount } = useConnection();
  const partner = getActiveSpotPartner() || "unknown";
  const currentSourceToken = spot.derivedFormData.srcToken;
  const { setInputAmount } = useActionHandlers();
  const { mutateAsync: getTokenAllowance } = useGetTokenAllowance();
  const { mutateAsync: wrapNativeToken } = useWrapNativeToken();
  const { mutateAsync: approveToken } = useApproveToken();
  const { mutateAsync: signTypedData } = useSignTypedDataPayload();
  const { mutateAsync: refetchBalances } =
    useRefetchSelectedCurrenciesBalances();
  const setOrderHistoryOpen = useFormTabStore(
    (state) => state.setOrderHistoryOpen,
  );

  const [open, setOpen] = useState(false);
  const [navigation, setNavigation] = useState<StepNavigation>({
    history: ["flow"],
    viewedIndex: 0,
  });
  const [permitData, setPermitData] = useState<LivePermitData>(() =>
    clonePermitData(currentPermitData),
  );
  const [signatureData, setSignatureData] = useState<JsonContainer>(() =>
    createSignatureData(
      currentPermitData,
      partner,
      currentSourceToken?.address,
    ),
  );
  const [sourceIsNative, setSourceIsNative] = useState(false);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [wrapAmount, setWrapAmount] = useState("0");
  const [isRunning, setIsRunning] = useState(false);
  const [orderSignature, setOrderSignature] = useState<Signature>();
  const [createdOrder, setCreatedOrder] = useState<CreatedOrderSummary>();
  const [stepOutcome, setStepOutcome] = useState<string>();
  const [stepError, setStepError] = useState<string>();
  const completedStepsRef = useRef({ wrappedAmount: BigInt(0) });
  const step = navigation.history.at(-1) ?? "flow";
  const viewedStep = navigation.history[navigation.viewedIndex] ?? step;
  const isReviewingPreviousStep =
    navigation.viewedIndex < navigation.history.length - 1;

  useEffect(() => {
    if (!open || isRunning || step === "success") return;

    const refreshTimer = window.setTimeout(() => {
      setPermitData((current) =>
        refreshPermitTiming(current, currentPermitData),
      );
      setSignatureData((current) =>
        refreshSignatureTiming(current, currentPermitData),
      );
    }, 0);

    return () => window.clearTimeout(refreshTimer);
  }, [currentPermitData, isRunning, open, step]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isRunning) return;

      if (nextOpen) {
        const nextPermitData = clonePermitData(currentPermitData);
        setPermitData(nextPermitData);
        setSignatureData(
          createSignatureData(
            nextPermitData,
            partner,
            currentSourceToken?.address,
          ),
        );
        setSourceIsNative(
          isNativeAddress(currentSourceToken?.address ?? ""),
        );
        setNavigation({ history: ["flow"], viewedIndex: 0 });
        setApprovalRequired(false);
        setWrapAmount(nextPermitData.order.permitted.amount);
        setOrderSignature(undefined);
        setCreatedOrder(undefined);
        setStepOutcome(undefined);
        setStepError(undefined);
        completedStepsRef.current = { wrappedAmount: BigInt(0) };
      } else if (step === "success") {
        setInputAmount("");
      }

      setOpen(nextOpen);
    },
    [
      currentPermitData,
      currentSourceToken?.address,
      isRunning,
      partner,
      setInputAmount,
      step,
    ],
  );

  const advanceToStep = useCallback((nextStep: DeveloperOrderStep) => {
    setNavigation((current) => ({
      history: [...current.history, nextStep],
      viewedIndex: current.history.length,
    }));
  }, []);

  const executeCurrentStep = useCallback(async () => {
    if (isRunning || step === "success") return;

    setIsRunning(true);
    setStepError(undefined);

    try {
      if (step === "flow") {
        setWrapAmount(permitData.order.permitted.amount);
        setStepOutcome(undefined);
        advanceToStep("check");
        return;
      }

      if (step === "check") {
        const amount = permitData.order.permitted.amount;
        const tokenAddress = permitData.order.permitted.token;
        const allowance = await getTokenAllowance({
          tokenAddress,
          spenderAddress: permitData.domain.verifyingContract,
        });
        const nextApprovalRequired =
          BigInt(allowance) < BigInt(amount);
        const remainingWrapAmount =
          BigInt(amount) - completedStepsRef.current.wrappedAmount;

        setApprovalRequired(nextApprovalRequired);

        if (sourceIsNative && remainingWrapAmount > BigInt(0)) {
          setWrapAmount(remainingWrapAmount.toString());
          setStepOutcome(
            "Allowance checked. Native input must be wrapped before signing.",
          );
          advanceToStep("wrap");
          return;
        }

        setStepOutcome(
          nextApprovalRequired
            ? "Allowance is insufficient. Token approval is required."
            : "Prepare skipped: the existing allowance is sufficient, so token approval is not required.",
        );
        advanceToStep(nextApprovalRequired ? "approve" : "sign");
        return;
      }

      if (step === "wrap") {
        await wrapNativeToken(wrapAmount);
        completedStepsRef.current.wrappedAmount += BigInt(wrapAmount);
        setStepOutcome(
          approvalRequired
            ? "Native token wrapped. Token approval is still required."
            : "Native token wrapped. Token approval is not required.",
        );
        advanceToStep(approvalRequired ? "approve" : "sign");
        return;
      }

      if (step === "approve") {
        await approveToken({
          amount: maxUint256.toString(),
          spenderAddress: permitData.domain.verifyingContract,
          tokenAddress: permitData.order.permitted.token,
        });
        setApprovalRequired(false);
        setStepOutcome("Token approval confirmed on-chain.");
        advanceToStep("sign");
        return;
      }

      if (step === "sign") {
        const freshPermitData = refreshPermitTiming(
          permitData,
          currentPermitData,
        );
        const freshSignatureData = refreshSignatureTiming(
          signatureData,
          currentPermitData,
        );
        const executionPermitData = applySignatureData(
          freshPermitData,
          freshSignatureData,
        );
        if (
          executionPermitData.order.permitted.amount !==
          permitData.order.permitted.amount
        ) {
          setPermitData(executionPermitData);
          setSignatureData(freshSignatureData);
          setOrderSignature(undefined);
          setStepOutcome(
            "Order amount changed. Allowance and token preparation must be checked again.",
          );
          advanceToStep("check");
          return;
        }

        setPermitData(executionPermitData);
        setSignatureData(freshSignatureData);

        const signatureHex = await signTypedData({
          account: executionPermitData.order.witness.swapper,
          domain: executionPermitData.domain,
          message: executionPermitData.order as unknown as Record<
            string,
            unknown
          >,
          primaryType: executionPermitData.primaryType,
          types: executionPermitData.types,
        });
        const parsedSignature = parseSignature(signatureHex);
        const parsedV =
          parsedSignature.v ??
          BigInt((parsedSignature.yParity ?? 0) + 27);
        const nextSignature: Signature = {
          v: toHex(parsedV),
          r: parsedSignature.r,
          s: parsedSignature.s,
        };

        setOrderSignature(nextSignature);
        setStepOutcome(
          "Wallet signature captured. Review the signed payload before submitting it.",
        );
        advanceToStep("submit");
        return;
      }

      if (step === "submit") {
        if (!orderSignature) {
          throw new Error("Sign the order before submitting it");
        }

        const order = await submitOrder(
          permitData.order,
          orderSignature,
        );

        setCreatedOrder({ id: String(order.id), status: "Pending" });
        setStepOutcome(undefined);
        advanceToStep("success");
        toast.success("Order submitted", {
          description: `Order ${order.id} was created successfully.`,
        });
        void Promise.allSettled([
          spot.orderHistoryPanel.refetchOrders(),
          refetchBalances(),
        ]);
        return;
      }
    } catch (executionError) {
      if (isUserRejectedError(executionError)) {
        setStepError("The wallet request was rejected.");
        showTransactionRejectedToast();
      } else {
        const errorMessage = getErrorMessage(executionError);
        setStepError(errorMessage);
        toast.error("Order step failed", {
          description: errorMessage,
        });
      }
    } finally {
      setIsRunning(false);
    }
  }, [
    advanceToStep,
    approvalRequired,
    approveToken,
    currentPermitData,
    getTokenAllowance,
    isRunning,
    orderSignature,
    permitData,
    refetchBalances,
    signTypedData,
    signatureData,
    sourceIsNative,
    spot.orderHistoryPanel,
    step,
    wrapAmount,
    wrapNativeToken,
  ]);

  const presentation = useMemo<StepPresentation>(() => {
    const tokenAddress = permitData.order.permitted.token;

    if (viewedStep === "flow") {
      return {
        codeSnippet: FULL_ORDER_FLOW_CODE_SNIPPET,
        data: signatureData,
        explanation:
          "Inspect and run the current order in four phases. Allowance is read-only; Prepare appears only when wrapping or approval is needed; Sign opens the wallet; Submit sends the signed order to Orders Sink.",
        title: "Orders Sink live creation flow",
      };
    }

    if (viewedStep === "check") {
      return {
        codeSnippet: LIVE_CHECK_APPROVAL_CODE_SNIPPET,
        data: {
          amount: permitData.order.permitted.amount,
          spender: permitData.domain.verifyingContract,
          tokenAddress,
        } as JsonContainer,
        explanation:
          "Read the current ERC-20 allowance and compare it with the required order amount. This phase is read-only and never opens the wallet or sends a transaction.",
        title: "Check token allowance",
      };
    }

    if (viewedStep === "wrap") {
      return {
        codeSnippet: LIVE_WRAP_NATIVE_TOKEN_CODE_SNIPPET,
        data: { amount: wrapAmount, tokenAddress } as JsonContainer,
        explanation:
          "Deposit the required native amount into its wrapped-token contract. This is an on-chain wallet transaction.",
        title: "Wrap native token",
      };
    }

    if (viewedStep === "approve") {
      return {
        codeSnippet: LIVE_APPROVE_TOKEN_CODE_SNIPPET,
        data: {
          spender: permitData.domain.verifyingContract,
          tokenAddress,
        } as JsonContainer,
        explanation:
          "The allowance check confirmed that approval is required. This on-chain wallet transaction approves basePermitData.domain.verifyingContract as the spender.",
        title: "Approve token",
      };
    }

    if (viewedStep === "sign") {
      return {
        codeSnippet: SIGNATURE_EXAMPLE_CODE_SNIPPET,
        data: signatureData,
        editable:
          !isReviewingPreviousStep && !isRunning,
        explanation:
          "Sign the populated EIP-712 order in the wallet. This produces v, r, and s without sending a blockchain transaction; submission remains a separate next step.",
        title: "Sign order",
      };
    }

    if (viewedStep === "submit" || viewedStep === "success") {
      const signedOrder = JSON.parse(
        JSON.stringify({
          signature: orderSignature ?? {
            v: "<signature-v>",
            r: "<signature-r>",
            s: "<signature-s>",
          },
          order: permitData.order,
          status: "pending",
        }),
      ) as JsonContainer;

      return {
        codeSnippet: CREATE_ORDER_CODE_SNIPPET,
        data: signedOrder,
        explanation:
          viewedStep === "submit"
            ? "Review the signed payload, then POST it to Orders Sink. This phase is an HTTP request and does not open the wallet or send a blockchain transaction."
            : "Orders Sink accepted the signed order. Its identifier and current status remain visible above until you open Order History or close this dialog.",
        title:
          viewedStep === "success" ? "Order created" : "Submit signed order",
      };
    }

    throw new Error(`Unsupported developer order step: ${viewedStep}`);
  }, [
    isRunning,
    orderSignature,
    permitData,
    signatureData,
    isReviewingPreviousStep,
    viewedStep,
    wrapAmount,
  ]);

  const actionLabel = STEP_ACTION_LABELS[step];
  const disabledReason =
    step === "success"
      ? undefined
      : !connectedAccount
        ? "Connect a wallet to run the flow. The code remains safe to inspect and copy with a wallet placeholder."
        : submitDisabled
          ? "Resolve the current form or quote issue before running this step."
          : undefined;
  const guideSection =
    viewedStep === "check" || viewedStep === "approve"
      ? "allowance"
      : viewedStep === "sign"
        ? "sign"
        : viewedStep === "submit" || viewedStep === "success"
          ? "submit"
          : "end-to-end";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>{trigger}</DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>{triggerTooltip}</TooltipContent>
      </Tooltip>
      <DialogContent
        presentation="center"
        mobilePresentation="fullscreen"
        showCloseButton={!isRunning}
        className="h-[min(1040px,98dvh)] max-w-[960px] grid-rows-[minmax(0,1fr)] gap-0 p-0 [&>button[data-slot=dialog-close]]:right-2 [&>button[data-slot=dialog-close]]:top-2 [&>button[data-slot=dialog-close]]:grid [&>button[data-slot=dialog-close]]:size-10 [&>button[data-slot=dialog-close]]:place-items-center"
      >
        <JsonInspectorPanel
          key={`${viewedStep}-${navigation.viewedIndex}`}
          data={presentation.data}
          editable={presentation.editable}
          codeSnippet={presentation.codeSnippet}
          description=""
          explanation={presentation.explanation}
          explanationDisplay="subtitle"
          headerNotice={
            <LiveFlowNotice
              actualStep={step}
              createdOrder={
                viewedStep === "success" ? createdOrder : undefined
              }
              disabledReason={
                !isReviewingPreviousStep ? disabledReason : undefined
              }
              error={!isReviewingPreviousStep ? stepError : undefined}
              isReviewing={isReviewingPreviousStep}
              outcome={!isReviewingPreviousStep ? stepOutcome : undefined}
              viewedStep={viewedStep}
            />
          }
          headerBackAction={
            navigation.viewedIndex > 0 && !isRunning
              ? {
                  ariaLabel: "View previous order step",
                  onClick: () =>
                    setNavigation((current) => ({
                      ...current,
                      viewedIndex: Math.max(0, current.viewedIndex - 1),
                    })),
                }
              : undefined
          }
          getFieldExplanation={
            viewedStep === "sign" ? getSignatureFieldExplanation : undefined
          }
          isValueEditable={
            viewedStep === "sign"
              ? isSignatureValueEditable
              : viewedStep === "approve"
                ? isApprovalValueEditable
                : undefined
          }
          onSave={
            !isReviewingPreviousStep && step === "sign"
              ? (nextSignatureData) =>
                  setSignatureData(
                    refreshSignatureTiming(
                      nextSignatureData,
                      currentPermitData,
                    ),
                  )
              : undefined
          }
          title={presentation.title}
          viewModeAction={
            <div className="flex items-center justify-end gap-2">
              <OrdersSinkGuideLink section={guideSection} />
              <Button
                type="button"
                onClick={() => {
                  if (isReviewingPreviousStep) {
                    setNavigation((current) => ({
                      ...current,
                      viewedIndex: current.history.length - 1,
                    }));
                    return;
                  }

                  if (step === "success") {
                    handleOpenChange(false);
                    setOrderHistoryOpen(true);
                    return;
                  }

                  void executeCurrentStep();
                }}
                disabled={
                  !isReviewingPreviousStep &&
                  step !== "success" &&
                  (Boolean(disabledReason) || isRunning)
                }
                isLoading={!isReviewingPreviousStep && isRunning}
              >
                {!isReviewingPreviousStep && step === "success" && (
                  <CheckIcon className="size-4" />
                )}
                {isReviewingPreviousStep
                  ? "Return to current step"
                  : actionLabel}
              </Button>
            </div>
          }
        />
      </DialogContent>
    </Dialog>
  );
}

export function LiveOrderFlowModal({
  submitDisabled,
  trigger,
  triggerTooltip = "Open order flow",
}: {
  submitDisabled?: boolean;
  trigger: ReactElement;
  triggerTooltip?: string;
}) {
  const spot = useSpot();
  const currentPermitData = spot.derivedFormData.rePermitData;
  const configError = spot.submitOrderButton.error;
  const configLoading = spot.submitOrderButton.loading;
  const retryConfig = spot.submitOrderButton.retry;

  if (!currentPermitData) {
    if (configError) {
      return (
        <Button
          data-developer-trigger
          type="button"
          variant="outline"
          size="lg"
          onClick={() => void retryConfig()}
          className="h-12 rounded-[14px] border-destructive/55 text-destructive hover:border-destructive hover:text-destructive"
        >
          <RefreshCwIcon className="size-4" />
          Retry config
        </Button>
      );
    }

    return (
      <Button
        type="button"
        variant="outline"
        size="lg"
        isLoading={configLoading}
        disabled
        className="h-12 rounded-[14px]"
      >
        Loading config
      </Button>
    );
  }

  return (
    <LiveOrderFlowModalContent
      currentPermitData={currentPermitData}
      submitDisabled={submitDisabled}
      trigger={trigger}
      triggerTooltip={triggerTooltip}
    />
  );
}
