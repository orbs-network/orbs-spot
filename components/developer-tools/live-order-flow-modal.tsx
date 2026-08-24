"use client";

import {
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { maxUint256, parseSignature, toHex } from "viem";
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
import { useWrapNativeToken } from "@/lib/hooks/use-wrap";
import {
  isUserRejectedError,
  showTransactionRejectedToast,
} from "@/lib/tx-rejection";

import {
  getSignatureFieldExplanation,
  FULL_ORDER_FLOW_CODE_SNIPPET,
  isApprovalValueEditable,
  isSignatureValueEditable,
  LIVE_APPROVE_TOKEN_CODE_SNIPPET,
  LIVE_CHECK_APPROVAL_CODE_SNIPPET,
  LIVE_CREATE_ORDER_CODE_SNIPPET,
  LIVE_WRAP_NATIVE_TOKEN_CODE_SNIPPET,
} from "./code-examples";
import {
  JsonInspectorPanel,
  type CodeSnippetOptions,
  type JsonContainer,
  type JsonValue,
} from "./json-inspector";

type LivePermitData = ReturnType<
  typeof useSpot
>["derivedFormData"]["rePermitData"];

type DeveloperOrderStep =
  | "flow"
  | "check"
  | "sign"
  | "wrap"
  | "approve"
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
  flow: "Start flow",
  check: "Check approval",
  wrap: "Wrap token",
  approve: "Approve token",
  sign: "Sign and create order",
  success: "Done",
};

