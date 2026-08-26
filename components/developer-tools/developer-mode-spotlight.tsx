"use client";

import { Button } from "@/components/ui/button";
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
import { createPortal } from "react-dom";

import {
  measureSpotlightLayout,
  type SpotlightLayout,
  type SpotlightShape,
} from "./developer-mode-spotlight-layout";

type SpotlightStep = "submit-order" | "developer-guide";

type SpotlightStepConfig = {
  actionLabel: string;
  description: string;
  gap: number;
  number: number;
  shape: SpotlightShape;
  title: string;
};

const SPOTLIGHT_STEPS = {
  "submit-order": {
    actionLabel: "Got it",
    description:
      "Use this button to inspect and run the complete Orders Sink flow, one step at a time. It stays visible in Dev mode; enter an amount to enable it.",
    gap: 8,
    number: 2,
    shape: "rounded-rectangle",
    title: "Submit a developer order",
  },
  "developer-guide": {
    actionLabel: "Next: Submit order",
    description:
      "Open the full Orders Sink integration guide for setup, signing, submission, fetching orders, and cancellation examples.",
    gap: 2,
    number: 1,
    shape: "pill",
    title: "Open the developer guide",
  },
} satisfies Record<SpotlightStep, SpotlightStepConfig>;

const WALKTHROUGH_SEEN_STORAGE_KEY = "developer-mode-walkthrough-v1";

const subscribeToClientReady = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

const SCRIM_CLASS_NAME =
  "pointer-events-none fixed z-[80] bg-black/60 backdrop-blur-[4px] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200";

function SpotlightScrim({
  layout,
  onDismiss,
}: {
  layout: SpotlightLayout;
  onDismiss: () => void;
}) {
  const { radius, target } = layout;
  const cornerPatches = [
    {
      left: target.left,
      top: target.top,
      maskPosition: "100% 100%",
    },
    {
      left: target.right - radius,
      top: target.top,
      maskPosition: "0% 100%",
    },
    {
      left: target.left,
      top: target.bottom - radius,
      maskPosition: "100% 0%",
    },
    {
      left: target.right - radius,
      top: target.bottom - radius,
      maskPosition: "0% 0%",
    },
  ];

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Dismiss developer mode guide"
        className="fixed inset-0 z-[79] cursor-default bg-transparent"
        onClick={onDismiss}
      />
      <div
        className={SCRIM_CLASS_NAME}
        style={{ inset: "0 0 auto 0", height: target.top }}
      />
      <div
        className={SCRIM_CLASS_NAME}
        style={{
          left: 0,
          top: target.top,
          width: target.left,
          height: target.height,
        }}
      />
      <div
        className={SCRIM_CLASS_NAME}
        style={{
          left: target.right,
          right: 0,
          top: target.top,
          height: target.height,
        }}
      />
      <div
        className={SCRIM_CLASS_NAME}
        style={{ inset: `${target.bottom}px 0 0 0` }}
      />
      {cornerPatches.map((corner) => {
        const maskImage = `radial-gradient(circle at ${corner.maskPosition}, transparent ${radius - 1}px, black ${radius}px)`;

        return (
          <div
            key={`${corner.left}-${corner.top}`}
            className={SCRIM_CLASS_NAME}
            style={{
              left: corner.left,
              top: corner.top,
              width: radius,
              height: radius,
              maskImage,
              WebkitMaskImage: maskImage,
            }}
          />
        );
      })}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed z-[81] border-2 border-primary shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_22%,transparent),0_0_32px_color-mix(in_srgb,var(--primary)_58%,transparent)] motion-safe:animate-pulse"
        style={{
          borderRadius: radius,
          left: target.left,
          top: target.top,
          width: target.width,
          height: target.height,
        }}
      />
    </>
  );
}

