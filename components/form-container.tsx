"use client";

import type { ReactNode } from "react";
import { SettingsModal } from "./settings-modal";
import { SpotOrderNavigation } from "./trading-navigation";
import { TradingWorkspace } from "./trading-workspace";
import { useNativeConversion } from "@/lib/hooks/use-native-conversion";

export function FormContainer({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const nativeConversion = useNativeConversion();
  return (
    <TradingWorkspace>
      <div data-trading-card className="contents">
        <div data-form-toolbar className="flex min-w-0 items-center gap-2">
          <SpotOrderNavigation />
          {!nativeConversion && <SettingsModal triggerVariant="icon" className="hidden sm:block" />}
        </div>
        <div data-form-container className="flex w-full flex-col gap-3 rounded-[21px] border border-border/80 bg-card/95 p-3 backdrop-blur">
          {children}
          {!nativeConversion && <SettingsModal triggerVariant="footer" className="sm:hidden" />}
        </div>
      </div>
      {footer && <div data-form-footer className="mt-3">{footer}</div>}
    </TradingWorkspace>
  );
}
