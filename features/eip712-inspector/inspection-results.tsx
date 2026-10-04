"use client";

import { useRef, type ReactNode } from "react";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  InfoIcon,
  Clock3Icon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SUPPORTED_CHAINS } from "@/lib/consts";
import { SIGNATURE_FIELD_EXPLANATIONS } from "@/features/developer-tools/eip712-field-explanations";
import { record, type Check, type Inspection, type TokenInfo } from "./inspect";
import { duration, orderValues } from "./order-values";
import { useOrderTokens } from "./use-order-tokens";
import { HelpLabel, LoadingValue, TokenAddress } from "./preview-primitives";

function CheckRow({ check }: { check: Check }) {
  const Icon =
    check.status === "pass"
      ? CheckCircle2Icon
      : check.status === "fail"
        ? CircleAlertIcon
        : InfoIcon;
  return (
    <div className="flex gap-3 py-3">
      <Icon
        aria-hidden="true"
        className={`mt-0.5 size-4 shrink-0 ${check.status === "fail" ? "text-destructive" : "text-primary"}`}
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          <span className="sr-only">{check.status}: </span>
          {check.label}
        </p>
        <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
          {check.detail}
        </p>
      </div>
    </div>
  );
}
function Detail({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid items-center gap-1 py-3 sm:grid-cols-[240px_minmax(0,1fr)] sm:gap-6">
      <dt className="text-sm text-muted-foreground">
        <HelpLabel label={label} hint={hint} />
      </dt>
      <dd className="min-w-0 break-words text-sm font-medium tabular-nums sm:text-right">
        {children}
      </dd>
    </div>
  );
}
function time(raw: unknown): string {
  const value = Number(raw) * 1000;
  return Number.isFinite(value) && value <= 8.64e15
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "long",
      })
    : "Not available";
}
function FieldTree({
  value,
  path,
  isOrder,
  amounts,
  loading = false,
}: {
  value: unknown;
  path: string;
  isOrder: boolean;
  amounts?: Record<string, string>;
  loading?: boolean;
}) {
  if (value !== null && typeof value === "object" && !Array.isArray(value))
    return (
      <div className="ml-2 border-l border-border pl-3">
        {Object.entries(value).map(([key, child]) => (
          <FieldTree
            key={key}
            value={child}
            path={`${path}.${key}`}
            isOrder={isOrder}
            amounts={amounts}
            loading={loading}
          />
        ))}
      </div>
    );
  const explanation =
    isOrder || path.startsWith("domain.")
      ? SIGNATURE_FIELD_EXPLANATIONS[path]
      : undefined;
  return (
    <div className="min-w-0 py-2.5">
      <p className="break-all font-mono text-xs text-muted-foreground">
        {path}
      </p>
      <div className="mt-1 break-all font-mono text-xs">
        <LoadingValue loading={loading && amounts?.[path] === "—"} className="h-4 w-32">
        {amounts?.[path] ??
          (typeof value === "object" ? JSON.stringify(value) : String(value))}
        </LoadingValue>
      </div>
      {explanation && (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {amounts?.[path]
            ? explanation.replace(", in the token's smallest unit", "")
            : explanation}
        </p>
      )}
    </div>
  );
}
export function InspectionResults({
  result,
  tokens,
}: {
  result: Inspection;
  tokens: TokenInfo[];
}) {
  const technicalTitleRef = useRef<HTMLHeadingElement>(null);
  const metadata = useOrderTokens(
    result.isOrder ? result.payload : undefined,
    tokens,
  );
  const order =
    result.isOrder && result.payload
      ? orderValues(result.payload, metadata.tokens)
      : undefined;
  const permitted = record(result.payload?.message.permitted);
  const amounts = order
    ? {
        "message.permitted.amount": order.amount(
          permitted.amount,
          metadata.tokens.find(
            (token) =>
              token.address.toLowerCase() ===
              String(permitted.token).toLowerCase(),
          ),
        ),
        "message.witness.input.amount": order.inputPerTrade,
        "message.witness.input.maxAmount": order.totalInput,
        "message.witness.output.limit": order.amount(
          order.output.limit,
          order.outputToken,
        ),
        "message.witness.output.triggerLower": order.amount(
          order.output.triggerLower,
          order.outputToken,
        ),
        "message.witness.output.triggerUpper": order.amount(
          order.output.triggerUpper,
          order.outputToken,
        ),
      }
    : undefined;
  const failures = result.checks.filter((check) => check.status === "fail");
  const comparison = result.checks.find(
    (check) => check.label === "Payload matches order",
  );
  const chain = SUPPORTED_CHAINS.find(
    (item) => BigInt(item.id) === result.payload?.domain.chainId,
  );
  const inputLoading = metadata.isLoading && !order?.inputToken;
  const outputLoading = metadata.isLoading && !order?.outputToken;
  const priceLoading = inputLoading || outputLoading;
  return (
    <div className="min-w-0 space-y-5">
      {failures.length > 0 && (
        <section
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-3"
        >
          <h2 className="pt-2 font-semibold">Check these order details</h2>
          {failures.map((check) => (
            <CheckRow key={check.label} check={check} />
          ))}
        </section>
      )}
      {order && (
        <>
          <section className="overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4 sm:px-6">
              <h2 className="flex items-center gap-2.5 font-semibold">
                <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
                {order.kind}
              </h2>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                {chain?.name ??
                  `Chain ${String(result.payload?.domain.chainId ?? "not specified")}`}
              </span>
            </div>
            <div className="grid items-start gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-5 sm:p-7">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  <HelpLabel
                    label={order.split ? "Total to sell" : "You sell"}
                    hint="The total amount of your input token allocated to this order, across all trades. Rounded values are marked with ≈; exact values are in the order data."
                  />
                </p>
                <div className="mt-3 break-words text-3xl font-semibold tabular-nums tracking-tight">
                  <LoadingValue loading={inputLoading} className="h-9 w-48">
                    {order.totalInput}
                  </LoadingValue>
                </div>
                <div className="mt-2">
                  <TokenAddress address={order.input.token} />
                </div>
              </div>
              <div className="flex size-9 items-center justify-center rounded-full border border-border bg-background sm:mt-11">
                <ArrowRightIcon
                  aria-hidden="true"
                  className="size-4 rotate-90 text-muted-foreground sm:rotate-0"
                />
              </div>
              <div className="min-w-0 rounded-xl bg-primary/5 p-4 ring-1 ring-inset ring-primary/10 sm:-m-4">
                <p className="text-sm text-muted-foreground">
                  <HelpLabel
                    label={order.hasLimit ? "Minimum received for full order" : "You receive"}
                    hint={order.hasLimit
                      ? "The minimum output for the entire order at your limit price, including a proportionally smaller final trade. This assumes the entire order executes. Rounded values are marked with ≈."
                      : "The output depends on the market price when each trade executes and your price-protection setting."}
                  />
                </p>
                <div className="mt-3 break-words text-3xl font-semibold tabular-nums tracking-tight">
                  <LoadingValue loading={outputLoading} className="h-9 w-48">
                    {order.hasLimit
                      ? order.minimumOutput
                      : (order.outputToken?.symbol ?? "Output token")}
                  </LoadingValue>
                </div>
                <div className="mt-2">
                  <TokenAddress address={order.output.token} />
                </div>
                {order.hasLimit && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    If the entire order executes.
                  </p>
                )}
                {!order.hasLimit && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    At market price, subject to price protection.
                  </p>
                )}
              </div>
            </div>
            {metadata.isLoading && (
              <p
                role="status"
                className="border-t border-border px-5 py-3 text-xs text-muted-foreground"
              >
                Loading token details…
              </p>
            )}
            {metadata.isUnavailable && (
              <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3">
                <p
                  role="status"
                  className="flex-1 text-xs text-muted-foreground"
                >
                  Token amounts could not be loaded
                  {metadata.canRetry ? "." : " for this network."}
                </p>
                {metadata.canRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={metadata.isLoading}
                    onClick={metadata.retry}
                  >
                    Retry token details
                  </Button>
                )}
              </div>
            )}
          </section>
          <section className="rounded-2xl border border-border bg-card px-5 py-2 sm:px-6">
            <h2 className="flex items-center gap-2 pt-4 text-sm font-semibold">
              <SlidersHorizontalIcon aria-hidden="true" className="size-4 text-primary" />
              Trade setup
            </h2>
            <dl className="mt-2 divide-y divide-border">
              {order.hasLimit && (
                <Detail
                  label="Limit price"
                  hint="The minimum number of output tokens per input token. Trades can execute when this rate or better is available."
                >
                  <LoadingValue loading={priceLoading}>
                    {order.price(order.output.limit) ?? "—"}
                  </LoadingValue>
                </Detail>
              )}
              {order.lowerTrigger && (
                <Detail label="Execute when" hint="The stop-loss condition becomes eligible when the price falls to or below this rate.">
                  <LoadingValue loading={priceLoading}>
                    Price is at or below{" "}
                    {order.price(order.output.triggerLower) ??
                      `${order.amount(order.output.triggerLower, order.outputToken)} per full trade`}
                  </LoadingValue>
                </Detail>
              )}
              {order.upperTrigger && (
                <Detail label="Execute when" hint="The take-profit condition becomes eligible when the price rises to or above this rate.">
                  <LoadingValue loading={priceLoading}>
                    Price is at or above{" "}
                    {order.price(order.output.triggerUpper) ??
                      `${order.amount(order.output.triggerUpper, order.outputToken)} per full trade`}
                  </LoadingValue>
                </Detail>
              )}
              <Detail
                label="Number of trades"
                hint={
                  order.smallerFinalTrade
                    ? "The final trade uses the remaining smaller amount."
                    : "The number of trades needed to sell the full order amount."
                }
              >
                {order.tradeCount}
              </Detail>
              {order.split && (
                <>
                  <Detail label="Amount per trade" hint="The input tokens sold in each full trade. A smaller balance is used for the final trade when needed.">
                    <LoadingValue loading={inputLoading}>
                      {order.inputPerTrade}
                    </LoadingValue>
                  </Detail>
                  <Detail
                    label="Minimum received per trade"
                    hint={
                      order.smallerFinalTrade
                        ? "For a full trade; the smaller final trade receives proportionally less."
                        : "The minimum output tokens received from each full trade at your limit price. Market orders have no fixed minimum."
                    }
                  >
                    <LoadingValue loading={order.hasLimit && outputLoading}>
                      {order.minimumOutputPerTrade}
                    </LoadingValue>
                  </Detail>
                  <Detail
                    label="Trade interval"
                    hint="Minimum time between trades; execution depends on market conditions."
                  >
                    {duration(order.witness.epoch)}
                  </Detail>
                </>
              )}
              <Detail label="Price protection" hint="The allowed price deviation during execution. A lower tolerance offers tighter protection but can make trades harder to fill.">
                {Number(order.witness.slippage) / 100}%
              </Detail>
            </dl>
            {order.smallerFinalTrade && (
              <p className="mb-4 rounded-lg bg-secondary/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                The final trade is smaller{order.hasLimit ? "; its minimum received scales with the amount sold." : "."}
              </p>
            )}
            <h2 className="-mx-5 flex items-center gap-2 border-t border-border px-5 pt-5 text-sm font-semibold sm:-mx-6 sm:px-6">
              <Clock3Icon aria-hidden="true" className="size-4 text-primary" />
              Timing & delivery
            </h2>
            <dl className="mt-2 divide-y divide-border">
              <Detail label="Starts" hint="The earliest time the order can execute, shown in your local time zone.">
                {time(order.witness.start)}
              </Detail>
              <Detail label="Expires" hint="Any unfilled part of the order stops being eligible for execution at this time. Dates use your local time zone.">
                {time(order.witness.deadline)}
              </Detail>
              <Detail
                label="Recipient"
                hint="This address receives the bought tokens."
              >
                <span className="break-all font-mono text-xs">
                  {String(order.output.recipient)}
                </span>
              </Detail>
            </dl>
          </section>
          {comparison?.status === "pass" && failures.length === 0 && (
            <p className="flex items-start gap-2 px-1 text-sm text-primary">
              <CheckCircle2Icon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              These values match the order settings captured from the form.
            </p>
          )}
          {!comparison && (
            <p className="px-1 text-xs leading-relaxed text-muted-foreground">
              Review these values against the order you intended to place. No
              order form was provided for comparison.
            </p>
          )}
        </>
      )}
      {result.payload && !order && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Order preview unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This message does not use the supported RePermit order format. You
            can inspect its fields in Technical details.
          </p>
        </section>
      )}
      {result.payload && (
        <Dialog responsive={false}>
          <DialogTrigger asChild>
            <Button variant="outline">Technical details</Button>
          </DialogTrigger>
          <DialogContent
            presentation="center"
            aria-describedby="technical-details-description"
            onOpenAutoFocus={() => technicalTitleRef.current?.focus()}
            className="max-w-2xl grid-rows-[auto_minmax(0,1fr)] gap-0 p-0 [&>button[data-slot=dialog-close]]:right-3 [&>button[data-slot=dialog-close]]:top-3 [&>button[data-slot=dialog-close]]:grid [&>button[data-slot=dialog-close]]:size-9 [&>button[data-slot=dialog-close]]:place-items-center"
          >
            <DialogHeader className="border-b border-border p-5 pr-14 text-left">
              <DialogTitle
                ref={technicalTitleRef}
                tabIndex={-1}
                className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                Technical details
              </DialogTitle>
              <p
                id="technical-details-description"
                className="text-xs leading-relaxed text-muted-foreground"
              >
                Order checks and the underlying EIP-712 fields.
              </p>
            </DialogHeader>
            <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-5">
              <div className="mt-2 divide-y divide-border">
                {result.checks.map((check) => (
                  <CheckRow key={check.label} check={check} />
                ))}
              </div>
              <h3 className="mb-2 mt-5 text-sm font-semibold">Domain</h3>
              <FieldTree
                value={result.payload.domain}
                path="domain"
                isOrder={result.isOrder}
                amounts={amounts}
                loading={metadata.isLoading}
              />
              <h3 className="mb-2 mt-5 text-sm font-semibold">Order fields</h3>
              <FieldTree
                value={result.payload.message}
                path="message"
                isOrder={result.isOrder}
                amounts={amounts}
                loading={metadata.isLoading}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
