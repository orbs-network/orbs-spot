"use client";

import {
  BracesIcon,
  Code2Icon,
  DatabaseIcon,
  FileSignatureIcon,
  HistoryIcon,
  ShieldCheckIcon,
} from "lucide-react";
import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useState,
} from "react";

import {
  APPROVE_TOKEN_CODE_SNIPPET,
  APPROVE_TOKEN_EXAMPLE_DATA,
  CANCEL_EXAMPLE_CODE_SNIPPET,
  CANCEL_EXAMPLE_DATA,
  CREATE_ORDER_CODE_SNIPPET,
  CREATE_ORDER_EXAMPLE_DATA,
  CREATE_ORDER_EXAMPLE_RESPONSE_DATA,
  CREATE_ORDER_EXAMPLE_URL,
  FETCH_ORDERS_CODE_SNIPPET,
  FETCH_ORDERS_EXAMPLE_DATA,
  FETCH_ORDERS_EXAMPLE_RESPONSE_DATA,
  FETCH_ORDERS_EXAMPLE_URL,
  FULL_ORDER_FLOW_CODE_SNIPPET,
  FULL_ORDER_FLOW_EXAMPLE_DATA,
  getFetchOrdersResponseFieldExplanation,
  getPermitDataFieldExplanation,
  ORDER_TYPES_CODE_SNIPPET,
  ORDER_TYPES_EXAMPLE_DATA,
  PERMIT_CONFIG_CODE_SNIPPET,
  PERMIT_CONFIG_REQUEST_DATA,
  PERMIT_CONFIG_REQUEST_URL,
  PERMIT_CONFIG_SKELETON_DATA,
  SIGNATURE_EXAMPLE_CODE_SNIPPET,
  SIGNATURE_EXAMPLE_DATA,
  WRAP_NATIVE_TOKEN_CODE_SNIPPET,
  WRAP_NATIVE_TOKEN_EXAMPLE_DATA,
} from "./code-examples";
import { JsonInspectorPanel } from "./json-inspector";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type DeveloperExample =
  | "order-types"
  | "full-flow"
  | "permit-config"
  | "wrap-native-token"
  | "approve-token"
  | "signature"
  | "create-order"
  | "fetch-orders"
  | "cancel-order";

type DeveloperFunctionCardProps = {
  functionName: string;
  icon: ReactNode;
  onAction: () => void;
  title: string;
};

function DeveloperFunctionCard({
  functionName,
  icon,
  onAction,
  title,
}: DeveloperFunctionCardProps) {
  return (
    <button
      type="button"
      aria-label={`Open ${title}`}
      onClick={onAction}
      className="flex w-full items-center gap-3 rounded-[14px] border border-border/75 bg-background/25 p-3 text-left transition-colors hover:border-primary/35 hover:bg-primary/6 focus-visible:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="rounded-md bg-secondary/65 px-2 py-1 font-mono text-[10px] text-muted-foreground">
          {functionName}
        </span>
      </div>
    </button>
  );
}

