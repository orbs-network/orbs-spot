"use client";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { Code2Icon, XIcon } from "lucide-react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
areSpotlightLayoutsEqual,
measureSpotlightLayout,
type SpotlightLayout,
type SpotlightShape,
} from "./developer-mode-spotlight-layout";
import * as Dialog from "@radix-ui/react-dialog";

export type DeveloperModeSpotlightVariant =
  | "spot-swap"
  | "orders-sink";

type SpotlightTarget =
  | "demo-action"
  | "live-action"
  | "developer-guide"
  | "spot-swap-quote";

type SpotlightStepConfig = {
  actionLabel: string;
  description: string;
  gap: number;
  shape: SpotlightShape;
  target: SpotlightTarget;
  title: string;
};

const SPOTLIGHT_STEPS = {
  "orders-sink": [
    {
      actionLabel: "Next: Demo",
      description:
        "Open Advanced Order Docs for Orders Sink setup, signing, submission, fetching orders, and cancellation examples.",
      gap: 2,
      shape: "pill",
      target: "developer-guide",
      title: "Open Advanced Order Docs",
    },
    {
      actionLabel: "Next: Place order",
      description:
        "Demo simulates the order flow using live data. Enter an amount to enable it. No wallet opens, no funds are used, and no order is created.",
      gap: 8,
      shape: "rounded-rectangle",
      target: "demo-action",
      title: "Demo · Simulate an order",
    },
    {
      actionLabel: "Got it",
      description:
        "Place order runs the real order flow step by step. Connect a funded wallet and complete the form to enable it. Wallet approvals and signing can create a real order.",
      gap: 8,
      shape: "rounded-rectangle",
      target: "live-action",
      title: "Place order · Real execution",
    },
  ],
  "spot-swap": [
    {
      actionLabel: "Next: Inspect Quote",
      description:
        "Open Spot Docs for client setup, quote freshness, configured token approval, order signing, submission, and settlement.",
      gap: 2,
      shape: "pill",
      target: "developer-guide",
      title: "Open Spot Docs",
    },
    {
      actionLabel: "Next: Demo",
      description:
        "Use the quote button beside the To token title to inspect the exact Spot request and its complete response. You can open it before entering an amount.",
      gap: 6,
      shape: "rounded-rectangle",
      target: "spot-swap-quote",
      title: "Inspect the Live Quote",
    },
    {
      actionLabel: "Next: Swap",
      description:
        "Demo simulates the swap flow using live data. Enter an amount and wait for a valid quote to enable it. No wallet opens and no funds are used.",
      gap: 8,
      shape: "rounded-rectangle",
      target: "demo-action",
      title: "Demo · Simulate a swap",
    },
    {
      actionLabel: "Got it",
      description:
        "Swap runs the real swap flow step by step. Connect a funded wallet and get a valid quote to enable it. Wallet approvals, signing, and submission use real funds.",
      gap: 8,
      shape: "rounded-rectangle",
      target: "live-action",
      title: "Swap · Real execution",
    },
  ],
} satisfies Record<
  DeveloperModeSpotlightVariant,
  readonly SpotlightStepConfig[]
>;

const WALKTHROUGH_SEEN_STORAGE_KEYS = {
  "orders-sink": "developer-mode-walkthrough-v3",
  "spot-swap": "developer-mode-spot-swap-walkthrough-v4",
} satisfies Record<DeveloperModeSpotlightVariant, string>;

const SPOTLIGHT_TARGET_SELECTORS = {
  "developer-guide": "[data-developer-guide-link]",
  "spot-swap-quote": "[data-developer-spot-swap-quote]",
} satisfies Record<Exclude<SpotlightTarget, "demo-action" | "live-action">, string>;

const subscribeToClientReady = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

const OVERLAY_COLOR = "rgba(0, 0, 0, 0.6)";

