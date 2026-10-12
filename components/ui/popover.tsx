"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

const ResponsivePopoverContext = React.createContext({ isDrawer: false });

function Popover({
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  const isDrawer = useIsMobile("(max-width: 767px)");

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
  const { isDrawer } = React.use(ResponsivePopoverContext);
  const Trigger = isDrawer ? DrawerTrigger : PopoverPrimitive.Trigger;

  return <Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  children,
  align = "center",
  sideOffset = 8,
  collisionPadding,
  drawerTitle = "Menu",
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
  drawerTitle?: string;
}) {
  const { isDrawer } = React.use(ResponsivePopoverContext);

  if (isDrawer) {
    return (
      <DrawerContent
        data-slot="popover-content"
        aria-describedby={undefined}
        className={cn(
          "overscroll-contain p-4",
          className,
          "bg-card/98 text-card-foreground",
          "!max-h-[85dvh] !w-screen !max-w-none rounded-t-[24px]! rounded-b-none",
        )}
        {...props}
      >
        <DrawerTitle className="sr-only">{drawerTitle}</DrawerTitle>
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
        collisionPadding={collisionPadding}
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