function DeveloperExamplePanel({
  example,
  onBack,
}: {
  example: DeveloperExample;
  onBack: () => void;
}) {
  const headerBackAction = {
    ariaLabel: "Back to Spot integration guide",
    onClick: onBack,
  };

  if (example === "order-types") {
    return (
      <JsonInspectorPanel
        data={ORDER_TYPES_EXAMPLE_DATA}
        codeSnippet={ORDER_TYPES_CODE_SNIPPET}
        description=""
        explanation="A shared order-types.ts helper for the RePermit domain, permit data, signed-order request, and order-service response shapes used throughout the examples."
        headerBackAction={headerBackAction}
        title="Order type helper"
      />
    );
  }

  if (example === "full-flow") {
    return (
      <JsonInspectorPanel
        data={FULL_ORDER_FLOW_EXAMPLE_DATA}
        codeSnippet={FULL_ORDER_FLOW_CODE_SNIPPET}
        description=""
        explanation="A copy-ready submitOrderFlow(sourceTokenAddress, tokenAddress, inputAmount) orchestrator that reuses the wrapNativeToken, checkApproval, approveToken, and signAndCreateOrder helpers from the focused examples. The populated order is built once inside the sign-and-create step, then used for both signing and submission."
        headerBackAction={headerBackAction}
        title="Full create order flow example"
      />
    );
  }

  if (example === "wrap-native-token") {
    return (
      <JsonInspectorPanel
        data={WRAP_NATIVE_TOKEN_EXAMPLE_DATA}
        codeSnippet={WRAP_NATIVE_TOKEN_CODE_SNIPPET}
        description=""
        explanation="A copy-ready wrapNativeToken(amount, tokenAddress) helper using Wagmi and Viem. Pass the wrapped-token address stored in permitData.order.permitted.token; the helper deposits the native amount and waits for confirmation."
        headerBackAction={headerBackAction}
        title="Wrap native token example"
      />
    );
  }

  if (example === "permit-config") {
    return (
      <JsonInspectorPanel
        data={PERMIT_CONFIG_REQUEST_DATA}
        codeSnippet={PERMIT_CONFIG_CODE_SNIPPET}
        curl={{
          method: "GET",
          url: PERMIT_CONFIG_REQUEST_URL,
          headers: { Accept: "application/json" },
        }}
        description=""
        explanation='Shows the GET /config request for QuickSwap on Polygon followed by its unchanged JSON response. Fixed contract fields, the EIP-712 domain, primary type, and types are ready to use; zero-value fields should be populated before signing. If Orbs has not assigned your integration a partner ID, use "unknown" as the partner.'
        getFieldExplanation={getPermitDataFieldExplanation}
        headerBackAction={headerBackAction}
        responseData={PERMIT_CONFIG_SKELETON_DATA}
        responseLabel="Permit skeleton JSON response"
        requestResponseTabs
        tabsInSectionHeader
        title="Get permit data skeleton"
      />
    );
  }

  if (example === "signature") {
    return (
      <JsonInspectorPanel
        data={SIGNATURE_EXAMPLE_DATA}
        codeSnippet={SIGNATURE_EXAMPLE_CODE_SNIPPET}
        description=""
        explanation="A copy-ready signOrder() helper using Wagmi. It reads the populated permit data for the current form and quote, then signs the order directly without passing permit data into the function."
        headerBackAction={headerBackAction}
        title="Order signature example"
      />
    );
  }

  if (example === "approve-token") {
    return (
      <JsonInspectorPanel
        data={APPROVE_TOKEN_EXAMPLE_DATA}
        codeSnippet={APPROVE_TOKEN_CODE_SNIPPET}
        description=""
        explanation="Copy-ready checkApproval(amount, tokenAddress) and approveToken(tokenAddress) helpers using Wagmi and Viem. The connected account comes from useConnection, and the RePermit spender comes from usePermitData()."
        headerBackAction={headerBackAction}
        title="Token approval example"
      />
    );
  }

  if (example === "cancel-order") {
    return (
      <JsonInspectorPanel
        data={CANCEL_EXAMPLE_DATA}
        codeSnippet={CANCEL_EXAMPLE_CODE_SNIPPET}
        description=""
        explanation="A copy-ready cancelOrder(repermitDigest) helper using Wagmi and Viem. The RePermit contract comes from usePermitData(); pass order.metadata.repermitDigest as the digest."
        headerBackAction={headerBackAction}
        title="Cancel order example"
      />
    );
  }

  if (example === "create-order") {
    return (
      <JsonInspectorPanel
        data={CREATE_ORDER_EXAMPLE_DATA}
        codeSnippet={CREATE_ORDER_CODE_SNIPPET}
        curl={{
          method: "POST",
          url: CREATE_ORDER_EXAMPLE_URL,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }}
        description=""
        explanation='A copy-ready createOrder(signature, order) POST request and successful order-service response. Pass the wallet signature as { v, r, s } and the populated PermitOrder; the helper adds status: "pending" and submits the complete signed-order body.'
        getResponseFieldExplanation={getFetchOrdersResponseFieldExplanation}
        headerBackAction={headerBackAction}
        requestResponseTabs
        responseData={CREATE_ORDER_EXAMPLE_RESPONSE_DATA}
        responseLabel="Created order JSON response"
        tabsInSectionHeader
        title="Create order request example"
      />
    );
  }

  return (
    <JsonInspectorPanel
      data={FETCH_ORDERS_EXAMPLE_DATA}
      codeSnippet={FETCH_ORDERS_CODE_SNIPPET}
      curl={{
        method: "GET",
        url: FETCH_ORDERS_EXAMPLE_URL,
        headers: { Accept: "application/json" },
      }}
      description=""
      explanation="A copy-ready TypeScript fetch request populated with a dummy wallet and chain. The exchange address comes from permitData.order.witness.exchange.adapter via usePermitData()."
      getResponseFieldExplanation={getFetchOrdersResponseFieldExplanation}
      headerBackAction={headerBackAction}
      requestResponseTabs
      responseData={FETCH_ORDERS_EXAMPLE_RESPONSE_DATA}
      responseLabel="Orders JSON response"
      tabsInSectionHeader
      title="Fetch orders request example"
    />
  );
}

