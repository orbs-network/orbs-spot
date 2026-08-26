"use client";

import {
  type ReactElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckIcon,
  RefreshCwIcon,
} from "lucide-react";
import { toast } from "sonner";
import { maxUint256, type Hex } from "viem";
import { useConnection } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  isNativeAddress,
  submitOrder,
  useSpot,
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
import { useWrapNativeToken } from "@/lib/hooks/use-wrap";
import { getActiveSpotPartner } from "@/lib/partners/spot";
import {
  isUserRejectedError,
  showTransactionRejectedToast,
} from "@/lib/tx-rejection";

import {
  CREATE_ORDER_CODE_SNIPPET,
  CREATED_ORDER_CODE_SNIPPET,
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

// The SDK runtime forwards this value unchanged, but the installed declaration
// still describes the legacy v/r/s object. Keep that compatibility detail at
// this boundary while the app and API use the regular EIP-712 hex signature.
const submitOrderWithEip712Signature = submitOrder as unknown as (
  order: Parameters<typeof submitOrder>[0],
  signature: Hex,
) => ReturnType<typeof submitOrder>;

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
  data: JsonContainer;
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
  flow: "Start",
  check: "Check allowance",
  wrap: "Wrap token",
  approve: "Approve token",
  sign: "Sign order",
  submit: "Submit order",
  success: "View order",
};

const STEP_LOADING_MESSAGES: Record<
  Exclude<DeveloperOrderStep, "success">,
  string
