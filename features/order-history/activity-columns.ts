export const ACTIVITY_COLUMNS = [
  { key: "chain", label: "Chain" },
  { key: "type", label: "Order type" },
  { key: "status", label: "Status" },
  { key: "placed", label: "Created at" },
  { key: "tokens", label: "Tokens" },
  { key: "sell", label: "Sell" },
  { key: "filled", label: "Filled" },
  { key: "average", label: "Avg. fill price" },
] as const;

const DEBUG_ACTIVITY_COLUMNS = [
  ACTIVITY_COLUMNS[0],
  { key: "partner", label: "Partner" },
  ...ACTIVITY_COLUMNS.slice(1),
] as const;

export type ActivityColumn = (typeof DEBUG_ACTIVITY_COLUMNS)[number];

export function getActivityColumns(debug: boolean): readonly ActivityColumn[] {
  return debug ? DEBUG_ACTIVITY_COLUMNS : ACTIVITY_COLUMNS;
}
