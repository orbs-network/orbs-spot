"use client";

import type { ReactNode } from "react";
import { toast, type ExternalToast } from "sonner";
import { ToastCloseButton } from "@/components/ui/toast-close-button";

/** Dismissing progress hides its updates without interrupting the operation. */
export function createLoadingToast(id: string | number) {
  let dismissed = false;
  const close = () => {
    dismissed = true;
    toast.dismiss(id);
  };
  return {
    show(title: ReactNode, options: Omit<ExternalToast, "id"> = {}) {
      if (dismissed) return;
      toast.loading(title, {
        ...options,
        id,
        description: <>
          <span data-loading-toast-close><ToastCloseButton onClose={close} /></span>
          {typeof options.description === "function" ? options.description() : options.description}
        </>,
      });
    },
  };
}