function SpotlightCard({
  actionButtonRef,
  activeStep,
  cardRef,
  layout,
  onAction,
  onDismiss,
}: {
  actionButtonRef: RefObject<HTMLButtonElement | null>;
  activeStep: SpotlightStepConfig;
  cardRef: RefObject<HTMLDivElement | null>;
  layout: SpotlightLayout;
  onAction: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      ref={cardRef}
      className="fixed z-[82] rounded-2xl border border-primary/35 bg-card p-4 text-card-foreground shadow-2xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200"
      style={layout.card}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Code2Icon aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
              Developer mode · {activeStep.number} of 2
            </p>
            <h2
              id="developer-spotlight-title"
              className="text-pretty text-base font-semibold text-foreground"
            >
              {activeStep.title}
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          aria-label="Dismiss developer mode guide"
        >
          <XIcon aria-hidden="true" className="size-4" />
        </button>
      </div>
      <p
        id="developer-spotlight-description"
        className="text-pretty text-sm leading-5 text-muted-foreground"
      >
        {activeStep.description}
      </p>
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

function useSpotlightDialogBehavior({
  actionButtonRef,
  cardRef,
  isReady,
  onDismiss,
  open,
  rootRef,
}: {
  actionButtonRef: RefObject<HTMLButtonElement | null>;
  cardRef: RefObject<HTMLDivElement | null>;
  isReady: boolean;
  onDismiss: () => void;
  open: boolean;
  rootRef: RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
    const root = rootRef.current;
    if (!open || !isReady || !root) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const backgroundElements = Array.from(document.body.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && element !== root,
    );
    const previousInertStates = backgroundElements.map((element) => ({
      element,
      inert: element.inert,
    }));

    for (const element of backgroundElements) {
      element.inert = true;
    }

    const focusFrame = window.requestAnimationFrame(() => {
      actionButtonRef.current?.focus({ preventScroll: true });
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
        return;
      }

      if (event.key !== "Tab") return;

      const card = cardRef.current;
      const focusableElements = card?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!card || !focusableElements?.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (!card.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
      } else if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);

      for (const { element, inert } of previousInertStates) {
        element.inert = inert;
      }

      if (previousFocus?.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [
    actionButtonRef,
    cardRef,
    isReady,
    onDismiss,
    open,
    rootRef,
  ]);
}

function DeveloperModeSpotlightContent({
  targetRef,
}: {
  targetRef: RefObject<HTMLElement | null>;
}) {
  const [open, setOpen] = useState(() => {
    try {
      return (
        window.localStorage.getItem(WALKTHROUGH_SEEN_STORAGE_KEY) !== "true"
      );
    } catch {
      return true;
    }
  });
  const [step, setStep] = useState<SpotlightStep>("developer-guide");
  const [layout, setLayout] = useState<SpotlightLayout | null>(null);
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeStep = SPOTLIGHT_STEPS[step];

  useEffect(() => {
    if (!open) return;

    try {
      window.localStorage.setItem(WALKTHROUGH_SEEN_STORAGE_KEY, "true");
    } catch {
      // Keep the walkthrough usable when browser storage is unavailable.
    }
  }, [open]);

  const dismiss = useCallback(() => {
    setOpen(false);
    window.scrollTo({ behavior: "auto", left: 0, top: 0 });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;

    const target =
      step === "submit-order"
        ? targetRef.current
        : document.querySelector<HTMLElement>("[data-developer-guide-link]");
    if (!target) {
      setLayout(null);
      return;
    }

    const updatePosition = () => {
      setLayout(
        measureSpotlightLayout(target, {
          gap: activeStep.gap,
          shape: activeStep.shape,
        }),
      );
    };
    if (step === "submit-order") {
      target.scrollIntoView({
        behavior: "auto",
        block: "center",
        inline: "nearest",
      });
    }
    updatePosition();

    const resizeObserver = new ResizeObserver(updatePosition);
    resizeObserver.observe(target);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, {
      capture: true,
      passive: true,
    });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [activeStep.gap, activeStep.shape, open, step, targetRef]);

  useSpotlightDialogBehavior({
    actionButtonRef,
    cardRef,
    isReady: layout !== null,
    onDismiss: dismiss,
    open,
    rootRef,
  });

  if (!open || !layout || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={rootRef}
      data-developer-spotlight-root
      role="dialog"
      aria-modal="true"
      aria-labelledby="developer-spotlight-title"
      aria-describedby="developer-spotlight-description"
    >
      <SpotlightScrim layout={layout} onDismiss={dismiss} />
      <SpotlightCard
        actionButtonRef={actionButtonRef}
        activeStep={activeStep}
        cardRef={cardRef}
        layout={layout}
        onAction={() => {
          if (step === "developer-guide") {
            setStep("submit-order");
          } else {
            dismiss();
          }
        }}
        onDismiss={dismiss}
      />
    </div>,
    document.body,
  );
}

export function DeveloperModeSpotlight({
  targetRef,
}: {
  targetRef: RefObject<HTMLElement | null>;
}) {
  const clientReady = useSyncExternalStore(
    subscribeToClientReady,
    getClientSnapshot,
    getServerSnapshot,
  );

  if (!clientReady) return null;

  return <DeveloperModeSpotlightContent targetRef={targetRef} />;
}
