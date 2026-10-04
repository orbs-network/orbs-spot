"use client";

import { useEffect, useRef, useState } from "react";
import { WalletButton, type WalletButtonRendererProps } from "@rainbow-me/rainbowkit";
import { ArrowRightIcon, ChevronRightIcon, WalletIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

type WalletState = Parameters<WalletButtonRendererProps["children"]>[0];
const WALLETS = ["metaMask", "phantom", "rabby", "coinbase", "rainbow", "walletConnectModal"];

function ConnectorIcon({ source }: { source: WalletState["connector"]["iconUrl"] }) {
  const [resolved, setResolved] = useState(typeof source === "string" ? source : "");
  useEffect(() => {
    if (typeof source === "string") return;
    let active = true;
    source().then((url) => { if (active) setResolved(url); }).catch(() => {});
    return () => { active = false; };
  }, [source]);
  return resolved
    // Wallet artwork comes from the configured RainbowKit connectors.
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={resolved} alt="" width={28} height={28} className="size-7 shrink-0 object-contain" />
    : <WalletIcon aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />;
}

function WalletOption({ connector, connect, ready, mounted, loading, error }: WalletState) {
  const installed = connector.installed && (connector.type === "injected" || connector.type === "metaMask");
  return (
    <div>
      <button
        type="button"
        data-wallet-option
        disabled={!mounted || !ready || loading}
        aria-busy={loading}
        onClick={() => void connect()}
      >
        <ConnectorIcon source={connector.iconUrl} />
        <span className="min-w-0 flex-1 truncate">{connector.name}</span>
        {loading ? <Spinner className="size-4" /> : installed ? <span data-wallet-badge>Installed</span> : <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
      </button>
      {loading && <p role="status" className="px-5 pb-3 text-xs text-muted-foreground">Confirm the connection in {connector.name}.</p>}
      {error && <p role="alert" className="px-5 pb-3 text-xs text-destructive">Connection wasn’t completed. Select the wallet to try again.</p>}
    </div>
  );
}

export function OrbsConnectModal({ open, onOpenChange, onMoreWallets, onCloseAutoFocus }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoreWallets: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} responsive={false}>
      <DialogContent
        ref={dialogRef}
        data-orbs-connect
        presentation="center"
        aria-describedby="orbs-connect-description"
        onOpenAutoFocus={() => dialogRef.current?.focus({ preventScroll: true })}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <div data-connect-brand>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/orbs-logo.svg" alt="" width={28} height={28} />
          <span>Orbs</span>
        </div>
        <div data-connect-intro>
          <p data-connect-welcome>Welcome</p>
          <DialogTitle>Get started</DialogTitle>
          <p id="orbs-connect-description">Connect your wallet to trade with Orbs.</p>
        </div>
        <div data-wallet-options aria-label="Choose a wallet">
          {WALLETS.map((wallet) => <WalletButton.Custom key={wallet} wallet={wallet}>
            {(state) => <WalletOption {...state} />}
          </WalletButton.Custom>)}
          <button type="button" data-wallet-option onClick={onMoreWallets}>
            <span className="flex-1">More wallet options</span>
            <ChevronRightIcon aria-hidden="true" className="size-5 text-muted-foreground" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
