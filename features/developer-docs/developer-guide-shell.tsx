"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ErrorBoundary } from "react-error-boundary";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GithubIcon,
  SearchIcon,
} from "lucide-react";
import {
  type MouseEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
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
} from "@/components/developer-tools/use-developer-mode";
import { HighlightedText, MarkdownContent } from "./markdown-content";
import type {
  DeveloperGuide,
  DeveloperGuideId,
  DeveloperGuideStep,
} from "./guide-types";

const InteractiveGuideExample = dynamic(
  () =>
    import("./guide-examples").then(
      (module) => module.InteractiveGuideExample,
    ),
  {
    loading: () => (
      <section className="mt-7" aria-label="Interactive integration reference">
        <div className="mb-3 h-4 w-48 animate-pulse rounded bg-secondary motion-reduce:animate-none" />
        <div className="flex h-[760px] items-center justify-center rounded-2xl border border-border/80 bg-card max-sm:h-[680px]">
          <p role="status" className="text-sm text-muted-foreground">
            Loading interactive reference…
          </p>
        </div>
      </section>
    ),
  },
);

const GUIDE_LOCATION_EVENT = "developer-guide-location-change";
const INTERACTIVE_STEP_KEYS = new Set([
  "liquidity-hub:request-quotes",
  "liquidity-hub:execute-the-full-flow",
  "advanced-orders-core:create-order",
  "advanced-orders-core:fetch-partner-config",
  "advanced-orders-core:fetch-order-sink-orders",
  "advanced-orders-core:cancel-order-sink-orders",
  "advanced-orders-react:advanced-orders-provider",
]);

const INTERACTIVE_STEP_PURPOSES: Record<string, string> = {
  "liquidity-hub:request-quotes": "Fetch a wallet-bound candidate without blocking the host DEX quote.",
  "liquidity-hub:execute-the-full-flow": "Prepare, sign, submit, and confirm the selected Liquidity Hub route.",
  "advanced-orders-core:create-order": "Create, fund, sign, and submit one order from live host inputs.",
  "advanced-orders-core:fetch-partner-config": "Inspect and validate the trusted configuration and exact EIP-712 schema.",
  "advanced-orders-core:fetch-order-sink-orders": "Load order history for the connected owner and configured adapter.",
  "advanced-orders-core:cancel-order-sink-orders": "Verify ownership and chain, submit the on-chain digest cancellation, then refresh history.",
  "advanced-orders-react:advanced-orders-provider": "Connect host-owned swap, quote, token, wallet, and lifecycle state to Spot.",
};

const GUIDE_METADATA: Record<DeveloperGuideId, string> = {
  "liquidity-hub": "SDK 1.0.97",
  "advanced-orders-core": "Order Sink v2",
  "advanced-orders-react": "spot-react 1.1.45",
};

const GUIDE_INTEGRATION_EXAMPLES: Partial<
  Record<DeveloperGuideId, readonly { href: string; label: string }[]>
> = {
  "liquidity-hub": [
    {
      href: "https://github.com/orbs-network/orbs-spot/blob/main/components/best-trade-form.tsx",
      label: "orbs-spot example",
    },
    {
      href: "https://github.com/orbs-network/spot-ui/tree/master/skills/liquidity-hub-integration",
      label: "Integration skill",
    },
  ],
  "advanced-orders-react": [
    {
      href: "https://github.com/orbs-network/orbs-spot/blob/main/components/advanced-order/spot-provider-shell.tsx",
      label: "orbs-spot example",
    },
    {
      href: "https://github.com/orbs-network/spot-ui/tree/master/skills/spot-react-integration",
      label: "Integration skill",
    },
  ],
};

function hasInteractiveStep(guideId: DeveloperGuideId, stepId: string) {
  return INTERACTIVE_STEP_KEYS.has(`${guideId}:${stepId}`);
}

