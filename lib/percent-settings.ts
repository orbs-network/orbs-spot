export const MAX_PERCENT_SETTING = 99.99;

export function validPercent(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_PERCENT_SETTING;
}

export function resolvePercent(value: unknown, fallback: number): number {
  return validPercent(value) ? value : fallback;
}
