"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Slot } from "@radix-ui/react-slot"
import { XIcon } from "lucide-react"

import { useIsMobile } from "@/lib/hooks/use-is-mobile"
import { cn } from "@/lib/utils"
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from "./drawer"
import { Button } from "./button"

const TooltipInteractionContext = React.createContext<"hover" | "drawer" | "none">("hover")

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  children,
  open,
  defaultOpen,
  onOpenChange,
  action = false,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root> & { action?: boolean }) {
  const isMobile = useIsMobile("(max-width: 767px), (hover: none), (pointer: coarse)")
  // Action buttons already explain themselves through their accessible label.
  // Opening a help drawer as well would interrupt cancellation or navigation.
  const interaction = isMobile ? action ? "none" : "drawer" : "hover"
  return (
    <TooltipInteractionContext.Provider value={interaction}>
      {interaction === "none" ? children : interaction === "drawer" ? (
        <Drawer open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
          {children}
        </Drawer>
      ) : (
        <TooltipProvider>
          <TooltipPrimitive.Root data-slot="tooltip" open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} {...props}>
            {children}
          </TooltipPrimitive.Root>
        </TooltipProvider>
      )}
    </TooltipInteractionContext.Provider>
  )
}

function TooltipTrigger({
  asChild,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  const interaction = React.use(TooltipInteractionContext)
  if (interaction === "none") {
    const Trigger = asChild ? Slot : "button"
    return <Trigger data-slot="tooltip-trigger" {...props} />
  }
  const Trigger = interaction === "drawer" ? DrawerTrigger : TooltipPrimitive.Trigger
  const child = React.isValidElement(props.children) ? props.children : undefined
  const needsKeyboardTrigger = interaction === "drawer" && asChild && typeof child?.type === "string" && !["button", "a", "input"].includes(child.type)
  return <Trigger data-slot="tooltip-trigger" asChild={asChild} {...props} role={props.role ?? (needsKeyboardTrigger ? "button" : undefined)} tabIndex={props.tabIndex ?? (needsKeyboardTrigger ? 0 : undefined)} onKeyDown={event => {
    props.onKeyDown?.(event)
    if (needsKeyboardTrigger && !event.defaultPrevented && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault()
      event.currentTarget.click()
    }
  }} />
}

const tooltipArrowClassName = "border-b border-r border-border/80 bg-popover fill-popover z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]"

function TooltipContent({
  className,
  sideOffset = 4,
  collisionPadding = 12,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  const interaction = React.use(TooltipInteractionContext)
  if (interaction === "none") return null
  const contentClassName = cn(
    "origin-(--radix-tooltip-content-transform-origin)",
    "border border-border/80 bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=top]:slide-in-from-bottom-2 data-[side=right]:slide-in-from-left-2 z-50 w-fit max-w-[min(280px,calc(100vw-24px))] rounded-md px-2.5 py-1.5 text-xs leading-4 text-balance break-words whitespace-normal motion-reduce:animate-none",
    className,
  )
  if (interaction === "drawer") {
    return (
        <DrawerContent
          data-mobile-tooltip
          aria-describedby={undefined}
          {...props}
          className="gap-2 px-4 pb-[max(16px,env(safe-area-inset-bottom))]"
        >
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-base font-medium">More information</DrawerTitle>
            <DrawerClose asChild><Button variant="ghost" size="icon" className="size-11" aria-label="Close information"><XIcon aria-hidden="true" className="size-4" /></Button></DrawerClose>
          </div>
          <div data-vaul-no-drag className="min-h-0 overflow-y-auto break-words text-sm leading-relaxed">{children}</div>
        </DrawerContent>
    )
  }
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={contentClassName}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow data-slot="tooltip-arrow" className={tooltipArrowClassName} />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent }
