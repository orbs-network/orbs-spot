"use client";

import Link from "next/link";
import { ArrowLeftIcon, Code2Icon, ShieldCheckIcon } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import {
  preserveFormTabInHref,
  useSelectedFormTab,
} from "@/lib/hooks/use-form-tab";
import { cn } from "@/lib/utils";
import {
  preserveDeveloperModeInHref,
  useDeveloperMode,
} from "./use-developer-mode";

export type IntegrationGuideExample = {
  description: string;
  effect: string;
  icon?: typeof Code2Icon;
  id: string;
  title: string;
};

const subscribeToHash = (onStoreChange: () => void) => {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
};

const getHashSnapshot = () => window.location.hash;
const getServerHashSnapshot = () => "";

export function IntegrationGuideLayout({
  children,
  description,
  eyebrow = "Developer documentation",
  examples,
  implementationSummary,
  renderExample,
  rules,
  title,
}: {
  children?: ReactNode;
  description: string;
  eyebrow?: string;
  examples: readonly IntegrationGuideExample[];
  implementationSummary: string;
  renderExample: (exampleId: string) => ReactNode;
  rules: readonly string[];
  title: string;
}) {
  const { isDeveloperMode } = useDeveloperMode();
  const { selectedTab } = useSelectedFormTab();
  const hash = useSyncExternalStore(
    subscribeToHash,
    getHashSnapshot,
    getServerHashSnapshot,
  );
  const activeItem = useMemo(
    () =>
      examples.find((item) => `#${item.id}` === hash) ??
      examples[0],
    [examples, hash],
  );

  useEffect(() => {
    const targetId = hash.startsWith("#")
      ? decodeURIComponent(hash.slice(1))
      : "";
    if (!targetId) return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hash]);

  if (!activeItem) return null;

  return (
    <div className="w-full max-w-[1440px] pb-20 pt-5 sm:pt-8">
      <header className="mx-auto max-w-[1120px]">
        <Link
          href={preserveDeveloperModeInHref(
            preserveFormTabInHref("/", selectedTab.value),
            isDeveloperMode,
          )}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          Back to Trading
        </Link>
        <div className="mt-7 max-w-[820px]">
          <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            {eyebrow}
          </span>
          <h1 className="mt-4 text-pretty text-2xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-[760px] text-pretty text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </header>

      <div className="mx-auto mt-10 max-w-[1120px]">
        <div className="min-w-0 space-y-8">
          <section
            id="implementation-rules"
            className="scroll-mt-24 rounded-[20px] border border-primary/35 bg-primary/10 p-5 sm:p-6"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-[11px] bg-primary/18 text-primary">
                <ShieldCheckIcon aria-hidden="true" className="size-5" />
              </span>
              <h2 className="text-lg font-semibold text-foreground">
                Implementation Rules
              </h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-foreground/85">
              {implementationSummary}
            </p>
            <ul className="mt-4 grid gap-3 text-sm leading-6 text-foreground/85 sm:grid-cols-2">
              {rules.map((rule, index) => (
                <li
                  key={rule}
                  className={cn(
                    "relative pl-5 before:absolute before:left-0 before:top-[0.65em] before:size-1.5 before:rounded-full before:bg-primary",
                    index === 0 && "sm:col-span-2",
                  )}
                >
                  {rule}
                </li>
              ))}
            </ul>
          </section>

          {children}

          <section id="examples" className="scroll-mt-24">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Code examples
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Copy-Ready Integration Reference
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Examples use sample values. Dev Mode fills the same snippets
                  with the current form, wallet, request, and response values.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <nav
                aria-label="Code examples"
                className="flex snap-x gap-2 overflow-x-auto pb-2"
              >
                {examples.map((item) => {
                  const Icon = item.icon ?? Code2Icon;
                  const active = item.id === activeItem.id;
                  return (
                    <a
                      key={item.id}
                      id={item.id}
                      href={`#${item.id}`}
                      aria-current={active ? "location" : undefined}
                      className={cn(
                        "flex min-w-[220px] flex-1 snap-start scroll-mt-24 items-center gap-3 rounded-[14px] border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                        active
                          ? "border-primary/45 bg-primary/10"
                          : "border-border/75 bg-card/65 hover:border-primary/30 hover:bg-card",
                      )}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-primary/12 text-primary">
                        <Icon aria-hidden="true" className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-foreground">
                          {item.title}
                        </span>
                        <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                          <span className="text-primary/85">{item.effect}</span>
                          <span aria-hidden="true"> · </span>
                          {item.description}
                        </span>
                      </span>
                    </a>
                  );
                })}
              </nav>

              <section
                id="developer-code-example-panel"
                aria-labelledby={activeItem.id}
                className="mt-2 h-[800px] min-w-0 overflow-hidden rounded-[20px] border border-border/80 bg-card shadow-2xl shadow-black/20 max-sm:h-[720px]"
              >
                {renderExample(activeItem.id)}
              </section>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
