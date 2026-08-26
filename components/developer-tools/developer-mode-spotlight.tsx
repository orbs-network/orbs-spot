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
} from "react";
import { createPortal } from "react-dom";

type SpotlightRect = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

type SpotlightStep = "submit-order" | "developer-guide";

const SPOTLIGHT_GAP = 8;
const GUIDE_SPOTLIGHT_GAP = 2;
const SPOTLIGHT_RADIUS = 20;
const CARD_GAP = 14;
const CARD_WIDTH = 320;
const CARD_HEIGHT_ESTIMATE = 206;

function getSpotlightRect(
  element: HTMLElement,
  gap = SPOTLIGHT_GAP,
): SpotlightRect {
  const rect = element.getBoundingClientRect();
  const left = Math.max(gap, rect.left - gap);
  const right = Math.min(
    window.innerWidth - gap,
    rect.right + gap,
  );
  const top = Math.max(gap, rect.top - gap);
  const bottom = Math.min(
    window.innerHeight - gap,
    rect.bottom + gap,
  );

  return {
    bottom,
    height: Math.max(0, bottom - top),
    left,
    right,
    top,
    width: Math.max(0, right - left),
  };
}

export function DeveloperModeSpotlight({
  enabled,
  targetRef,
}: {
  enabled: boolean;
  targetRef: RefObject<HTMLElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<SpotlightStep>("submit-order");
  const [spotlightRect, setSpotlightRect] =
    useState<SpotlightRect | null>(null);
  const dismissButtonRef = useRef<HTMLButtonElement>(null);

  const dismiss = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      setStep("submit-order");
      setOpen(enabled);
    }, 0);

    return () => window.clearTimeout(syncTimer);
  }, [enabled]);

  useLayoutEffect(() => {
    if (!open) return;

    const target =
      step === "submit-order"
        ? targetRef.current
        : document.querySelector<HTMLElement>("[data-developer-guide-link]");
    if (!target) return;

    const updatePosition = () => {
      setSpotlightRect(
        getSpotlightRect(
          target,
          step === "developer-guide"
            ? GUIDE_SPOTLIGHT_GAP
            : SPOTLIGHT_GAP,
        ),
      );
    };

    if (step === "submit-order") {
      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }
    updatePosition();

    const settleTimer = window.setTimeout(updatePosition, 350);
    const resizeObserver = new ResizeObserver(updatePosition);
    resizeObserver.observe(target);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.clearTimeout(settleTimer);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, step, targetRef]);

  useEffect(() => {
    if (!open) return;

    const focusTimer = window.setTimeout(() => {
      dismissButtonRef.current?.focus({ preventScroll: true });
    }, 400);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dismiss, open]);

  if (!open || !spotlightRect || typeof document === "undefined") return null;

  const cardWidth = Math.min(CARD_WIDTH, window.innerWidth - 32);
  const hasRoomBelow =
    window.innerHeight - spotlightRect.bottom >=
    CARD_HEIGHT_ESTIMATE + CARD_GAP;
  const cardTop = hasRoomBelow
    ? spotlightRect.bottom + CARD_GAP
    : Math.max(16, spotlightRect.top - CARD_HEIGHT_ESTIMATE - CARD_GAP);
  const cardLeft = Math.min(
    window.innerWidth - cardWidth - 16,
    Math.max(16, spotlightRect.right - cardWidth),
  );
  const scrimClassName =
    "fixed z-[80] bg-black/60 backdrop-blur-[4px] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200";
  const spotlightRadius =
    step === "developer-guide"
      ? spotlightRect.height / 2
      : SPOTLIGHT_RADIUS;
  const cornerPatches = [
    {
      left: spotlightRect.left,
      top: spotlightRect.top,
      maskPosition: "100% 100%",
    },
    {
      left: spotlightRect.right - spotlightRadius,
      top: spotlightRect.top,
      maskPosition: "0% 100%",
    },
    {
      left: spotlightRect.left,
      top: spotlightRect.bottom - spotlightRadius,
      maskPosition: "100% 0%",
    },
    {
      left: spotlightRect.right - spotlightRadius,
      top: spotlightRect.bottom - spotlightRadius,
      maskPosition: "0% 0%",
    },
  ];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="developer-spotlight-title"
      aria-describedby="developer-spotlight-description"
    >
      <div
        className={scrimClassName}
        style={{ inset: `0 0 auto 0`, height: spotlightRect.top }}
        onClick={dismiss}
      />
      <div
        className={scrimClassName}
        style={{
          left: 0,
          top: spotlightRect.top,
          width: spotlightRect.left,
          height: spotlightRect.height,
        }}
        onClick={dismiss}
      />
      <div
        className={scrimClassName}
        style={{
          left: spotlightRect.right,
          right: 0,
          top: spotlightRect.top,
          height: spotlightRect.height,
        }}
        onClick={dismiss}
      />
      <div
        className={scrimClassName}
        style={{ inset: `${spotlightRect.bottom}px 0 0 0` }}
        onClick={dismiss}
      />
      {cornerPatches.map((corner) => {
        const maskImage = `radial-gradient(circle at ${corner.maskPosition}, transparent ${spotlightRadius - 1}px, black ${spotlightRadius}px)`;

        return (
          <div
            key={`${corner.left}-${corner.top}`}
            className={scrimClassName}
            style={{
              left: corner.left,
              top: corner.top,
              width: spotlightRadius,
              height: spotlightRadius,
              maskImage,
              WebkitMaskImage: maskImage,
            }}
            onClick={dismiss}
          />
        );
      })}

      <div
        aria-hidden="true"
        className="pointer-events-none fixed z-[81] border-2 border-primary shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_22%,transparent),0_0_32px_color-mix(in_srgb,var(--primary)_58%,transparent)] motion-safe:animate-pulse"
        style={{
          borderRadius: spotlightRadius,
          left: spotlightRect.left,
          top: spotlightRect.top,
          width: spotlightRect.width,
          height: spotlightRect.height,
        }}
      />

      <div
        className="fixed z-[82] rounded-2xl border border-primary/35 bg-card p-4 text-card-foreground shadow-2xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200"
        style={{ left: cardLeft, top: cardTop, width: cardWidth }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Code2Icon className="size-5" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
                Developer mode · {step === "submit-order" ? "1" : "2"} of 2
              </p>
              <h2
                id="developer-spotlight-title"
                className="text-base font-semibold text-foreground"
              >
                {step === "submit-order"
                  ? "Submit a developer order"
                  : "Open the developer guide"}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Dismiss developer mode guide"
          >
            <XIcon className="size-4" />
          </button>
        </div>
        <p
          id="developer-spotlight-description"
          className="text-sm leading-5 text-muted-foreground"
        >
          {step === "submit-order"
            ? "Use this button to inspect and run the complete Orders Sink flow, one step at a time. It stays visible in Dev mode; enter an amount to enable it."
            : "Open the full Orders Sink integration guide for setup, signing, submission, fetching orders, and cancellation examples."}
        </p>
        <Button
          ref={dismissButtonRef}
          type="button"
          size="sm"
          className="mt-4 w-full"
          onClick={() => {
            if (step === "submit-order") {
              setStep("developer-guide");
              return;
            }

            dismiss();
          }}
        >
          {step === "submit-order" ? "Next: Dev guide" : "Got it"}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
