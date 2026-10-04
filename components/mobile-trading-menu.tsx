"use client";

import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { MenuIcon, XIcon } from "lucide-react";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { NavPillButton } from "./ui/nav-pill";
import { TradingNavigation } from "./trading-navigation";

export function MobileTradingMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile("(max-width: 1023px)");
  if (open && !isMobile) setOpen(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <NavPillButton data-mobile-menu-trigger aria-label="Open trading menu" className="size-10 justify-center p-0 lg:hidden">
          <MenuIcon aria-hidden="true" className="size-5" />
        </NavPillButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay data-slot="dialog-overlay" className="dialog-overlay-motion fixed inset-0 z-[60] bg-black/40" />
        <Dialog.Content data-mobile-trading-menu aria-describedby={undefined}
          className="mobile-trading-menu-motion fixed inset-y-0 right-0 z-[60] flex w-full max-w-[360px] flex-col border-l border-border bg-background text-foreground">
          <div className="flex min-h-16 items-center justify-between border-b border-border px-5">
            <Dialog.Title className="text-lg font-medium">Trading</Dialog.Title>
            <Dialog.Close asChild>
              <NavPillButton aria-label="Close trading menu" className="size-11 justify-center p-0"><XIcon aria-hidden="true" className="size-5" /></NavPillButton>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4">
            <TradingNavigation onNavigate={() => setOpen(false)} />
            <div className="mt-5 flex items-center justify-between border-t border-border px-5 pt-5">
              <span className="text-sm text-muted-foreground">Appearance</span>
              {children}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
