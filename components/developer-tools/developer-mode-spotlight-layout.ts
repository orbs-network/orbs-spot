export type SpotlightShape = "pill" | "rounded-rectangle";

export type SpotlightRect = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

export type SpotlightLayout = {
  card: {
    left: number;
    top: number;
    width: number;
  };
  radius: number;
  target: SpotlightRect;
};

const CARD_GAP = 14;
const CARD_HEIGHT_ESTIMATE = 206;
const CARD_WIDTH = 320;
const CARD_VIEWPORT_MARGIN = 16;
const ROUNDED_RECTANGLE_RADIUS = 20;

export function measureSpotlightLayout(
  element: HTMLElement,
  { gap, shape }: { gap: number; shape: SpotlightShape },
): SpotlightLayout {
  const elementRect = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const left = Math.max(gap, elementRect.left - gap);
  const right = Math.min(viewportWidth - gap, elementRect.right + gap);
  const top = Math.max(gap, elementRect.top - gap);
  const bottom = Math.min(viewportHeight - gap, elementRect.bottom + gap);
  const target = {
    bottom,
    height: Math.max(0, bottom - top),
    left,
    right,
    top,
    width: Math.max(0, right - left),
  };
  const cardWidth = Math.min(
    CARD_WIDTH,
    viewportWidth - CARD_VIEWPORT_MARGIN * 2,
  );
  const hasRoomBelow =
    viewportHeight - target.bottom >= CARD_HEIGHT_ESTIMATE + CARD_GAP;
  const cardTop = hasRoomBelow
    ? target.bottom + CARD_GAP
    : Math.max(
        CARD_VIEWPORT_MARGIN,
        target.top - CARD_HEIGHT_ESTIMATE - CARD_GAP,
      );
  const cardLeft = Math.min(
    viewportWidth - cardWidth - CARD_VIEWPORT_MARGIN,
    Math.max(CARD_VIEWPORT_MARGIN, target.right - cardWidth),
  );

  return {
    card: { left: cardLeft, top: cardTop, width: cardWidth },
    radius:
      shape === "pill" ? target.height / 2 : ROUNDED_RECTANGLE_RADIUS,
    target,
  };
}
