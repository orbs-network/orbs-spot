/** Defer notifications until review closes; success seen in review needs no toast. */
export function createSubmissionToast({ isModalOpen, subscribe }: {
  isModalOpen: () => boolean;
  subscribe: (listener: () => void) => () => void;
}) {
  let deferred = isModalOpen();
  let pending: (() => void) | undefined;
  let unsubscribe: (() => void) | undefined;

  if (deferred) {
    unsubscribe = subscribe(() => {
      if (isModalOpen()) return;
      deferred = false;
      const show = pending;
      pending = undefined;
      unsubscribe?.();
      unsubscribe = undefined;
      show?.();
    });
  }

  return {
    isDeferred: () => deferred,
    publish(show: () => void) {
      if (deferred) pending = show;
      else show();
    },
    publishSuccess(show: () => void) {
      if (deferred) pending = undefined;
      else show();
    },
  };
}
