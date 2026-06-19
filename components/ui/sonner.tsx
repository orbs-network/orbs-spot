"use client"

import type { CSSProperties } from "react"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const TOAST_Z_INDEX = 100

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="top-right"
      closeButton
      expand={false}
      visibleToasts={3}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "18px",
          zIndex: TOAST_Z_INDEX,
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "border-border/80 bg-popover/95 text-popover-foreground backdrop-blur-xl",
          title: "font-semibold",
          description: "text-muted-foreground",
          actionButton:
            "rounded-xl bg-primary px-3 py-1.5 text-primary-foreground",
          cancelButton:
            "rounded-xl border border-border bg-secondary px-3 py-1.5 text-foreground",
          closeButton:
            "border-border bg-popover text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
