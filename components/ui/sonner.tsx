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
      theme="light"
      className="toaster group"
      position="top-right"
      closeButton
      expand={false}
      richColors
      visibleToasts={3}
      icons={{
        success: <CircleCheckIcon aria-hidden="true" className="size-4" />,
        info: <InfoIcon aria-hidden="true" className="size-4" />,
        warning: <TriangleAlertIcon aria-hidden="true" className="size-4" />,
        error: <OctagonXIcon aria-hidden="true" className="size-4" />,
        loading: <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-bg-hover": "var(--secondary)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--normal-border-hover": "color-mix(in srgb, var(--foreground) 18%, var(--border))",
          "--success-bg": "var(--popover)",
          "--success-border": "color-mix(in srgb, var(--primary) 30%, var(--border))",
          "--success-text": "var(--primary)",
          "--info-bg": "var(--popover)",
          "--info-border": "color-mix(in srgb, var(--accent) 70%, var(--border))",
          "--info-text": "var(--accent-foreground)",
          "--warning-bg": "var(--popover)",
          "--warning-border": "color-mix(in srgb, var(--ring) 42%, var(--border))",
          "--warning-text": "var(--foreground)",
          "--error-bg": "var(--popover)",
          "--error-border": "color-mix(in srgb, var(--destructive) 32%, var(--border))",
          "--error-text": "var(--destructive)",
          "--toast-title-color": "var(--popover-foreground)",
          "--toast-description-color": "var(--muted-foreground)",
          "--border-radius": "18px",
          zIndex: TOAST_Z_INDEX,
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "border-border/80 bg-popover/95 text-popover-foreground backdrop-blur-xl",
          title: "font-semibold !text-[var(--toast-title-color)]",
          description: "!text-[var(--toast-description-color)]",
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
