"use client";

import { type ComponentProps, forwardRef, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ChevronDownIcon, CopyIcon, LogOutIcon, WalletIcon } from "lucide-react";
import { useDisconnect, useSwitchChain } from "wagmi";
import { toast } from "sonner";
import { cn, makeEllipsisAddress } from "@/lib/utils";
import { CHAIN_LOGO_URLS, MAIN_CHAINS, SPOT_CHAINS } from "@/lib/consts";
import { useIsSpotTab } from "@/lib/hooks/use-form-tab";
import type { PartnerBrand } from "@/lib/partners/types";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

const navPillClass =
  "inline-flex h-10 items-center gap-2 rounded-full border border-border/70 bg-[var(--nav-pill-background)] px-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/30 hover:bg-[var(--nav-pill-hover-background)] focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:outline-none";

const NavPillButton = forwardRef<HTMLButtonElement, ComponentProps<"button">>(
  function NavPillButton({ children, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(navPillClass, className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);

function PopoverMenuButton({
  children,
  className,
  size = "default",
  tone = "default",
  ...props
}: ComponentProps<"button"> & {
  size?: "default" | "large";
  tone?: "default" | "destructive";
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-3 rounded-[11px] px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none",
        size === "large" ? "h-12" : "h-11",
        tone === "destructive"
          ? "text-destructive hover:bg-destructive/8 focus-visible:bg-destructive/8"
          : "text-foreground hover:bg-secondary/55 focus-visible:bg-secondary/55",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

const CHAIN_LABELS: Record<number, string> = {
  1: "Ethereum",
  56: "BNB Chain",
  137: "Polygon",
  8453: "Base",
  42161: "Arbitrum One",
  59144: "Linea",
  146: "Sonic",
  1329: "Sei",
  80094: "Berachain",
  14: "Flare",
  43114: "Avalanche",
  747474: "Katana",
  10: "Optimism",
  5000: "Mantle",
  999: "HyperEVM",
  130: "Unichain",
  196: "X Layer",
  4326: "MegaETH",
  10143: "Monad",
};

const getChainLabel = (chainId?: number, fallback?: string) => {
  if (!chainId) return fallback ?? "Network";
  return CHAIN_LABELS[chainId] ?? fallback ?? "Network";
};

const getChainIconUrl = (chainId?: number) => {
  if (!chainId) return undefined;
  return CHAIN_LOGO_URLS[chainId as keyof typeof CHAIN_LOGO_URLS];
};

const ChainIcon = ({
  iconUrl,
  iconBackground,
  name,
}: {
  iconUrl?: string;
  iconBackground?: string;
  name?: string;
}) => {
  return (
    <span
      className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 text-[8px] font-bold"
      style={{ background: iconBackground ?? "var(--secondary)" }}
    >
      {iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={iconUrl} alt={name ?? "Network"} className="size-full" />
      ) : (
        name?.slice(0, 1) ?? "N"
      )}
    </span>
  );
};

const ChainSelectorPopover = ({
  currentChainId,
  currentChainName,
  currentChainIconUrl,
  currentChainIconBackground,
  isUnsupported,
}: {
  currentChainId?: number;
  currentChainName?: string;
  currentChainIconUrl?: string;
  currentChainIconBackground?: string;
  isUnsupported?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const switchChain = useSwitchChain();
  const isSpotTab = useIsSpotTab();
  const availableChains = isSpotTab ? SPOT_CHAINS : MAIN_CHAINS;
  const chainOptions = useMemo(
    () =>
      availableChains.map((supportedChain) => ({
        id: supportedChain.id,
        label: getChainLabel(supportedChain.id, supportedChain.name),
        iconUrl: getChainIconUrl(supportedChain.id),
      })),
    [availableChains],
  );
  const isUnavailableForTab = !availableChains.some(
    (chain) => chain.id === currentChainId,
  );
  const isWrongNetwork = isUnsupported || isUnavailableForTab;
  const currentLabel = isWrongNetwork
    ? "Wrong network"
    : getChainLabel(currentChainId, currentChainName);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <NavPillButton
          className={cn(
            "pr-2.5",
            isWrongNetwork && "border-destructive/60 text-destructive",
          )}
        >
          <ChainIcon
            iconUrl={getChainIconUrl(currentChainId) ?? currentChainIconUrl}
            iconBackground={currentChainIconBackground}
            name={currentLabel}
          />
          <span className="hidden max-w-[132px] truncate sm:inline">
            {currentLabel}
          </span>
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </NavPillButton>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        drawerTitle="Select chain"
        className="max-h-[min(520px,calc(100vh-96px))] w-[174px] overflow-y-auto rounded-[14px] border-primary/35 bg-popover/98 p-2"
      >
        <div className="flex flex-col gap-1">
          {chainOptions.map((option) => {
            const selected = currentChainId === option.id && !isWrongNetwork;
            return (
              <PopoverMenuButton
                key={option.id}
                size="large"
                onClick={() => {
                  setOpen(false);
                  if (!selected) {
                    switchChain.mutate({ chainId: option.id });
                  }
                }}
                className={cn(selected && "text-primary")}
              >
                <ChainIcon iconUrl={option.iconUrl} name={option.label} />
                <span className="min-w-0 truncate">{option.label}</span>
              </PopoverMenuButton>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const WalletAvatar = ({ label }: { label?: string }) => {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <WalletIcon className="size-3.5" />
      <span className="sr-only">{label ?? "Wallet"}</span>
    </span>
  );
};

const WalletAccountPopover = ({
  address,
  displayName,
}: {
  address: string;
  displayName: string;
}) => {
  const [open, setOpen] = useState(false);
  const disconnect = useDisconnect();

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success("Address copied");
      setOpen(false);
    } catch {
      toast.error("Failed to copy address");
    }
  };

  const disconnectWallet = () => {
    setOpen(false);
    disconnect.mutate({});
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <NavPillButton className="max-w-[138px] pr-2.5">
          <WalletAvatar label={displayName} />
          <span className="min-w-0 truncate">{displayName}</span>
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </NavPillButton>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        drawerTitle="Wallet menu"
        className="w-[176px] rounded-[14px] border-primary/60 bg-popover/98 p-2"
      >
        <div className="flex flex-col gap-1">
          <PopoverMenuButton onClick={() => void copyAddress()}>
            <CopyIcon className="size-4 text-muted-foreground" />
            <span>Copy address</span>
          </PopoverMenuButton>
          <PopoverMenuButton onClick={disconnectWallet} tone="destructive">
            <LogOutIcon className="size-4" />
            <span>Disconnect</span>
          </PopoverMenuButton>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const NavWalletControls = () => {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        authenticationStatus,
        openConnectModal,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus ||
            authenticationStatus === "authenticated");

        if (!ready) {
          return (
            <div
              aria-hidden="true"
              className="h-10 w-[112px] rounded-full bg-secondary/80 opacity-0"
            />
          );
        }

        if (!connected) {
          return (
            <NavPillButton
              onClick={openConnectModal}
              className="bg-primary px-4 text-primary-foreground hover:bg-primary/74"
            >
              Connect Wallet
            </NavPillButton>
          );
        }

        return (
          <div className="flex items-center gap-2">
            <ChainSelectorPopover
              currentChainId={chain.id}
              currentChainName={chain.name}
              currentChainIconUrl={chain.iconUrl}
              currentChainIconBackground={chain.iconBackground}
              isUnsupported={chain.unsupported}
            />
            <WalletAccountPopover
              address={account.address}
              displayName={makeEllipsisAddress(account.address, {
                start: 5,
                end: 4,
              })}
            />
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};

export function Navigation({ brand }: { brand: PartnerBrand }) {
  return (
    <nav className="fixed left-0 right-0 top-0 z-50 w-full max-w-none rounded-none border-0 bg-background/88 px-4 py-3 shadow-none backdrop-blur-xl">
      <div className="flex w-full flex-wrap items-center gap-3">
        <Link
          href="/"
          className="flex min-h-8 shrink-0 items-center gap-2.5 no-underline"
          aria-label={`${brand.name} trading`}
        >
          {brand.logoSrc && (
            <Image
              src={brand.logoSrc}
              alt={brand.logoAlt}
              width={150}
              height={50}
              priority
              className="h-7 w-auto object-contain sm:h-8"
            />
          )}
          <span className="text-lg font-semibold tracking-normal text-foreground">
            {brand.name}
          </span>
        </Link>
        <div className="order-1 flex w-full shrink-0 items-center justify-start gap-2 sm:order-none sm:ml-auto sm:w-auto">
          <NavWalletControls />
        </div>
      </div>
    </nav>
  );
}