function SpotlightOverlay({ layout }: { layout: SpotlightLayout }) {
  const className = "pointer-events-none fixed z-[80]";

  const { target, radius } = layout;
  const corners = [
    { name: "top-left", left: target.left, top: target.top, center: "bottom right" },
    { name: "top-right", left: target.right - radius, top: target.top, center: "bottom left" },
    { name: "bottom-left", left: target.left, top: target.bottom - radius, center: "top right" },
    { name: "bottom-right", left: target.right - radius, top: target.bottom - radius, center: "top left" },
  ];

  // Disjoint, plain paint regions retain the rounded cutout without masks,
  // backdrop filters, large shadows, or changes to the application's DOM.
  const regions = [
    { name: "top", left: 0, right: 0, top: 0, height: target.top },
    { name: "bottom", left: 0, right: 0, top: target.bottom, bottom: 0 },
    { name: "left", left: 0, top: target.top, width: target.left, height: target.height },
    { name: "right", left: target.right, right: 0, top: target.top, height: target.height },
  ];

  return (
    <div aria-hidden="true" data-developer-spotlight-overlay className="contents">
      {regions.map(({ name, ...position }) => (
        <div key={name} className={className} style={{ ...position, backgroundColor: OVERLAY_COLOR }} />
      ))}
      {corners.map(corner => (
        <div
          key={corner.name}
          className={className}
          style={{
            left: corner.left,
            top: corner.top,
            width: radius,
            height: radius,
            background: `radial-gradient(circle ${radius}px at ${corner.center}, transparent ${radius - 0.5}px, ${OVERLAY_COLOR} ${radius}px)`,
          }}
        />
      ))}
    </div>
  );
}

function SpotlightHighlight({ layout }: { layout: SpotlightLayout }) {
  const { radius, target } = layout;
  return (
    <div
      aria-hidden="true"
      data-developer-spotlight-highlight
      className="pointer-events-none fixed z-[81] border-2 border-primary shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_22%,transparent)]"
      style={{
        borderRadius: radius,
        left: target.left,
        top: target.top,
        width: target.width,
        height: target.height,
      }}
    />
  );
}

function SpotlightCard({
  actionButtonRef,
  activeStepNumber,
  activeStep,
  embedded = false,
  onAction,
  onDismiss,
  totalSteps,
}: {
  actionButtonRef: RefObject<HTMLButtonElement | null>;
  activeStepNumber: number;
  activeStep: SpotlightStepConfig;
  embedded?: boolean;
  onAction: () => void;
  onDismiss: () => void;
  totalSteps: number;
}) {
  const Title = embedded ? DrawerTitle : Dialog.Title;
  const Description = embedded ? DrawerDescription : Dialog.Description;
  return (
    <div className="p-4 text-card-foreground">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Code2Icon aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
              Developer mode · {activeStepNumber} of {totalSteps}
            </p>
            <Title
              id="developer-spotlight-title"
              className="text-pretty text-base font-semibold text-foreground"
            >
              {activeStep.title}
            </Title>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          aria-label="Dismiss developer mode guide"
        >
          <XIcon aria-hidden="true" className="size-4" />
        </button>
      </div>
      <Description
        id="developer-spotlight-description"
        className="text-pretty text-sm leading-5 text-muted-foreground"
      >
        {activeStep.description}
      </Description>
      <Button
        ref={actionButtonRef}
        type="button"
        size="sm"
        className="mt-4 w-full"
        onClick={onAction}
      >
        {activeStep.actionLabel}
      </Button>
    </div>
  );
}

