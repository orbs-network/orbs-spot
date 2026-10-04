"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useConnection, useConnectionEffect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import dynamic from "next/dynamic";
import { getActiveClientPartnerConfig } from "@/lib/partners/client";
import { hasOrbsConnectModal } from "@/lib/partners/features";

const OrbsConnectModal = dynamic(
  () => import("./orbs-connect-modal").then((module) => module.OrbsConnectModal),
  // Load the closed modal without showing the app's full-page fallback.
  { loading: () => null },
);
const WalletConnectionContext = createContext<{ openConnectModal?: () => void }>({});
const enabled = hasOrbsConnectModal(getActiveClientPartnerConfig());

export function WalletConnectionProvider({ children }: { children: ReactNode }) {
  const standard = useConnectModal();
  const { isConnected } = useConnection();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openOrbsModal = useCallback(() => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }, []);
  const openConnectModal = enabled ? openOrbsModal : standard.openConnectModal;
  const context = useMemo(() => ({ openConnectModal }), [openConnectModal]);

  useConnectionEffect({ onConnect: () => setOpen(false) });

  return (
    <WalletConnectionContext.Provider value={context}>
      {children}
      {enabled && (
        <OrbsConnectModal
          open={open && !standard.connectModalOpen && !isConnected}
          onOpenChange={setOpen}
          onMoreWallets={() => standard.openConnectModal?.()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!standard.connectModalOpen && triggerRef.current?.isConnected) {
              triggerRef.current.focus({ preventScroll: true });
            }
          }}
        />
      )}
    </WalletConnectionContext.Provider>
  );
}

export function useWalletConnectModal() {
  return useContext(WalletConnectionContext);
}
