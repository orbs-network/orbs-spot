"use client";
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard";
import { type ComponentProps, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ChevronDownIcon, CopyIcon, LogOutIcon, WalletIcon, SunIcon, MoonIcon, ExternalLinkIcon, GlobeIcon } from "lucide-react";
import { useConnection, useDisconnect } from "wagmi";
import { preserveDeveloperModeInHref, useDeveloperMode } from "@/lib/hooks/use-developer-mode";
import { cn, makeEllipsisAddress } from "@/lib/utils";
import { DeveloperNavigation, DeveloperMoreNavigation } from "@developer-tools";
import { NavPillButton } from "./ui/nav-pill";
import { useTheme } from "@/lib/theme";
import type { PartnerBrand } from "@/lib/partners/types";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Spinner } from "./ui/spinner";
import { useWalletConnectModal } from "@/features/wallet-connection/provider";
import { IS_ORBS } from "@/lib/partners/client";
import { TradingNavigation } from "./trading-navigation";

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
      data-wallet-action={tone}
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

const WalletAvatar = ({ label }: { label?: string }) => {
  return (
    <span data-wallet-avatar className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <WalletIcon aria-hidden="true" className="size-3.5" />
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

  const { mutate: copyAddress } = useCopyToClipboard({
    successMessage: "Address copied",
    errorMessage: "Failed to copy address",
    onSuccess: () => setOpen(false),
  });

  const disconnectWallet = () => {
    setOpen(false);
    disconnect.mutate({});
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <NavPillButton
          className="max-w-[138px] pr-2.5"
          aria-label={`Open wallet menu for ${displayName}`}
          data-wallet-account-trigger
        >
          <WalletAvatar label={displayName} />
          <span data-wallet-account-label className="min-w-0 truncate">{displayName}</span>
          <ChevronDownIcon
            aria-hidden="true"
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
          <PopoverMenuButton onClick={() => void copyAddress(address)}>
            <CopyIcon aria-hidden="true" className="size-4 text-muted-foreground" />
            <span>Copy address</span>
          </PopoverMenuButton>
          <PopoverMenuButton onClick={disconnectWallet} tone="destructive">
            <LogOutIcon aria-hidden="true" className="size-4" />
            <span>Disconnect</span>
          </PopoverMenuButton>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const NavWalletControls = () => {
  const { isConnecting, isReconnecting } = useConnection();
  const { openConnectModal } = useWalletConnectModal();

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        authenticationStatus,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus ||
            authenticationStatus === "authenticated");

        if (!ready || isConnecting || isReconnecting) {
          return (
            <NavPillButton
              data-primary-nav-pill
              disabled
              aria-busy="true"
              aria-label="Connecting wallet"
              className="w-10 justify-center sm:w-auto sm:min-w-[139px] sm:px-4"
            >
              <Spinner aria-hidden="true" className="motion-reduce:animate-none" />
              <span className="hidden sm:inline">Connecting…</span>
            </NavPillButton>
          );
        }

        if (!connected) {
          return (
            <NavPillButton
              data-primary-nav-pill
              aria-label="Connect Wallet"
              onClick={openConnectModal}
              className="w-10 justify-center bg-primary p-0 text-primary-foreground hover:bg-primary/74 sm:w-auto sm:px-4"
            >
              <WalletIcon data-connect-wallet-icon aria-hidden="true" className="size-4 sm:hidden" />
              <span data-connect-wallet-label className="hidden sm:inline">Connect Wallet</span>
              {IS_ORBS && <span data-mobile-connect-label className="hidden">Connect</span>}
            </NavPillButton>
          );
        }

        return (
          <div className="flex items-center gap-2">
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
  const { isDeveloperMode } = useDeveloperMode();
  const pathname = usePathname();
  const isDeveloperGuideRoute = pathname === "/developers" || pathname.startsWith("/developers/");

  return (
    <header data-app-header className="fixed left-0 right-0 top-0 z-50 w-full max-w-none rounded-none border-0 px-4 py-3 shadow-none [background:var(--nav-background)] backdrop-blur-xl">
      <div data-nav-layout className="flex w-full flex-nowrap items-center gap-2 sm:gap-3">
        <Link
          data-nav-brand
          href={preserveDeveloperModeInHref("/", isDeveloperMode)}
          className="flex min-h-8 min-w-0 shrink items-center gap-2.5 no-underline"
          aria-label={`${brand.name} trading`}
        >
          {brand.logoSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoSrc}
              alt={brand.logoAlt}
              width={160}
              height={40}
              fetchPriority="high"
              className={cn(
                "h-7 max-w-[112px] object-contain sm:h-10 sm:max-w-none",
                brand.navLogoClassName,
              )}
            />
          )}
          {!brand.logoSrc && (
            <span className="text-lg font-semibold tracking-normal text-foreground">
              {brand.name}
            </span>
          )}
          {brand.navWordmark && (
            <span data-nav-wordmark className="text-xl font-normal uppercase tracking-[0.12em] text-foreground">
              {brand.navWordmark}
            </span>
          )}
        </Link>
        {IS_ORBS && <TradingNavigation />}
        <div data-nav-actions className="ml-auto flex w-auto shrink-0 items-center justify-end gap-1.5 sm:gap-2">
          <DeveloperNavigation />
          {IS_ORBS && (
            <a data-orbs-website-link href="https://www.orbs.com/" target="_blank" rel="noopener noreferrer">
              <GlobeIcon aria-hidden="true" className="size-4 sm:hidden" />
              <span className="sr-only sm:not-sr-only">Orbs website</span>
              <ExternalLinkIcon aria-hidden="true" className="hidden size-3 sm:block" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
          {!isDeveloperGuideRoute && <NavWalletControls />}
          <DeveloperMoreNavigation isDeveloperMode={isDeveloperMode} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <NavPillButton aria-label={label} onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="w-10 shrink-0 justify-center p-0">
      <SunIcon aria-hidden="true" className="hidden size-4 dark:block" />
      <MoonIcon aria-hidden="true" className="size-4 dark:hidden" />
    </NavPillButton>
  );
}
