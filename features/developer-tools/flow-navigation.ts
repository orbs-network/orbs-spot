/** Drop later steps so returning to a completed step requires running it again. */
export function rewindFlow<Step extends string>(
  navigation: { history: Step[]; viewedIndex: number },
  targetIndex: number,
) {
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= navigation.history.length - 1) {
    return navigation;
  }
  return {
    history: navigation.history.slice(0, targetIndex + 1),
    viewedIndex: targetIndex,
  };
}

export function remainingWrapAmount(required: bigint, wrapped: bigint): bigint {
  return required > wrapped ? required - wrapped : BigInt(0);
}
