"use client";

import { MenuIcon, MoonIcon, SunIcon, XIcon } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { Button } from "./ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from "./ui/drawer";

export function MobileNavigationMenu() {
  const { theme, setTheme } = useTheme();

  return <div data-mobile-navigation-menu>
    <Drawer>
      <DrawerTrigger asChild>
        <button data-icon-button type="button" aria-label="Open navigation menu" className="flex size-11 items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-primary">
          <MenuIcon aria-hidden="true" className="size-6" />
        </button>
      </DrawerTrigger>
      <DrawerContent data-mobile-navigation-drawer aria-describedby={undefined} className="gap-2 px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <DrawerTitle className="text-base font-medium">Navigation</DrawerTitle>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" className="size-11" aria-label="Close navigation menu"><XIcon aria-hidden="true" className="size-4" /></Button>
          </DrawerClose>
        </div>
        <div className="flex flex-col gap-1">
          <Button variant="ghost" className="h-11 justify-start gap-3 rounded-xl px-3 font-normal" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <SunIcon aria-hidden="true" className="size-4" /> : <MoonIcon aria-hidden="true" className="size-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  </div>;
}
