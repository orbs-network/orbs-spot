"use client";

import { X } from "lucide-react";

export function ToastCloseButton({ onClose }: { onClose: () => void }) {
  return <button type="button" aria-label="Close toast" data-toast-close
    onClick={event => { event.stopPropagation(); onClose(); }}>
    <X aria-hidden="true" className="size-4" />
  </button>;
}
