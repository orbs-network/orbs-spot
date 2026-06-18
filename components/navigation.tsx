"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ChevronDownIcon, WalletIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PartnerBrand } from "@/lib/partners/types";

const navPillClass =
  "inline-flex h-10 items-center gap-2 rounded-full border border-border/70 bg-[var(--nav-pill-background)] px-3 text-sm font-semibold text-foreground shadow-[var(--nav-pill-shadow)] transition-colors hover:border-primary/45 hover:bg-[var(--nav-pill-hover-background)] focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:outline-none";

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
      className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 text-[10px] font-bold"
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

const WalletAvatar = ({ label }: { label?: string }) => {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--wallet-avatar-shadow)]">
      <WalletIcon className="size-3.5" />
      <span className="sr-only">{label ?? "Wallet"}</span>
    </span>
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
        openAccountModal,
        openChainModal,
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
              className="h-10 w-[140px] rounded-full bg-secondary/80 opacity-0"
            />
          );
        }

        if (!connected) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className={cn(
                navPillClass,
                "bg-primary px-4 text-primary-foreground hover:bg-[var(--ring)]"
              )}
            >
              Connect Wallet
            </button>
          );
        }

        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openChainModal}
              className={cn(
                navPillClass,
                chain.unsupported && "border-destructive/60 text-destructive"
              )}
            >
              <ChainIcon
                iconUrl={chain.iconUrl}
                iconBackground={chain.iconBackground}
                name={chain.name}
              />
              <span className="max-w-[118px] truncate">
                {chain.unsupported ? "Wrong network" : chain.name}
              </span>
              <ChevronDownIcon className="size-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={openAccountModal}
              className={cn(navPillClass, "max-w-[172px] pr-2.5")}
            >
              <WalletAvatar label={account.displayName} />
              <span className="min-w-0 truncate">{account.displayName}</span>
              <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};

export function Navigation({ brand }: { brand: PartnerBrand }) {
  const pathname = usePathname();
  const navItems: Array<{ label: string; path: string; external: boolean }> = [
    { label: "Swap", path: "/", external: false },
  ];

  if (brand.externalUrl) {
    navItems.push({
      label: "Company",
      path: brand.externalUrl,
      external: true,
    });
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border/80 bg-background/88 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <Link
          href="/"
          className="flex min-h-8 shrink-0 items-center no-underline"
          aria-label={`${brand.name} trading`}
        >
          {brand.logoSrc ? (
            <Image
              src={brand.logoSrc}
              alt={brand.logoAlt}
              width={150}
              height={50}
              priority
              className="h-7 w-auto object-contain sm:h-8"
            />
          ) : (
            <span className="text-lg font-semibold tracking-normal text-foreground">
              {brand.name}
            </span>
          )}
        </Link>
        <div className="order-2 flex w-full min-w-0 items-center gap-1 overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
          {navItems.map(({ label, path, external }) => {
            const isActive =
              !external &&
              (path === "/" ? pathname === "/" : pathname.startsWith(path));
            const className = `rounded-lg px-3 py-2 text-sm font-medium no-underline transition-colors ${
              isActive
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
            }`;
            return external ? (
              <a
                key={path}
                href={path}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {label}
              </a>
            ) : (
              <Link key={path} href={path} className={className}>
                {label}
              </Link>
            );
          })}
        </div>
        <div className="order-1 flex w-full shrink-0 items-center justify-start gap-2 sm:order-none sm:ml-auto sm:w-auto">
          <NavWalletControls />
        </div>
      </div>
    </nav>
  );
}
