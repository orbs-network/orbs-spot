/** Recognize declined wallet prompts without depending on a wallet or UI library. */
export function isUserRejectedError(error: unknown): boolean {
  const visited = new Set<object>();
  const rejected = (value: unknown): boolean => {
    if (!value || typeof value !== "object" || visited.has(value)) return false;
    visited.add(value);
    const record = value as Record<string, unknown>;
    if ([4001, "4001", "ACTION_REJECTED"].includes(record.code as string | number)) return true;
    for (const field of [record.code, record.name, record.message, record.shortMessage, record.details, record.reason]) {
      if (typeof field === "string" && /rejected|denied|declined/i.test(field)) return true;
    }
    return rejected(record.cause) || rejected(record.error);
  };
  return rejected(error);
}