function createSignatureData(permitData: LivePermitData): JsonContainer {
  return JSON.parse(
    JSON.stringify({
      message: {
        permitted: {
          token: permitData.order.permitted.token,
          amount: permitData.order.permitted.amount,
        },
        nonce: permitData.order.nonce,
        deadline: permitData.order.deadline,
        witness: {
          swapper: permitData.order.witness.swapper,
          nonce: permitData.order.witness.nonce,
          start: permitData.order.witness.start,
          deadline: permitData.order.witness.deadline,
          chainid: permitData.order.witness.chainid,
          exclusivity: permitData.order.witness.exclusivity,
          epoch: permitData.order.witness.epoch,
          slippage: permitData.order.witness.slippage,
          freshness: permitData.order.witness.freshness,
          input: {
            token: permitData.order.witness.input.token,
            amount: permitData.order.witness.input.amount,
            maxAmount: permitData.order.witness.input.maxAmount,
          },
          output: {
            token: permitData.order.witness.output.token,
            limit: permitData.order.witness.output.limit,
            triggerLower: permitData.order.witness.output.triggerLower,
            triggerUpper: permitData.order.witness.output.triggerUpper,
            recipient: permitData.order.witness.output.recipient,
          },
        },
      },
      domain: permitData.domain,
      primaryType: permitData.primaryType,
      types: permitData.types,
      account: permitData.order.witness.swapper,
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
  const currentSourceToken = spot.derivedFormData.srcToken;
  const { setInputAmount } = useActionHandlers();
  const { mutateAsync: getTokenAllowance } = useGetTokenAllowance();
  const { mutateAsync: wrapNativeToken } = useWrapNativeToken();
  const { mutateAsync: approveToken } = useApproveToken();
  const { mutateAsync: signTypedData } = useSignTypedDataPayload();
  const { mutateAsync: refetchBalances } =
    useRefetchSelectedCurrenciesBalances();

  const [open, setOpen] = useState(false);
  const [navigation, setNavigation] = useState<StepNavigation>({
    history: ["flow"],
    viewedIndex: 0,
  });
  const [permitData, setPermitData] = useState<LivePermitData>(() =>
    clonePermitData(currentPermitData),
  );
  const [signatureData, setSignatureData] = useState<JsonContainer>(() =>
    createSignatureData(currentPermitData),
  );
  const [sourceIsNative, setSourceIsNative] = useState(false);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [wrapAmount, setWrapAmount] = useState("0");
  const [isRunning, setIsRunning] = useState(false);
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
        setSignatureData(createSignatureData(nextPermitData));
        setSourceIsNative(
          isNativeAddress(currentSourceToken?.address ?? ""),
        );
        setNavigation({ history: ["flow"], viewedIndex: 0 });
        setApprovalRequired(false);
        setWrapAmount(nextPermitData.order.permitted.amount);
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

    try {
      if (step === "flow") {
        setWrapAmount(permitData.order.permitted.amount);
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
          advanceToStep("wrap");
          return;
        }

        advanceToStep(nextApprovalRequired ? "approve" : "sign");
        return;
      }

      if (step === "wrap") {
        await wrapNativeToken(wrapAmount);
        completedStepsRef.current.wrappedAmount += BigInt(wrapAmount);
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

        const order = await submitOrder(
          executionPermitData.order,
          nextSignature,
        );

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
        showTransactionRejectedToast();
      } else {
        toast.error("Order step failed", {
          description: getErrorMessage(executionError),
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
          "Start the flow, then review and run one exact snippet at a time: check approval, approve if needed, then sign and create the order in one action. Native wrapping appears as an additional step when required.",
        title: "Full live create order flow",
      };
    }

    if (viewedStep === "check") {
      return {
        codeSnippet: LIVE_CHECK_APPROVAL_CODE_SNIPPET,
        data: {
          amount: permitData.order.permitted.amount,
          tokenAddress,
        } as JsonContainer,
        explanation:
          "Read the current ERC-20 allowance and compare it with the required order amount. This step only checks approval; it never sends a transaction.",
        title: "Check approval",
      };
    }

    if (viewedStep === "wrap") {
      return {
        codeSnippet: LIVE_WRAP_NATIVE_TOKEN_CODE_SNIPPET,
        data: { amount: wrapAmount, tokenAddress } as JsonContainer,
        explanation:
          "This is the wrapped-native-token deposit for the current order. Run this step, review the next snippet, and click again to continue.",
        title: "Wrap native token",
      };
    }

    if (viewedStep === "approve") {
      return {
        codeSnippet: LIVE_APPROVE_TOKEN_CODE_SNIPPET,
        data: { tokenAddress } as JsonContainer,
        explanation:
          "The allowance check confirmed that approval is required. This call approves permitData.domain.verifyingContract to spend the current source token.",
        title: "Approve token",
      };
    }

    if (viewedStep === "sign" || viewedStep === "success") {
      return {
        codeSnippet: LIVE_CREATE_ORDER_CODE_SNIPPET,
        data: signatureData,
        editable:
          viewedStep === "sign" &&
          !isReviewingPreviousStep &&
          !isRunning,
        explanation:
          viewedStep === "sign"
            ? "One action signs the populated EIP-712 order, converts the wallet result to v, r, and s, then immediately passes that signature and the exact same message to createOrder()."
            : "The populated order was signed and submitted in one step. The create-order.ts tab shows the complete request implementation.",
        title:
          viewedStep === "success"
            ? "Order created"
            : "Sign and create order",
      };
    }

    throw new Error(`Unsupported developer order step: ${viewedStep}`);
  }, [
    isRunning,
    permitData,
    signatureData,
    isReviewingPreviousStep,
    viewedStep,
    wrapAmount,
  ]);

  const actionLabel = STEP_ACTION_LABELS[step];

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
        className="h-[min(1040px,98dvh)] max-w-[960px] grid-rows-[minmax(0,1fr)] gap-0 p-0"
      >
        <JsonInspectorPanel
          key={`${viewedStep}-${navigation.viewedIndex}`}
          data={presentation.data}
          editable={presentation.editable}
          codeSnippet={presentation.codeSnippet}
          description=""
          explanation={presentation.explanation}
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
            <div className="flex items-center justify-end">
              <Button
                type="button"
                onClick={() =>
                  isReviewingPreviousStep
                    ? setNavigation((current) => ({
                        ...current,
                        viewedIndex: current.history.length - 1,
                      }))
                    : step === "success"
                      ? handleOpenChange(false)
                      : void executeCurrentStep()
                }
                disabled={
                  !isReviewingPreviousStep &&
                  step !== "success" &&
                  (submitDisabled || isRunning)
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
