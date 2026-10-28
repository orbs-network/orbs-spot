import type { ExecutionSnapshot } from "./execution";

/** The visible review can leave a submission running in the background. */
export function createOrderSubmissionManager(
  onChange: (snapshot?: ExecutionSnapshot) => void,
) {
  let sequence = 0;
  let current: { id: number; busy: boolean } | undefined;

  const clear = () => {
    current = undefined;
    onChange();
  };

  return {
    start() {
      if (current?.busy) throw new Error("An order is already being submitted");
      const submission = { id: ++sequence, busy: true };
      current = submission;
      return {
        id: submission.id,
        isCurrent: () => current === submission,
        publish(snapshot: ExecutionSnapshot) {
          if (current === submission) onChange(snapshot);
        },
        complete() {
          submission.busy = false;
        },
      };
    },
    isBusy: () => current?.busy ?? false,
    // Detaching only releases the review. It never cancels wallet/server work.
    detach: clear,
    reset() {
      if (current?.busy) return false;
      clear();
      return true;
    },
  };
}