> = {
  flow: "Starting the order flow…",
  check: "Reading the current token allowance…",
  wrap: "Waiting for the native-token wrap transaction…",
  approve: "Waiting for the token approval transaction…",
  sign: "Waiting for the wallet signature…",
  submit: "Sending the signed order to Orders Sink…",
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
  const chainId =
    typeof witness.chainid === "number" ||
    typeof witness.chainid === "string"
      ? witness.chainid
      : permitData.order.witness.chainid;
  const tokenAddress =
    typeof permitted.token === "string"
      ? permitted.token
      : permitData.order.permitted.token;
  const inputTokenAddress =
    typeof input.token === "string"
      ? input.token
      : permitData.order.witness.input.token;
  const requiredAmount =
    typeof permitted.amount === "string" ||
    typeof permitted.amount === "number"
      ? permitted.amount
      : permitData.order.permitted.amount;

  return JSON.parse(
    JSON.stringify({
      ...permitData,
      order: {
        ...permitData.order,
        ...message,
        permitted: {
          ...permitData.order.permitted,
          ...permitted,
          token: tokenAddress,
          amount: requiredAmount,
        },
        witness: {
          ...permitData.order.witness,
          ...witness,
          chainid: chainId,
          input: {
            ...permitData.order.witness.input,
            ...input,
            token: inputTokenAddress,
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

type LiveFlowPhase = {
  effect: string;
  label: string;
  step: Exclude<DeveloperOrderStep, "flow" | "success">;
};

const ALLOWANCE_PHASE: LiveFlowPhase = {
  label: "Allowance",
  effect: "Read only",
  step: "check",
};
const WRAP_PHASE: LiveFlowPhase = {
  label: "Wrap",
  effect: "Wallet transaction",
  step: "wrap",
};
const APPROVE_PHASE: LiveFlowPhase = {
  label: "Approve",
  effect: "Wallet transaction",
  step: "approve",
};
const SIGN_PHASE: LiveFlowPhase = {
  label: "Sign",
  effect: "Wallet signature",
  step: "sign",
};
const SUBMIT_PHASE: LiveFlowPhase = {
  label: "Submit",
  effect: "HTTP request",
  step: "submit",
};

function getPhaseIndex(
  step: DeveloperOrderStep,
  phases: readonly LiveFlowPhase[],
) {
  if (step === "success") return phases.length;
  return phases.findIndex((phase) => phase.step === step);
}

function LiveFlowNotice({
  actualStep,
  onSelectPhase,
  phases,
  selectablePhaseIndexes,
  viewedStep,
}: {
  actualStep: DeveloperOrderStep;
  onSelectPhase: (phaseIndex: number) => void;
  phases: readonly LiveFlowPhase[];
  selectablePhaseIndexes: readonly number[];
  viewedStep: DeveloperOrderStep;
}) {
  const actualPhaseIndex = getPhaseIndex(actualStep, phases);
  const viewedPhaseIndex = getPhaseIndex(viewedStep, phases);
  const viewedPhase =
    viewedPhaseIndex >= 0 && viewedPhaseIndex < phases.length
      ? phases[viewedPhaseIndex]
      : undefined;

  return (
    <div className="pointer-events-auto w-[360px] max-w-[calc(100vw-2rem)] rounded-[14px] border border-border/80 bg-card/95 px-3 py-2.5 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
        <span className="text-foreground">
          {viewedStep === "flow"
            ? "Live order flow"
            : viewedStep === "success"
              ? "Order complete"
              : viewedPhase?.label}
        </span>
        <span className="text-muted-foreground">
          {viewedStep === "flow"
            ? "Wrap / Approve appear only if needed"
            : viewedStep === "success"
              ? `${phases.length} of ${phases.length} complete`
              : `Step ${viewedPhaseIndex + 1} of ${phases.length} · ${viewedPhase?.effect}`}
        </span>
      </div>
      <div
        className="mt-2 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}
        aria-label="Order creation progress"
      >
        {phases.map((phase, index) => {
          const canSelect = selectablePhaseIndexes.includes(index);

          return (
            <button
              key={phase.label}
              type="button"
              disabled={!canSelect}
              onClick={() => onSelectPhase(index)}
              aria-label={
                canSelect
                  ? `View ${phase.label} step`
                  : `${phase.label} step is not available yet`
              }
              aria-current={index === viewedPhaseIndex ? "step" : undefined}
              className={`rounded-md border px-1.5 py-1 text-left transition-colors disabled:cursor-default ${
                index === viewedPhaseIndex
                  ? "border-primary/40 bg-primary/10"
                  : canSelect
                    ? "border-transparent hover:border-primary/25 hover:bg-primary/[0.06]"
                    : "border-transparent"
              }`}
            >
              <span
                className={`block h-1 rounded-full ${
                  index <= actualPhaseIndex
                    ? "bg-primary"
                    : index === viewedPhaseIndex
                      ? "bg-primary/55"
                      : "bg-secondary"
                }`}
              />
              <span
                className={`mt-1 block truncate text-[9px] ${
                  index === viewedPhaseIndex
                    ? "font-semibold text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {phase.label}
              </span>
            </button>
          );
        })}
      </div>
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
  const flowToastId = useId();
  const actionToastId = useId();
  const { address: connectedAccount } = useConnection();
  const { openConnectModal } = useConnectModal();
  const partner = getActiveSpotPartner() || "unknown";
  const currentSourceToken = spot.derivedFormData.srcToken;
  const { setInputAmount } = useActionHandlers();
  const { mutateAsync: getTokenAllowance } = useGetTokenAllowance();
  const { mutateAsync: wrapNativeToken } = useWrapNativeToken();
  const { mutateAsync: approveToken } = useApproveToken();
  const { mutateAsync: signTypedData } = useSignTypedDataPayload();
  const { mutateAsync: refetchBalances } =
    useRefetchSelectedCurrenciesBalances();
  const dexDerivedSignatureData = useMemo(
    () =>
      createSignatureData(
        currentPermitData,
        partner,
        currentSourceToken?.address,
      ),
    [currentPermitData, currentSourceToken?.address, partner],
  );

  const [open, setOpen] = useState(false);
  const [triggerTooltipOpen, setTriggerTooltipOpen] = useState(false);
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
  const [orderSignature, setOrderSignature] = useState<Hex>();
  const [createdOrder, setCreatedOrder] = useState<CreatedOrderSummary>();
  const [showCreatedOrder, setShowCreatedOrder] = useState(false);
  const completedStepsRef = useRef({ wrappedAmount: BigInt(0) });
  const suppressTriggerTooltipRef = useRef(false);
  const step = navigation.history.at(-1) ?? "flow";
  const viewedStep = navigation.history[navigation.viewedIndex] ?? step;
  const isReviewingPreviousStep =
    navigation.viewedIndex < navigation.history.length - 1;
  const liveFlowPhases = useMemo(() => {
    const visitedSteps = new Set(navigation.history);
    const phases: LiveFlowPhase[] = [ALLOWANCE_PHASE];

    if (sourceIsNative || visitedSteps.has("wrap")) {
      phases.push(WRAP_PHASE);
    }
    if (visitedSteps.has("approve")) {
      phases.push(APPROVE_PHASE);
    }
    phases.push(SIGN_PHASE, SUBMIT_PHASE);

    return phases;
  }, [navigation.history, sourceIsNative]);

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

  const handleTriggerTooltipOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen && suppressTriggerTooltipRef.current) return;

      setTriggerTooltipOpen(nextOpen);
    },
    [],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen && isRunning) return;

      setTriggerTooltipOpen(false);

      if (!nextOpen) {
        suppressTriggerTooltipRef.current = true;
      }

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
        setNavigation({
          history: ["flow"],
          viewedIndex: 0,
        });
        setApprovalRequired(false);
        setWrapAmount(nextPermitData.order.permitted.amount);
        setOrderSignature(undefined);
        setCreatedOrder(undefined);
        setShowCreatedOrder(false);
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
    toast.loading(STEP_LOADING_MESSAGES[step], {
      id: actionToastId,
      position: "bottom-right",
    });

    try {
      if (step === "flow") {
        setWrapAmount(permitData.order.permitted.amount);
        advanceToStep("check");
        toast.success("Order flow started", {
          id: actionToastId,
          description: "Next, check the current token allowance.",
          position: "bottom-right",
        });
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
          advanceToStep("wrap");
          toast.success("Allowance checked", {
            id: actionToastId,
            description: "Native input must be wrapped before signing.",
            position: "bottom-right",
          });
          return;
        }

        const allowanceOutcome = nextApprovalRequired
          ? "Allowance is insufficient. Token approval is required."
          : "The existing allowance is sufficient; approval is skipped.";
        advanceToStep(nextApprovalRequired ? "approve" : "sign");
        toast.success("Allowance checked", {
          id: actionToastId,
          description: allowanceOutcome,
          position: "bottom-right",
        });
        return;
      }

      if (step === "wrap") {
        await wrapNativeToken(wrapAmount);
        completedStepsRef.current.wrappedAmount += BigInt(wrapAmount);
        advanceToStep(approvalRequired ? "approve" : "sign");
        toast.success("Native token wrapped", {
          id: actionToastId,
          description: approvalRequired
            ? "Token approval is still required."
            : "The order is ready to sign.",
          position: "bottom-right",
        });
        return;
      }

      if (step === "approve") {
        await approveToken({
          amount: maxUint256.toString(),
          spenderAddress: permitData.domain.verifyingContract,
          tokenAddress: permitData.order.permitted.token,
        });
        setApprovalRequired(false);
        advanceToStep("sign");
        toast.success("Token approved", {
          id: actionToastId,
          description: "The approval transaction was confirmed on-chain.",
          position: "bottom-right",
        });
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
          advanceToStep("check");
          toast.success("Order inputs refreshed", {
            id: actionToastId,
            description:
              "The amount changed, so allowance must be checked again before signing.",
            position: "bottom-right",
          });
          return;
        }

        setPermitData(executionPermitData);
        setSignatureData(freshSignatureData);

        const signature = await signTypedData({
          account: executionPermitData.order.witness.swapper,
          domain: executionPermitData.domain,
          message: executionPermitData.order as unknown as Record<
            string,
            unknown
          >,
          primaryType: executionPermitData.primaryType,
          types: executionPermitData.types,
        });

        // Preserve the complete 65-byte EIP-712 signature returned by the wallet.
        setOrderSignature(signature);
        advanceToStep("submit");
        toast.success("Order signed", {
          id: actionToastId,
          description: "Review the signed payload before submitting it.",
          position: "bottom-right",
        });
        return;
      }

      if (step === "submit") {
        if (!orderSignature) {
          throw new Error("Sign the order before submitting it");
        }

        const order = await submitOrderWithEip712Signature(
          permitData.order,
          orderSignature,
        );

        setCreatedOrder({
          data: JSON.parse(JSON.stringify(order)) as JsonContainer,
          id: String(order.id),
          status: "Pending",
        });
        setShowCreatedOrder(false);
        advanceToStep("success");
        toast.success("Order submitted", {
          id: actionToastId,
          description: `Order ${order.id} was created successfully.`,
          position: "bottom-right",
        });
        void Promise.allSettled([
          spot.orderHistoryPanel.refetchOrders(),
          refetchBalances(),
        ]);
        return;
      }
    } catch (executionError) {
      if (isUserRejectedError(executionError)) {
        showTransactionRejectedToast({
          id: actionToastId,
          position: "bottom-right",
        });
      } else {
        const errorMessage = getErrorMessage(executionError);
        toast.error("Order step failed", {
          id: actionToastId,
          description: errorMessage,
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

  const handleSaveSignSnippet = useCallback(
    (nextSignatureData: JsonContainer) => {
      const refreshedSignatureData = refreshSignatureTiming(
        nextSignatureData,
        currentPermitData,
      );
      const nextPermitData = applySignatureData(
        permitData,
        refreshedSignatureData,
      );

      setSignatureData(refreshedSignatureData);
      setPermitData(nextPermitData);
      setWrapAmount(nextPermitData.order.permitted.amount);
      setOrderSignature(undefined);
    },
    [currentPermitData, permitData],
  );

  const presentation = useMemo<StepPresentation>(() => {
    const tokenAddress = permitData.order.permitted.token;

    if (viewedStep === "flow") {
      return {
        codeSnippet: FULL_ORDER_FLOW_CODE_SNIPPET,
        data: signatureData,
        explanation:
          "Run the current order from allowance through signing and submission. Wrap and Approve appear as separate steps only when those wallet transactions are required.",
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
          "Sign the populated EIP-712 order in the wallet. This produces one standard hex signature without sending a blockchain transaction; submission remains a separate next step.",
        title: "Sign order",
      };
    }

    if (viewedStep === "success" && showCreatedOrder && createdOrder) {
      return {
        codeSnippet: CREATED_ORDER_CODE_SNIPPET,
        data: createdOrder.data,
        explanation:
          "This is the actual order record returned by Orders Sink, including its service-managed ID, metadata, digest, and timestamps.",
        title: "Created order response",
      };
    }

    if (viewedStep === "submit" || viewedStep === "success") {
      const signedOrder = JSON.parse(
        JSON.stringify({
          signature:
            orderSignature ?? "0x<65-byte-eip-712-signature>",
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
    createdOrder,
    isRunning,
    orderSignature,
    permitData,
    showCreatedOrder,
    signatureData,
    isReviewingPreviousStep,
    viewedStep,
    wrapAmount,
  ]);

  const actionLabel =
    step === "success" && showCreatedOrder
      ? "Close"
      : STEP_ACTION_LABELS[step];
  const disabledReason =
    step === "success"
      ? undefined
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
  const selectablePhaseIndexes = useMemo(
    () =>
      isRunning
        ? []
        : Array.from(
            new Set(
              navigation.history
                .map((historyStep) =>
                  getPhaseIndex(historyStep, liveFlowPhases),
                )
                .filter(
                  (phaseIndex) =>
                    phaseIndex >= 0 &&
                    phaseIndex < liveFlowPhases.length,
                ),
            ),
          ),
    [isRunning, liveFlowPhases, navigation.history],
  );
  const handleSelectPhase = useCallback(
    (phaseIndex: number) => {
      if (isRunning) return;

      setNavigation((current) => {
        let targetIndex = -1;
        current.history.forEach((historyStep, historyIndex) => {
          if (
            getPhaseIndex(historyStep, liveFlowPhases) === phaseIndex
          ) {
            targetIndex = historyIndex;
          }
        });

        return targetIndex < 0
          ? current
          : {
              ...current,
              viewedIndex: targetIndex,
            };
      });
    },
    [isRunning, liveFlowPhases],
  );

  useEffect(() => {
    if (!open) {
      toast.dismiss(flowToastId);
      return;
    }

    toast.custom(
      () => (
        <LiveFlowNotice
          actualStep={step}
          onSelectPhase={handleSelectPhase}
          phases={liveFlowPhases}
          selectablePhaseIndexes={selectablePhaseIndexes}
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
    step,
    selectablePhaseIndexes,
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
        <TooltipContent>{triggerTooltip}</TooltipContent>
      </Tooltip>
      <DialogContent
        presentation="center"
        mobilePresentation="fullscreen"
        onInteractOutside={(event) => event.preventDefault()}
        showCloseButton
        className="h-[min(1040px,98dvh)] max-w-[960px] grid-rows-[minmax(0,1fr)] gap-0 p-0 [&>button[data-slot=dialog-close]]:right-2 [&>button[data-slot=dialog-close]]:top-2 [&>button[data-slot=dialog-close]]:grid [&>button[data-slot=dialog-close]]:size-12 [&>button[data-slot=dialog-close]]:place-items-center [&>button[data-slot=dialog-close]>svg]:size-6"
      >
        <div className="h-full min-h-0 overflow-hidden">
          <JsonInspectorPanel
            data={presentation.data}
            editable={presentation.editable}
            codeSnippet={presentation.codeSnippet}
            codeScrollResetKey={viewedStep}
            codeSnippetState={
              isReviewingPreviousStep ? "review" : "active"
            }
            description=""
            explanation={presentation.explanation}
            explanationDisplay="tooltip"
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
              viewedStep === "sign"
                ? getSignatureFieldExplanation
                : undefined
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
                ? handleSaveSignSnippet
                : undefined
            }
            resetData={
              viewedStep === "sign"
                ? dexDerivedSignatureData
                : undefined
            }
            title={presentation.title}
            viewModeAction={
              <div className="flex w-full flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <OrdersSinkGuideLink section={guideSection} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                  >
                    Close
                  </Button>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {!connectedAccount ? (
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
                        if (isReviewingPreviousStep) {
                          setNavigation((current) => ({
                            ...current,
                            viewedIndex: current.history.length - 1,
                          }));
                          return;
                        }

                        if (step === "success") {
                          if (!showCreatedOrder) {
                            setShowCreatedOrder(true);
                            return;
                          }

                          handleOpenChange(false);
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
                        <CheckIcon aria-hidden="true" className="size-4" />
                      )}
                      {isReviewingPreviousStep
                        ? "Return to current step"
                        : actionLabel}
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
          <RefreshCwIcon aria-hidden="true" className="size-4" />
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
