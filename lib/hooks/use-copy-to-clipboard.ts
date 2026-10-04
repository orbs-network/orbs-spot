"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCopyToClipboard({
  successMessage,
  errorMessage,
  toastId,
  onSuccess,
}: {
  successMessage: string;
  errorMessage: string;
  toastId?: string;
  onSuccess?: () => void;
}) {
  return useMutation({
    mutationFn: (text: string) => navigator.clipboard.writeText(text),
    // Clipboard access works offline and must never queue for reconnection.
    networkMode: "always",
    retry: false,
    onSuccess: () => {
      toast.success(successMessage, { id: toastId });
      onSuccess?.();
    },
    onError: () => { toast.error(errorMessage, { id: toastId }); },
  });
}
