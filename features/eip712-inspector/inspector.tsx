"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, BracesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { preserveDeveloperModeInHref, useDeveloperMode } from "@/lib/hooks/use-developer-mode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  inspect,
  type Inspection,
  type OrderContext,
  type TokenInfo,
} from "./inspect";
import { takeDraft, stringify } from "./handoff";
import { InspectionResults } from "./inspection-results";

export function Eip712Inspector() {
  const { isDeveloperMode } = useDeveloperMode();
  const [json, setJson] = useState("");
  const [context, setContext] = useState<OrderContext>();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [tokenChain, setTokenChain] = useState("");
  const [result, setResult] = useState<Inspection>();
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const loaded = useRef(false);
  const revision = useRef(0);
  const jsonRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const focusPreviewOnClose = useRef(false);

  function invalidate() {
    revision.current++;
    setError("");
    setBusy(false);
  }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (loaded.current) return;
      loaded.current = true;
      const id = new URLSearchParams(window.location.search).get("draft");
      if (!id) return;
      try {
        const draft = takeDraft(id);
        const source = stringify(draft.typedData);
        const preview = inspect(source, draft.context);
        setJson(source);
        setContext(draft.context);
        setTokens(draft.context?.tokens ?? []);
        setTokenChain(String(preview.payload?.domain.chainId ?? ""));
        setResult(preview.payload ? preview : undefined);
        if (!preview.payload) {
          setError(
            preview.checks.find((check) => check.status === "fail")?.detail ??
              "Check the order data and try again.",
          );
        }
        setNotice(
          draft.context?.demo
            ? "Demo order · review these example order values."
            : "Order snapshot · changes here do not modify your order.",
        );
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Could not load the order.",
        );
      }
      const url = new URL(window.location.href);
      url.searchParams.delete("draft");
      window.history.replaceState(null, "", url);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function finishEditing() {
    if (editOpen) {
      focusPreviewOnClose.current = true;
      setEditOpen(false);
    } else {
      requestAnimationFrame(() => previewRef.current?.focus());
    }
  }

  function showPreview() {
    setError("");
    const next = inspect(json, context);
    if (!next.payload) {
      setError(
        next.checks.find((check) => check.status === "fail")?.detail ??
          "Check the order data and try again.",
      );
      jsonRef.current?.focus();
      return;
    }
    setResult(next);
    finishEditing();
  }
  async function loadExample() {
    const current = ++revision.current;
    setBusy(true);
    try {
      const { PERMIT_DATA_RESPONSE } =
        await import("@/features/developer-tools/snippets/code-examples");
      if (current !== revision.current) return;
      const example = structuredClone(PERMIT_DATA_RESPONSE);
      const now = Math.floor(Date.now() / 1000);
      const w = example.order.witness;
      const inputToken = {
        address: "0x1111111111111111111111111111111111111111",
        symbol: "DEMO-ETH",
        decimals: 18,
      };
      const outputToken = {
        address: "0x6666666666666666666666666666666666666666",
        symbol: "DEMO-USD",
        decimals: 6,
      };
      example.order.permitted = {
        token: inputToken.address,
        amount: "1000000000000000000",
      };
      example.order.spender = w.reactor;
      example.order.nonce = w.nonce = "1";
      example.order.deadline = w.deadline = String(now + 3600);
      w.start = String(now);
      w.epoch = 1800;
      w.swapper = w.output.recipient =
        "0x5555555555555555555555555555555555555555";
      w.input = {
        token: inputToken.address,
        amount: "500000000000000000",
        maxAmount: example.order.permitted.amount,
      };
      w.output.token = outputToken.address;
      w.output.limit = "1500000000";
      w.slippage = 100;
      const source = stringify({
        domain: example.domain,
        types: example.types,
        primaryType: example.primaryType,
        message: example.order,
      });
      invalidate();
      setContext(undefined);
      setTokens([inputToken, outputToken]);
      setTokenChain(String(example.domain.chainId));
      setJson(source);
      setResult(inspect(source));
      finishEditing();
      setNotice(
        "Example order · demonstration tokens, amounts, and addresses.",
      );
    } catch {
      if (current !== revision.current) return;
      setError("Could not load the example. Try again.");
      setBusy(false);
    }
  }
  const displayTokens =
    String(result?.payload?.domain.chainId ?? "") === tokenChain ? tokens : [];

  const editorDescription = (
    <p id="payload-help" className="text-xs leading-relaxed text-muted-foreground">
      Paste the order’s JSON, including domain, types, primaryType, and
      message. Or open Preview order from the order flow.
    </p>
  );
  const editorForm = (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        showPreview();
      }}
      className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="typed-data" className="text-sm font-medium">
          EIP-712 message
        </label>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          isLoading={busy}
          onClick={loadExample}
        >
          Load example
        </Button>
      </div>
      <textarea
        ref={jsonRef}
        id="typed-data"
        name="typed-data"
        rows={12}
        spellCheck={false}
        autoComplete="off"
        aria-describedby={error ? "payload-help payload-error" : "payload-help"}
        aria-invalid={Boolean(error)}
        maxLength={100_000}
        className="min-h-60 w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-xs leading-relaxed outline-none placeholder:text-muted-foreground/65 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
        placeholder={
          '{ "domain": { … }, "types": { … }, "primaryType": "…", "message": { … } }'
        }
        value={json}
        onChange={(event) => {
          invalidate();
          setJson(event.target.value);
        }}
      />
      {error && (
        <p id="payload-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-11 flex-1" disabled={busy}>
          Preview order
        </Button>
        <Button
          variant="outline"
          className="h-11"
          onClick={() => {
            invalidate();
            setJson("");
            setContext(undefined);
            setNotice("");
            jsonRef.current?.focus();
          }}
        >
          Clear
        </Button>
      </div>
    </form>
  );

  return (
    <div className="w-full max-w-[860px] min-w-0 py-6 sm:py-10">
      <Link
        href={preserveDeveloperModeInHref("/", isDeveloperMode)}
        className="inline-flex min-h-9 items-center gap-2 rounded text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        {isDeveloperMode ? "Back to playground" : "Back to trading"}
      </Link>
      <header className="mb-7 mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          EIP-712 order preview
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Review your order
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Check what you sell, what you receive, and when the order can execute.
        </p>
      </header>
      {notice && (
        <p className="mb-5 text-xs leading-relaxed text-muted-foreground">
          {notice}
        </p>
      )}
      <div
        ref={previewRef}
        tabIndex={-1}
        aria-label="Order values"
        className="space-y-5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        aria-live="polite"
      >
        {result && <InspectionResults result={result} tokens={displayTokens} />}
      </div>
      {!result ? (
        <section
          aria-labelledby="paste-order-title"
          className="rounded-xl border border-border bg-card"
        >
          <div className="space-y-2 border-b border-border p-5">
            <h2 id="paste-order-title" className="text-lg font-semibold">
              Paste order data
            </h2>
            {editorDescription}
          </div>
          {editorForm}
        </section>
      ) : (
        <Dialog open={editOpen} onOpenChange={setEditOpen} responsive={false}>
          <DialogTrigger asChild>
            <Button variant="outline" className="mt-5">
              <BracesIcon aria-hidden="true" className="size-4 text-primary" />
              View or edit order data
            </Button>
          </DialogTrigger>
          <DialogContent
            presentation="center"
            aria-describedby="payload-help"
            onOpenAutoFocus={() => jsonRef.current?.focus()}
            onCloseAutoFocus={(event) => {
              if (!focusPreviewOnClose.current) return;
              event.preventDefault();
              focusPreviewOnClose.current = false;
              previewRef.current?.focus();
            }}
            className="max-w-2xl grid-rows-[auto_minmax(0,1fr)] gap-0 p-0 [&>button[data-slot=dialog-close]]:right-3 [&>button[data-slot=dialog-close]]:top-3 [&>button[data-slot=dialog-close]]:grid [&>button[data-slot=dialog-close]]:size-9 [&>button[data-slot=dialog-close]]:place-items-center"
          >
            <DialogHeader className="border-b border-border p-5 pr-14 text-left">
              <DialogTitle>View or edit order data</DialogTitle>
              {editorDescription}
            </DialogHeader>
            {editorForm}
          </DialogContent>
        </Dialog>
      )}
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        This preview reads the order values in your browser. It does not place
        or change your order.
      </p>
    </div>
  );
}
