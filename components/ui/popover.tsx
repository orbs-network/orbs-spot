"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { XIcon } from "lucide-react";

const ResponsivePopoverContext = React.createContext({ isDrawer: false });

function Popover({
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  const isDrawer = useIsMobile();

  return (
    <ResponsivePopoverContext.Provider value={{ isDrawer }}>
      {isDrawer ? (
        <Drawer {...props}>{children}</Drawer>
      ) : (
        <PopoverPrimitive.Root data-slot="popover" {...props}>
          {children}
        </PopoverPrimitive.Root>
      )}
    </ResponsivePopoverContext.Provider>
  );
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  const { isDrawer } = React.useContext(ResponsivePopoverContext);
  const Trigger = isDrawer ? DrawerTrigger : PopoverPrimitive.Trigger;

  return <Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  children,
  align = "center",
  sideOffset = 8,
  drawerTitle = "Menu",
  mobilePresentation = "drawer",
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
  drawerTitle?: string;
  mobilePresentation?: "drawer" | "fullscreen";
}) {
  const { isDrawer } = React.useContext(ResponsivePopoverContext);

  if (isDrawer) {
    const isFullscreen = mobilePresentation === "fullscreen";

    return (
      <DrawerContent
        data-slot="popover-content"
        className={cn(
          "p-4",
          className,
          "bg-card/98 text-card-foreground",
          isFullscreen
            ? "!mt-0 !flex !h-[100dvh] !max-h-[100dvh] !w-screen !max-w-none !rounded-none !border-0 bg-card !p-0 [&>div:first-child]:hidden"
            : "max-h-[85dvh] !w-screen !max-w-none rounded-b-none",
        )}
        {...props}
      >
        {isFullscreen ? (
          <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-border/70 px-5 pt-[env(safe-area-inset-top)]">
            <DrawerTitle className="text-[20px] font-bold leading-none">
              {drawerTitle}
            </DrawerTitle>
            <DrawerClose asChild>
              <button
                type="button"
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:outline-none"
                aria-label="Close"
              >
                <XIcon className="size-5" />
              </button>
            </DrawerClose>
          </div>
        ) : (
          <DrawerTitle className="sr-only">{drawerTitle}</DrawerTitle>
        )}
        {children}
      </DrawerContent>
    );
  }

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-[14px] border border-border/80 bg-popover text-popover-foreground outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverContent, PopoverTrigger };