export function DeveloperToolsModal({
  initiallyOpen = false,
  trigger,
  triggerTooltip = "Open developer tools",
}: {
  initiallyOpen?: boolean;
  trigger: ReactElement;
  triggerTooltip?: string;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [activeExample, setActiveExample] = useState<DeveloperExample>();

  const openExample = useCallback((example: DeveloperExample) => {
    setActiveExample(example);
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setActiveExample(undefined);
  }, []);

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
        className={cn(
          "max-h-[98dvh] max-w-[960px] gap-0 overflow-hidden p-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-screen max-sm:rounded-none max-sm:border-0",
          activeExample
            ? "grid-rows-[minmax(0,1fr)]"
            : "grid-rows-[auto_minmax(0,1fr)]",
        )}
      >
        {activeExample ? (
          <div className="min-h-0 overflow-hidden">
            <DeveloperExamplePanel
              example={activeExample}
              onBack={() => setActiveExample(undefined)}
            />
          </div>
        ) : (
          <>
            <DialogHeader className="border-b border-border/70 px-5 py-5 pr-14 text-left sm:px-6">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-primary/12 text-primary">
                  <Code2Icon className="size-5" />
                </span>
                <DialogTitle className="self-center text-[18px]">
                  Spot integration guide
                </DialogTitle>
              </div>
            </DialogHeader>

            <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="mb-3 flex items-start gap-3 rounded-[14px] border border-primary/20 bg-primary/8 px-4 py-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Code2Icon className="size-3.5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Inspect current data
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Use the developer icon beside Place order, Fetch orders in
                    Order history, or Cancel order to open these tools with the
                    current form, wallet, and order values. The Place order icon
                    appears after an amount is entered.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <DeveloperFunctionCard
                  functionName="order-types.ts"
                  icon={<Code2Icon className="size-5" />}
                  onAction={() => openExample("order-types")}
                  title="Type helper"
                />
                <DeveloperFunctionCard
                  functionName="submitOrderFlow()"
                  icon={<Code2Icon className="size-5" />}
                  onAction={() => openExample("full-flow")}
                  title="Full create order flow"
                />
                <DeveloperFunctionCard
                  functionName="GET /config"
                  icon={<BracesIcon className="size-5" />}
                  onAction={() => openExample("permit-config")}
                  title="Get permit data skeleton"
                />
                <DeveloperFunctionCard
                  functionName="wrapNativeToken()"
                  icon={<Code2Icon className="size-5" />}
                  onAction={() => openExample("wrap-native-token")}
                  title="Wrap native token"
                />
                <DeveloperFunctionCard
                  functionName="allowance() → approve()"
                  icon={<ShieldCheckIcon className="size-5" />}
                  onAction={() => openExample("approve-token")}
                  title="Approve a token"
                />
                <DeveloperFunctionCard
                  functionName="signOrder()"
                  icon={<FileSignatureIcon className="size-5" />}
                  onAction={() => openExample("signature")}
                  title="Sign an order"
                />
                <DeveloperFunctionCard
                  functionName="fetch() · POST"
                  icon={<Code2Icon className="size-5" />}
                  onAction={() => openExample("create-order")}
                  title="Create an order"
                />
                <DeveloperFunctionCard
                  functionName="fetch() · GET"
                  icon={<DatabaseIcon className="size-5" />}
                  onAction={() => openExample("fetch-orders")}
                  title="Fetch orders"
                />
                <DeveloperFunctionCard
                  functionName="cancelOrder()"
                  icon={<HistoryIcon className="size-5" />}
                  onAction={() => openExample("cancel-order")}
                  title="Cancel an order"
                />
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
