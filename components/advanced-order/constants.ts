import { Module, TimeUnit } from "@orbs-network/spot-ui";

export const DURATION_OPTIONS = [
  { text: "Minutes", value: TimeUnit.Minutes },
  { text: "Hours", value: TimeUnit.Hours },
  { text: "Days", value: TimeUnit.Days },
] as const;

export const MODULE_META = {
  [Module.TWAP]: {
    titleKey: "twapMarket",
  },
  [Module.LIMIT]: {
    titleKey: "limit",
  },
  [Module.STOP_LOSS]: {
    titleKey: "stopLoss",
  },
  [Module.TAKE_PROFIT]: {
    titleKey: "takeProfit",
  },
} as const;

export const WRAP_TOAST_ID = "spot-wrap-token";
export const APPROVE_TOAST_ID = "spot-approve-token";
export const CREATE_ORDER_TOAST_ID = "spot-create-order";
export const CANCEL_ORDER_TOAST_ID = "spot-cancel-order";

