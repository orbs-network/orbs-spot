"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { useIsMobile } from "@/lib/hooks/use-is-mobile"
import { cn } from "@/lib/utils"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

const ResponsiveDialogContext = React.createContext({ isDrawer: false })

function Dialog({
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const isDrawer = useIsMobile()

  return (
    <ResponsiveDialogContext.Provider value={{ isDrawer }}>
      {isDrawer ? (
        <Drawer {...props}>{children}</Drawer>
      ) : (
        <DialogPrimitive.Root data-slot="dialog" {...props}>
          {children}
        </DialogPrimitive.Root>
      )}
    </ResponsiveDialogContext.Provider>
  )
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  const { isDrawer } = React.useContext(ResponsiveDialogContext)
  const Trigger = isDrawer ? DrawerTrigger : DialogPrimitive.Trigger

  return <Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  const { isDrawer } = React.useContext(ResponsiveDialogContext)
  const Portal = isDrawer ? DrawerPortal : DialogPrimitive.Portal

  return <Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  const { isDrawer } = React.useContext(ResponsiveDialogContext)
  const Close = isDrawer ? DrawerClose : DialogPrimitive.Close

  return <Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  const { isDrawer } = React.useContext(ResponsiveDialogContext)
  const Overlay = isDrawer ? DrawerOverlay : DialogPrimitive.Overlay

  return (
    <Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:duration-200 data-[state=closed]:duration-150 data-[state=open]:ease-out data-[state=closed]:ease-in",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  mobilePresentation = "drawer",
  presentation = "drawer",
  forceMount,
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  mobilePresentation?: "drawer" | "fullscreen"
  presentation?: "drawer" | "center"
}) {
  const { isDrawer } = React.useContext(ResponsiveDialogContext)
  const drawerClasses =
    "inset-x-0 bottom-0 max-h-[92dvh] w-full rounded-t-[22px] border-b-0 p-6 sm:top-[50%] sm:left-[50%] sm:bottom-auto sm:max-w-[calc(100%-2rem)] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-xl sm:border sm:p-6 sm:max-w-lg";
  const centerClasses =
    "top-[50%] left-[50%] max-h-[88dvh] w-[calc(100vw-1.5rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-[22px] p-6";
  const drawerMotionClasses =
    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom data-[state=open]:duration-200 data-[state=closed]:duration-150 data-[state=open]:ease-out data-[state=closed]:ease-in sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95"
  const centerMotionClasses =
    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:duration-200 data-[state=closed]:duration-150 data-[state=open]:ease-out data-[state=closed]:ease-in"
  const desktopContentClasses = cn(
    "fixed z-50 grid gap-4 overflow-hidden border border-border/80 bg-card/98 text-card-foreground",
    presentation === "center" ? centerClasses : drawerClasses,
    presentation === "center" ? centerMotionClasses : drawerMotionClasses,
    className
  )

  if (isDrawer) {
    return (
      <DrawerContent
        forceMount={forceMount}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          onOpenAutoFocus?.(event);
        }}
        data-slot="dialog-content"
        className={cn(
          "grid gap-4 bg-card/98 p-6 text-card-foreground",
          className,
          mobilePresentation === "fullscreen"
            ? "!mt-0 !h-[100dvh] !max-h-[100dvh] !w-screen !max-w-none !rounded-none !border-0 !p-0"
            : "!w-screen !max-w-none rounded-b-none"
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DrawerClose
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DrawerClose>
        )}
      </DrawerContent>
    )
  }

  return (
    <DialogPortal data-slot="dialog-portal" forceMount={forceMount}>
      <DialogOverlay forceMount={forceMount} />
      <DialogPrimitive.Content
        forceMount={forceMount}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          onOpenAutoFocus?.(event);
        }}
        data-slot="dialog-content"
        className={desktopContentClasses}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  const { isDrawer } = React.useContext(ResponsiveDialogContext)
  const Title = isDrawer ? DrawerTitle : DialogPrimitive.Title

  return (
    <Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
}