function InteractiveReference({
  guideId,
  stepId,
}: {
  guideId: DeveloperGuideId;
  stepId: string;
}) {
  return (
    <ErrorBoundary
      fallbackRender={({ resetErrorBoundary }) => (
        <div role="alert" className="rounded-xl border border-destructive/35 bg-destructive/5 p-5">
          <p className="font-semibold text-foreground">Interactive reference could not load</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">The static contract and explanation remain available in this section.</p>
          <button
            type="button"
            onClick={resetErrorBoundary}
            className="mt-3 min-h-11 touch-manipulation rounded-lg border border-border/80 px-4 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
          >
            Retry interactive reference
          </button>
        </div>
      )}
    >
      <InteractiveGuideExample guideId={guideId} stepId={stepId} />
    </ErrorBoundary>
  );
}

function subscribeToGuideLocation(onStoreChange: () => void): () => void {
  window.addEventListener("hashchange", onStoreChange);
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(GUIDE_LOCATION_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("hashchange", onStoreChange);
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(GUIDE_LOCATION_EVENT, onStoreChange);
  };
}

function getHashSnapshot(): string {
  return window.location.hash.slice(1);
}

function getServerHashSnapshot(): string {
  return "";
}

function getStepIndex(guide: DeveloperGuide, hash: string): number {
  if (!hash) return 0;
  const decodedHash = decodeURIComponent(hash);
  const requestedStepId = guide.hashAliases[decodedHash] ?? decodedHash;
  const index = guide.steps.findIndex((step) => step.id === requestedStepId);
  return index < 0 ? 0 : index;
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

function getStepPhase(step: DeveloperGuideStep): string {
  if (/checklist/.test(step.id)) return "Verify";
  if (/history|fetch-order|cancel|fallback|errors/.test(step.id)) return "Operate";
  if (/execute|submit|lifecycle|refresh-and-sign/.test(step.id)) return "Submit";
  if (/protocol-reference|witness-fields|output-limit/.test(step.id)) return "Reference";
  if (/provider/.test(step.id)) return "Provider";
  if (/compare|wrap|strategy|create-order|build-the-order|build-the-form/.test(step.id)) return "Build";
  if (/wallet|request-quotes|integration-model|fetch-partner-config/.test(step.id)) return "Connect";
  return "Start";
}

function getSearchText(
  step: DeveloperGuideStep,
  supplementalContent = "",
): string {
  return `${step.title} ${supplementalContent} ${step.content}`
    .replace(/```[\w-]*\n?/g, " ")
    .replace(/[`#|*_[\]()]/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSearchExcerpt(
  step: DeveloperGuideStep,
  query: string,
  supplementalContent = "",
): string {
  const text = getSearchText(step, supplementalContent);
  const matchIndex = text.toLowerCase().indexOf(query);
  if (matchIndex < 0) return text.slice(0, 120);

  const start = Math.max(0, matchIndex - 44);
  const end = Math.min(text.length, matchIndex + query.length + 76);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

function GuideSwitcher({
  activeGuide,
  buildGuideHref,
  guides,
}: {
  activeGuide: DeveloperGuide;
  buildGuideHref: (guide: DeveloperGuide) => string;
  guides: DeveloperGuide[];
}) {
  const liquidityHubGuide = guides.find(
    (guide) => guide.id === "liquidity-hub",
  );
  const advancedOrdersGuide = guides.find(
    (guide) => guide.id === "advanced-orders-core",
  );
  const options = [
    liquidityHubGuide
      ? {
          active: activeGuide.id === "liquidity-hub",
          description: liquidityHubGuide.description,
          guide: liquidityHubGuide,
          label: "Liquidity Hub",
        }
      : undefined,
    advancedOrdersGuide
      ? {
          active: activeGuide.id !== "liquidity-hub",
          description: "Direct API or React SDK",
          guide: advancedOrdersGuide,
          label: "Advanced Orders",
        }
      : undefined,
  ].filter((option) => option !== undefined);

  return (
    <nav aria-label="Integration guides" className="grid gap-2 max-lg:grid-cols-2">
      {options.map((option) => {
        return (
          <Link
            key={option.label}
            href={buildGuideHref(option.guide)}
            aria-current={option.active ? "location" : undefined}
            className={cn(
              "group relative flex min-h-[62px] touch-manipulation flex-col justify-center rounded-xl border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45",
              option.active
                ? "border-primary/45 bg-primary/10 text-foreground"
                : "border-border/75 bg-card/55 text-muted-foreground hover:border-primary/25 hover:bg-card hover:text-foreground",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-y-3 left-0 w-0.5 rounded-full bg-primary transition-opacity",
                option.active ? "opacity-100" : "opacity-0",
              )}
            />
            <span className="text-sm font-semibold">{option.label}</span>
            <span className="mt-0.5 text-[11px] leading-4 text-muted-foreground max-lg:hidden">
              {option.description}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function AdvancedOrdersVariantSwitcher({
  activeGuide,
  buildGuideHref,
  guides,
}: {
  activeGuide: DeveloperGuide;
  buildGuideHref: (guide: DeveloperGuide) => string;
  guides: DeveloperGuide[];
}) {
  const variants = guides.filter((guide) => guide.id !== "liquidity-hub");

  return (
    <nav
      aria-label="Advanced Orders integration type"
      className="grid grid-cols-2 gap-2"
    >
      {variants.map((guide) => {
        const active = guide.id === activeGuide.id;
        const isReact = guide.id === "advanced-orders-react";

        return (
          <Link
            key={guide.id}
            href={buildGuideHref(guide)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[58px] min-w-0 touch-manipulation flex-col justify-center rounded-lg border px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45",
              active
                ? "border-primary/40 bg-secondary text-foreground"
                : "border-border/70 bg-background/25 text-muted-foreground hover:border-primary/25 hover:bg-secondary/55 hover:text-foreground",
            )}
          >
            <span className="whitespace-normal break-words text-xs font-semibold leading-4">
              {isReact ? "React SDK" : "Direct API"}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function StepNavigation({
  activeStepIndex,
  buildStepHref,
  guide,
  onStepClick,
  stepRefs,
}: {
  activeStepIndex: number;
  buildStepHref: (step: DeveloperGuideStep) => string;
  guide: DeveloperGuide;
  onStepClick: (
    event: MouseEvent<HTMLAnchorElement>,
    step: DeveloperGuideStep,
  ) => void;
  stepRefs: React.RefObject<(HTMLAnchorElement | null)[]>;
}) {
  return (
    <nav
      aria-label={`${guide.label} guide steps`}
      className="flex min-w-0 flex-col gap-1 max-lg:-mx-4 max-lg:flex-row max-lg:overflow-x-auto max-lg:px-4 max-lg:pb-1 max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden"
    >
      {guide.steps.map((step, index) => {
        const active = index === activeStepIndex;
        return (
          <a
            key={step.id}
            ref={(element) => {
              stepRefs.current[index] = element;
              if (element && active) {
                window.requestAnimationFrame(() => {
                  if (!window.matchMedia("(max-width: 1023px)").matches) {
                    element.scrollIntoView({ block: "nearest" });
                    return;
                  }

                  const stepList = element.parentElement;
                  if (!stepList) return;
                  stepList.scrollTo({
                    left:
                      element.offsetLeft -
                      (stepList.clientWidth - element.clientWidth) / 2,
                  });
                });
              }
            }}
            href={buildStepHref(step)}
            aria-current={active ? "step" : undefined}
            onClick={(event) => onStepClick(event, step)}
            className={cn(
              "group grid min-h-11 touch-manipulation grid-cols-[28px_minmax(0,1fr)] items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 max-lg:w-[240px] max-lg:flex-none",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full border font-mono text-[11px]",
                active
                  ? "border-primary/50 bg-primary/12 text-primary"
                  : "border-border bg-background/40 text-muted-foreground",
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-[9px] font-semibold uppercase tracking-[0.12em] text-primary/80">
                {getStepPhase(step)}
              </span>
              <span className="block whitespace-normal break-words leading-5 max-lg:text-xs max-lg:leading-4">
                {step.title}
              </span>
            </span>
          </a>
        );
      })}
    </nav>
  );
}

function StepFooter({
  nextHref,
  nextTitle,
  onNext,
  onPrevious,
  previousHref,
  previousTitle,
}: {
  nextHref?: string;
  nextTitle?: string;
  onNext?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onPrevious?: (event: MouseEvent<HTMLAnchorElement>) => void;
  previousHref?: string;
  previousTitle?: string;
}) {
  return (
    <footer className="mt-6 grid grid-cols-2 gap-3 border-t border-border/70 pt-5">
      {previousHref && previousTitle ? (
        <a
          href={previousHref}
          onClick={onPrevious}
          className="group flex min-w-0 touch-manipulation items-center gap-3 rounded-xl border border-border/80 bg-card/50 p-3.5 transition-colors hover:border-primary/30 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
        >
          <ChevronLeftIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5"
          />
          <span className="min-w-0 text-left">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Previous
            </span>
            <span className="mt-0.5 block whitespace-normal break-words text-sm font-medium leading-5 text-foreground">
              {previousTitle}
            </span>
          </span>
        </a>
      ) : (
        <span />
      )}
      {nextHref && nextTitle ? (
        <a
          href={nextHref}
          onClick={onNext}
          className="group flex min-w-0 touch-manipulation items-center justify-end gap-3 rounded-xl border border-border/80 bg-card/50 p-3.5 text-right transition-colors hover:border-primary/30 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
        >
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Next
            </span>
            <span className="mt-0.5 block whitespace-normal break-words text-sm font-medium leading-5 text-foreground">
              {nextTitle}
            </span>
          </span>
          <ChevronRightIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          />
        </a>
      ) : null}
    </footer>
  );
}

function GuideIntroduction({
  guide,
  highlightQuery,
}: {
  guide: DeveloperGuide;
  highlightQuery: string;
}) {
  const integrationExamples = GUIDE_INTEGRATION_EXAMPLES[guide.id];

  return (
    <section
      aria-label={`${guide.label} introduction`}
      className="mt-5 border-l-2 border-primary/45 pl-4 sm:pl-5"
    >
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
        Before You Start
      </p>
      <MarkdownContent
        highlightQuery={highlightQuery}
        markdown={guide.intro}
      />
      {integrationExamples ? (
        <nav
          aria-label={`${guide.label} integration examples`}
          className="mt-5 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/[0.06] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-3.5"
        >
          <span className="text-sm font-semibold text-foreground">
            Integration examples
          </span>
          <div className="flex flex-wrap gap-2">
            {integrationExamples.map((example) => (
              <a
                key={example.href}
                href={example.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary/25 bg-background/65 px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
              >
                <GithubIcon aria-hidden="true" className="size-4 text-primary" />
                {example.label}
              </a>
            ))}
          </div>
        </nav>
      ) : null}
    </section>
  );
}

export function DeveloperGuideShell({
  activeGuideId,
  guides,
}: {
  activeGuideId: DeveloperGuideId;
  guides: DeveloperGuide[];
}) {
  const activeGuide =
    guides.find((guide) => guide.id === activeGuideId) ?? guides[0];
  const hash = useSyncExternalStore(
    subscribeToGuideLocation,
    getHashSnapshot,
    getServerHashSnapshot,
  );
  const activeStepIndex = getStepIndex(activeGuide, hash);
  const activeStep = activeGuide.steps[activeStepIndex] ?? activeGuide.steps[0];
  const previousStep = activeGuide.steps[activeStepIndex - 1];
  const nextStep = activeGuide.steps[activeStepIndex + 1];
  const stepRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const mobileStepRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const contentRef = useRef<HTMLElement>(null);
  const [sectionSearch, setSectionSearch] = useState("");
  const [highlightQuery, setHighlightQuery] = useState("");
  const { selectedTab } = useSelectedFormTab();
  const { isDeveloperMode } = useDeveloperMode();
  const hasInteractiveExample = hasInteractiveStep(
    activeGuide.id,
    activeStep.id,
  );
  const normalizedSearch = sectionSearch.trim().toLowerCase();
  const searchResults = normalizedSearch
    ? activeGuide.steps.filter(
        (step, index) =>
          getSearchText(
            step,
            index === 0 ? activeGuide.intro : "",
          )
            .toLowerCase()
            .includes(normalizedSearch),
      )
    : [];
  const finalResources =
    activeGuide.id === "liquidity-hub"
      ? {
          primaryHref: "https://orbs-spot.vercel.app",
          primaryLabel: "Open live Liquidity Hub UI",
          sourceHref:
            "https://github.com/orbs-network/orbs-spot/blob/main/components/best-trade-form.tsx",
        }
      : activeGuide.id === "advanced-orders-react"
        ? {
            primaryHref:
              "https://github.com/orbs-network/orbs-spot/blob/main/components/advanced-order/spot-provider-shell.tsx",
            primaryLabel: "Open the React integration",
            sourceHref:
              "https://github.com/orbs-network/spot-ui/tree/master/packages/spot-react",
          }
        : {
            primaryHref:
              "https://github.com/orbs-network/spot-integration-docs",
            primaryLabel: "Open the Direct API reference",
            sourceHref:
              "https://github.com/orbs-network/spot-ui/tree/master/packages/spot-ui",
          };

  const preserveAppState = (href: string): string =>
    preserveDeveloperModeInHref(
      preserveFormTabInHref(href, selectedTab.value),
      isDeveloperMode,
    );
  const buildGuideHref = (guide: DeveloperGuide): string =>
    preserveAppState(guide.route);
  const buildStepHref = (step: DeveloperGuideStep): string =>
    preserveAppState(`${activeGuide.route}#${step.id}`);

  const openStep = (step: DeveloperGuideStep, searchQuery = "") => {
    setHighlightQuery(searchQuery);
    setSectionSearch("");
    const href = buildStepHref(step);
    window.history.pushState(null, "", href);
    window.dispatchEvent(new Event(GUIDE_LOCATION_EVENT));
    document.getElementById("mobile-guide-menu")?.removeAttribute("open");
    window.requestAnimationFrame(() => {
      contentRef.current?.focus({ preventScroll: true });
      if (searchQuery) return;
      contentRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    });
  };

  const navigateToStep = (
    event: MouseEvent<HTMLAnchorElement>,
    step: DeveloperGuideStep,
  ) => {
    if (isModifiedClick(event)) return;
    event.preventDefault();
    openStep(step);
  };

  const navigateToSearchResult = (
    event: MouseEvent<HTMLAnchorElement>,
    step: DeveloperGuideStep,
  ) => {
    if (isModifiedClick(event)) return;
    event.preventDefault();
    openStep(step, normalizedSearch);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const firstResult = searchResults[0];
    if (firstResult) openStep(firstResult, normalizedSearch);
  };

  useEffect(() => {
    if (!highlightQuery) return;
    const animationFrame = window.requestAnimationFrame(() => {
      const firstMatch = contentRef.current?.querySelector<HTMLElement>(
        '[data-guide-search-highlight="true"]',
      );
      firstMatch?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeStep.id, highlightQuery]);

  return (
    <div className="w-full max-w-[1420px] pb-20 pt-5 sm:pt-8">
      <div className="grid min-w-0 gap-6 lg:grid-cols-[300px_minmax(0,920px)] lg:justify-center lg:gap-8">
        <aside className="min-w-0 self-start max-lg:sticky max-lg:top-16 max-lg:z-30 max-lg:-mx-4 max-lg:bg-background/95 max-lg:px-4 max-lg:py-2 max-lg:backdrop-blur lg:sticky lg:top-24 lg:max-h-[calc(100dvh-112px)] lg:overflow-y-auto lg:overscroll-auto lg:rounded-2xl lg:border lg:border-border/80 lg:bg-card/45 lg:p-4">
          <details
            id="mobile-guide-menu"
            className="group rounded-xl border border-border/80 bg-card shadow-lg shadow-black/10 lg:hidden"
          >
            <summary className="flex min-h-12 cursor-pointer list-none touch-manipulation items-center justify-between gap-3 px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/45 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block whitespace-normal break-words text-[10px] font-semibold uppercase leading-4 tracking-[0.12em] text-primary">
                  {activeGuide.id === "liquidity-hub" ? "Liquidity Hub" : "Advanced Orders"}
                </span>
                <span className="mt-0.5 block whitespace-normal break-words text-sm font-semibold leading-5 text-foreground">
                  {activeStepIndex + 1}. {activeStep.title}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
                Guide menu
                <ChevronDownIcon aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="border-t border-border/70 p-4">
              <GuideSwitcher
                activeGuide={activeGuide}
                buildGuideHref={buildGuideHref}
                guides={guides}
              />
              {activeGuide.id !== "liquidity-hub" ? (
                <div className="mt-3">
                  <AdvancedOrdersVariantSwitcher
                    activeGuide={activeGuide}
                    buildGuideHref={buildGuideHref}
                    guides={guides}
                  />
                </div>
              ) : null}
              <div className="my-3 h-px bg-border/80" />
              <StepNavigation
                activeStepIndex={activeStepIndex}
                buildStepHref={buildStepHref}
                guide={activeGuide}
                onStepClick={navigateToStep}
                stepRefs={mobileStepRefs}
              />
            </div>
          </details>

          <div className="max-lg:hidden">
          <Link
            href={preserveAppState("/")}
            className="inline-flex min-h-9 touch-manipulation items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
          >
            <ArrowLeftIcon aria-hidden="true" className="size-4" />
            Back
          </Link>

          <div className="mt-4 flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <BookOpenIcon aria-hidden="true" className="size-4.5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Orbs Spot Docs
              </p>
              <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">
                Integration Guides
              </h1>
            </div>
          </div>

          <div className="mt-4">
            <GuideSwitcher
              activeGuide={activeGuide}
              buildGuideHref={buildGuideHref}
              guides={guides}
            />
          </div>

          {activeGuide.id !== "liquidity-hub" ? (
            <div className="mt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Integration Type
              </p>
              <AdvancedOrdersVariantSwitcher
                activeGuide={activeGuide}
                buildGuideHref={buildGuideHref}
                guides={guides}
              />
            </div>
          ) : null}

          <div className="my-4 h-px bg-border/80" />

          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 whitespace-normal break-words text-[10px] font-semibold uppercase leading-4 tracking-[0.14em] text-muted-foreground">
              {activeGuide.label}
            </p>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
              {activeStepIndex + 1}/{activeGuide.steps.length}
            </span>
          </div>

          <StepNavigation
            activeStepIndex={activeStepIndex}
            buildStepHref={buildStepHref}
            guide={activeGuide}
            onStepClick={navigateToStep}
            stepRefs={stepRefs}
          />
          </div>
        </aside>

        <section
          ref={contentRef}
          id="guide-content"
          tabIndex={-1}
          className="min-w-0 scroll-mt-24 focus-visible:outline-none"
          aria-labelledby="guide-step-title"
        >
          <header className="min-w-0">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-primary">
              {activeGuide.label} · Step {activeStepIndex + 1} of {activeGuide.steps.length}
            </p>
            <div className="mt-2 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <h2
                id="guide-step-title"
                className="min-w-0 flex-1 text-pretty text-2xl font-semibold tracking-tight text-foreground sm:text-4xl"
              >
                <HighlightedText query={highlightQuery} text={activeStep.title} />
              </h2>
              <div className="flex w-full min-w-0 items-start gap-2 sm:w-auto sm:shrink-0">
                <form
                  role="search"
                  onSubmit={submitSearch}
                  className="relative min-w-0 flex-1 sm:w-72 sm:flex-none lg:w-80"
                >
                  <label className="relative block">
                    <span className="sr-only">Search this integration guide</span>
                    <SearchIcon
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      type="search"
                      name="guide-search"
                      autoComplete="off"
                      value={sectionSearch}
                      onChange={(event) => {
                        setSectionSearch(event.target.value);
                        setHighlightQuery("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setSectionSearch("");
                      }}
                      placeholder="Search this guide…"
                      aria-controls="guide-search-results"
                      className="min-h-11 w-full rounded-xl border border-border/80 bg-card/55 pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/45 focus:ring-2 focus:ring-primary/20 max-sm:text-base"
                    />
                  </label>
                  {normalizedSearch ? (
                    <div
                      id="guide-search-results"
                      className="absolute left-0 top-[calc(100%+0.5rem)] z-40 w-[min(30rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xl shadow-black/35 sm:left-auto sm:right-0"
                    >
                      <p className="border-b border-border/70 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground" aria-live="polite">
                        {searchResults.length} {searchResults.length === 1 ? "section" : "sections"} found
                      </p>
                      {searchResults.length > 0 ? (
                        <ul className="max-h-80 overflow-y-auto overscroll-contain p-1.5">
                          {searchResults.map((step) => {
                            const stepIndex = activeGuide.steps.findIndex(
                              (candidate) => candidate.id === step.id,
                            );
                            return (
                              <li key={step.id}>
                                <a
                                  href={buildStepHref(step)}
                                  onClick={(event) => navigateToSearchResult(event, step)}
                                  className="group flex min-h-11 touch-manipulation gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/45"
                                >
                                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border font-mono text-[10px] text-primary">
                                    {stepIndex + 1}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block text-sm font-semibold leading-5 text-foreground">
                                      <HighlightedText query={normalizedSearch} text={step.title} />
                                    </span>
                                    <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                                      <HighlightedText
                                        query={normalizedSearch}
                                        text={getSearchExcerpt(
                                          step,
                                          normalizedSearch,
                                          stepIndex === 0 ? activeGuide.intro : "",
                                        )}
                                      />
                                    </span>
                                  </span>
                                </a>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                          No matching section. Try a field, endpoint, or lifecycle stage.
                        </p>
                      )}
                    </div>
                  ) : null}
                </form>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {activeGuide.title}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-full border border-border/75 bg-card/55 px-2.5 py-1">
                Tested: {GUIDE_METADATA[activeGuide.id]}
              </span>
              <span className="rounded-full border border-border/75 bg-card/55 px-2.5 py-1 max-sm:hidden">
                Updated Sep 1, 2026
              </span>
              <span className="rounded-full border border-border/75 bg-card/55 px-2.5 py-1 max-sm:hidden">
                Sample addresses are illustrative
              </span>
            </div>
          </header>

          {activeStepIndex === 0 ? (
            <GuideIntroduction
              guide={activeGuide}
              highlightQuery={highlightQuery}
            />
          ) : null}

          <div
            className="mt-5 h-1 overflow-hidden rounded-full bg-secondary"
            aria-hidden="true"
          >
            <div
              className="h-full origin-left rounded-full bg-primary transition-transform duration-200 motion-reduce:transition-none"
              style={{
                transform: `scaleX(${(activeStepIndex + 1) / activeGuide.steps.length})`,
              }}
            />
          </div>

          <article
            id={activeStep.id}
            className="mt-5 min-w-0 rounded-2xl border border-border/80 bg-card/55 p-4 sm:p-6 lg:p-7"
          >
            {hasInteractiveExample ? (
              <div className="mb-7">
                <p className="mb-3 text-sm leading-6 text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    What this step accomplishes:
                  </span>{" "}
                  {INTERACTIVE_STEP_PURPOSES[`${activeGuide.id}:${activeStep.id}`]}
                </p>
                <InteractiveReference
                  guideId={activeGuide.id}
                  stepId={activeStep.id}
                />
              </div>
            ) : null}
            <MarkdownContent
              codeBlocksFirst
              highlightQuery={highlightQuery}
              limitCodeBlockHeight={
                activeGuide.id === "advanced-orders-react" &&
                activeStep.id === "submit-modal-and-lifecycle"
              }
              markdown={activeStep.content}
            />
          </article>

          <StepFooter
            previousHref={previousStep ? buildStepHref(previousStep) : undefined}
            previousTitle={previousStep?.title}
            onPrevious={
              previousStep
                ? (event) => navigateToStep(event, previousStep)
                : undefined
            }
            nextHref={nextStep ? buildStepHref(nextStep) : undefined}
            nextTitle={nextStep?.title}
            onNext={
              nextStep ? (event) => navigateToStep(event, nextStep) : undefined
            }
          />

          <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/45 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Ready to implement?</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Use the working reference, then contact Orbs if partner configuration is missing.</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <a
                href={finalResources.sourceHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 touch-manipulation items-center text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
              >
                View source
              </a>
              <a
                href={finalResources.primaryHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 touch-manipulation items-center gap-2 rounded-lg text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
              >
                {finalResources.primaryLabel}
                <ArrowRightIcon aria-hidden="true" className="size-4" />
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