function DeveloperModeSpotlightContent({
  targetRef,
  variant,
}: {
  targetRef: RefObject<HTMLElement | null>;
  variant: DeveloperModeSpotlightVariant;
}) {
  const isMobile = useIsMobile("(max-width: 767px)");
  const walkthroughSeenStorageKey = WALKTHROUGH_SEEN_STORAGE_KEYS[variant];
  const [open, setOpen] = useState(() => {
    try {
      return (
        window.localStorage.getItem(walkthroughSeenStorageKey) !== "true"
      );
    } catch {
      return true;
    }
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [layout, setLayout] = useState<SpotlightLayout | null>(null);
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const hasPresentedRef = useRef(false);
  const steps = SPOTLIGHT_STEPS[variant];
  const activeStep = steps[stepIndex] ?? steps[0];
  const isVisible = open && (isMobile || layout !== null);

  useEffect(() => {
    if (!isVisible) return;

    try {
      window.localStorage.setItem(walkthroughSeenStorageKey, "true");
    } catch {
      // Keep the walkthrough usable when browser storage is unavailable.
    }
  }, [isVisible, walkthroughSeenStorageKey]);

  const dismiss = useCallback(() => {
    setOpen(false);
    window.scrollTo({ behavior: "auto", left: 0, top: 0 });
  }, []);

  useLayoutEffect(() => {
    if (!open || isMobile) return;

    let target: HTMLElement | null = null;
    let positionFrame = 0;
    let disposed = false;
    let fontsReady = document.fonts.status === "loaded";
    let initialLayout: SpotlightLayout | null = null;

    const resolveTarget = () =>
      activeStep.target === "demo-action"
        ? targetRef.current
        : activeStep.target === "live-action"
          ? document.querySelector<HTMLElement>(
              `[data-dev-flow="${variant}"][data-dev-execution-mode="live"]`,
            )
          : document.querySelector<HTMLElement>(
              SPOTLIGHT_TARGET_SELECTORS[activeStep.target],
            );

    const updatePosition = () => {
      if (disposed) return;
      const nextTarget = resolveTarget();
      // Navigation and developer controls load independently. Wait until the
      // actual target is mounted and visible instead of opening over a fallback.
      if (!nextTarget?.isConnected || !nextTarget.getClientRects().length) return;
      if (target !== nextTarget) {
        if (target) resizeObserver.unobserve(target);
        target = nextTarget;
        resizeObserver.observe(target);
        if (activeStep.target !== "developer-guide") {
          target.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
        }
      }
      if (!fontsReady) return;
      const nextLayout = measureSpotlightLayout(target, {
        gap: activeStep.gap,
        shape: activeStep.shape,
      });
      // Present the first frame only after the font and target geometry settle.
      if (!hasPresentedRef.current && !areSpotlightLayoutsEqual(initialLayout, nextLayout)) {
        initialLayout = nextLayout;
        schedulePositionUpdate();
        return;
      }
      hasPresentedRef.current = true;
      setLayout(previous => areSpotlightLayoutsEqual(previous, nextLayout) ? previous : nextLayout);
    };
    const schedulePositionUpdate = () => {
      if (positionFrame || disposed) return;
      positionFrame = window.requestAnimationFrame(() => {
        positionFrame = 0;
        updatePosition();
      });
    };
    const resizeObserver = new ResizeObserver(schedulePositionUpdate);
    const targetObserver = new MutationObserver(schedulePositionUpdate);
    targetObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    updatePosition();
    void document.fonts.ready.then(() => {
      fontsReady = true;
      schedulePositionUpdate();
    });
    window.addEventListener("resize", schedulePositionUpdate);
    window.addEventListener("scroll", schedulePositionUpdate, { capture: true, passive: true });

    return () => {
      disposed = true;
      targetObserver.disconnect();
      resizeObserver.disconnect();
      window.cancelAnimationFrame(positionFrame);
      window.removeEventListener("resize", schedulePositionUpdate);
      window.removeEventListener("scroll", schedulePositionUpdate, true);
    };
  }, [
    activeStep.gap,
    activeStep.shape,
    activeStep.target,
    isMobile,
    open,
    targetRef,
    variant,
  ]);

  const advance = () => {
    if (stepIndex < steps.length - 1) setStepIndex(current => current + 1);
    else dismiss();
  };

  const onOpenAutoFocus = (event: Event) => {
    event.preventDefault();
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    actionButtonRef.current?.focus({ preventScroll: true });
  };
  const onCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    if (previousFocusRef.current?.isConnected) {
      previousFocusRef.current.focus({ preventScroll: true });
    }
  };
  const onOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) dismiss();
  };
  const card = <SpotlightCard
    actionButtonRef={actionButtonRef}
    activeStep={activeStep}
    activeStepNumber={stepIndex + 1}
    embedded={isMobile}
    onAction={advance}
    onDismiss={dismiss}
    totalSteps={steps.length}
  />;

  if (isMobile) return <Drawer open={open} onOpenChange={onOpenChange}>
    <DrawerContent
      data-developer-spotlight-root
      data-developer-spotlight-drawer
      aria-modal="true"
      aria-labelledby="developer-spotlight-title"
      aria-describedby="developer-spotlight-description"
      onOpenAutoFocus={onOpenAutoFocus}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      {card}
    </DrawerContent>
  </Drawer>;

  // Radix owns modal focus, Escape and outside-click dismissal. The backdrop
  // blocks pointer interaction without making the trading DOM inert.
  return <Dialog.Root open={isVisible} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay data-developer-spotlight-dismiss className="fixed inset-0 z-[79] bg-transparent" />
      {layout && <>
        <SpotlightOverlay layout={layout} />
        <SpotlightHighlight layout={layout} />
      </>}
      <Dialog.Content
        data-developer-spotlight-root
        aria-modal="true"
        aria-labelledby="developer-spotlight-title"
        aria-describedby="developer-spotlight-description"
        className="fixed z-[82] max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-2xl border border-primary/35 bg-card text-card-foreground shadow-xl outline-none"
        style={layout?.card}
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {card}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

export function DeveloperModeSpotlight({
  targetRef,
  variant,
}: {
  targetRef: RefObject<HTMLElement | null>;
  variant: DeveloperModeSpotlightVariant;
}) {
  const clientReady = useSyncExternalStore(
    subscribeToClientReady,
    getClientSnapshot,
    getServerSnapshot,
  );

  if (!clientReady) return null;

  return (
    <DeveloperModeSpotlightContent
      targetRef={targetRef}
      variant={variant}
    />
  );
}
