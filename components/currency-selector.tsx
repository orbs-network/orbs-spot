import React, {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { PlusIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Virtuoso } from "react-virtuoso";
import { Currency } from "@/lib/types";
import { useFormatNumber } from "@/lib/hooks/common";
import BN from "bignumber.js";
import { useConnection } from "wagmi";
import {
  getTokenKey,
  getPopularTokenForChain,
  isNativeAddress,
  makeEllipsisAddress,
  toAmountUI,
} from "@/lib/utils";
import { Input } from "./ui/input";
import { Skeleton } from "./ui/skeleton";
import { useCurrencies } from "@/lib/hooks/use-currencies";
import { CurrencyLogo } from "./ui/currency-logo";
import { useUserStore } from "@/lib/hooks/store";
import { DEFAULT_CHAIN_ID } from "@/lib/consts";

type Props = {
  onCurrencyChange: (currency: Currency) => void;
  trigger?: React.ReactNode;
};

const PopularTokens = ({
  onCurrencyChange,
  currencies,
}: {
  onCurrencyChange: (currency: Currency) => void;
  currencies: Currency[];
}) => {
  if (!currencies.length) {
    return null;
  }

  return (
    <div className="grid grid-cols-5 gap-2 px-3 pb-3">
      {currencies.map((c) => (
        <DialogClose key={c.address}>
          <div
            className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-border/60 bg-secondary p-3 transition-colors hover:border-primary/25 hover:bg-muted/45"
            onClick={() => onCurrencyChange(c)}
          >
            <CurrencyLogo
              currency={c}
              className="size-6"
              fallbackClassName="text-[9px]"
            />
            <p className="text-[10px] font-semibold text-ellipsis whitespace-nowrap overflow-hidden max-w-[44px] cursor-pointer">
              {c.symbol}
            </p>
          </div>
        </DialogClose>
      ))}
    </div>
  );
};

const SearchInput = ({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) => {
  return (
    <div className="p-3">
      <Input
        type="text"
        placeholder="Search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

const Loader = () => {
  return (
    <div className="flex flex-col gap-5 p-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-2 justify-start">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="w-[40px] h-4" />
            <Skeleton className="w-[120px] h-4" />
          </div>
        </div>
      ))}
    </div>
  );
};

export function CurrencySelector({ onCurrencyChange, trigger }: Props) {
  const [isOpen, setOpen] = useState(false);
  const { chainId } = useConnection();
  const setCustomCurrency = useUserStore((state) => state.setCustomCurrency);

  const onChange = useCallback(
    (currency: Currency) => {
      onCurrencyChange(currency);
      if (currency.imported) {
        setCustomCurrency(chainId ?? DEFAULT_CHAIN_ID, currency);
      }
    },
    [chainId, onCurrencyChange, setCustomCurrency],
  );

  const openSelector = useCallback(() => {
    setOpen(true);
  }, [setOpen]);

  const onOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
  }, [setOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {trigger ? (
        <div
          role="button"
          tabIndex={0}
          className="cursor-pointer"
          onClick={openSelector}
        >
          {trigger}
        </div>
      ) : (
        <DialogTrigger asChild>
          <Button>
            <PlusIcon className="size-4" />
          </Button>
        </DialogTrigger>
      )}
      <CurrencySelectorContent onCurrencyChange={onChange} />
    </Dialog>
  );
}

const CurrencySelectorContent = ({
  onCurrencyChange,
}: {
  onCurrencyChange: (currency: Currency) => void;
}) => {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [isListReady, setIsListReady] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setIsListReady(true), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <DialogContent
      mobilePresentation="fullscreen"
      presentation="center"
      className="!flex max-h-[88dvh] flex-col gap-2 overflow-hidden p-0 sm:!max-w-[620px]"
    >
      <DialogHeader className="p-3 pt-5 pb-2">
        <DialogTitle>Select a token</DialogTitle>
      </DialogHeader>
      <SearchInput onChange={setSearch} value={search} />
      {isListReady ? (
        <CurrencySelectorList
          search={deferredSearch}
          onCurrencyChange={onCurrencyChange}
        />
      ) : (
        <TokenListShell status="loading">
          <Loader />
        </TokenListShell>
      )}
    </DialogContent>
  );
};

const TokenListShell = ({
  children,
  status,
}: {
  children: React.ReactNode;
  status: "loading" | "ready";
}) => {
  return (
    <div
      data-token-list={status}
      className="flex min-h-[300px] flex-1 flex-col gap-2 overflow-hidden sm:h-[80vh] sm:max-h-[520px] sm:flex-none"
    >
      {children}
    </div>
  );
};

const CurrencySelectorList = memo(function CurrencySelectorList({
  search,
  onCurrencyChange,
}: {
  search: string;
  onCurrencyChange: (currency: Currency) => void;
}) {
  const { chainId } = useConnection();
  const { currencies, isLoading, balances, usdPrices } = useCurrencies(search);
  const isEmptyList = !isLoading && currencies.length === 0;
  const popularCurrencies = useMemo(() => {
    if (search) return [];

    const popularTokenKeys = new Set(getPopularTokenForChain(chainId));
    if (!popularTokenKeys.size) return [];

    return currencies.filter((currency) =>
      popularTokenKeys.has(getTokenKey(currency.address)),
    );
  }, [chainId, currencies, search]);

  const itemContent = useCallback(
    (_: number, currency: Currency) => {
      const tokenKey = getTokenKey(currency.address);
      return (
        <CurrencyItem
          currency={currency}
          onCurrencyChange={onCurrencyChange}
          balanceWei={balances?.[tokenKey] ?? "0"}
          usdPrice={usdPrices?.[tokenKey] ?? usdPrices?.[currency.address] ?? 0}
        />
      );
    },
    [balances, onCurrencyChange, usdPrices],
  );
  const virtuosoComponents = useMemo(() => {
    function Header() {
      return (
        <PopularTokens
          onCurrencyChange={onCurrencyChange}
          currencies={popularCurrencies}
        />
      );
    }

    return { Header };
  }, [onCurrencyChange, popularCurrencies]);
  const computeItemKey = useCallback(
    (_: number, currency: Currency) => getTokenKey(currency.address),
    [],
  );

  return (
    <TokenListShell status="ready">
      {isEmptyList ? (
        <div className="flex h-full items-center justify-center">
          No results found
        </div>
      ) : isLoading ? (
        <Loader />
      ) : (
        <Virtuoso
          style={{ height: "100%" }}
          data={currencies}
          itemContent={itemContent}
          components={virtuosoComponents}
          computeItemKey={computeItemKey}
          defaultItemHeight={66}
          increaseViewportBy={240}
        />
      )}
    </TokenListShell>
  );
});

const CurrencyItem = memo(function CurrencyItem({
  currency,
  onCurrencyChange,
  balanceWei,
  usdPrice,
}: {
  currency: Currency;
  onCurrencyChange: (currency: Currency) => void;
  balanceWei: string;
  usdPrice: number;
}) {
  const balance = useMemo(
    () => toAmountUI(balanceWei, currency.decimals),
    [balanceWei, currency.decimals],
  );
  const formattedBalance = useFormatNumber({ value: balance });
  const usdValue = useMemo(
    () =>
      BN(balance || 0)
        .times(usdPrice || 0)
        .toString(),
    [balance, usdPrice],
  );
  const formattedUsdValue = useFormatNumber({
    value: usdValue,
    decimalScale: 2,
  });
  const hasBalance = BN(balanceWei ?? "0").gt(0);

  return (
    <DialogClose className="w-full px-2">
      <div
        className="mb-2 flex cursor-pointer items-center justify-between gap-3 rounded-[13px] border border-transparent px-3 py-2.5 transition-colors hover:border-primary/14 hover:bg-primary/6 data-[highlighted]:bg-primary/6"
        onClick={() => onCurrencyChange(currency)}
      >
        <div className="flex items-center gap-3 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          <CurrencyLogo currency={currency} />
          <div className="flex flex-col items-start flex-1">
            <p className="text-[15px] font-medium overflow-hidden text-ellipsis whitespace-nowrap max-w-[calc(100%-16px)]">
              {currency.name}
            </p>
            <p className="text-[12px] text-muted-foreground font-medium">
              {currency.symbol}
              {!isNativeAddress(currency.address) && (
                <span className="text-[11px] text-muted-foreground/80 ml-1">
                  {makeEllipsisAddress(currency.address, { start: 6, end: 4 })}
                </span>
              )}
            </p>
          </div>
        </div>
        {hasBalance && (
          <div className="flex flex-col items-end gap-0">
            <p className="text-[15px] font-semibold">
              ${formattedUsdValue || "0"}
            </p>

            <p className="text-[12px] text-muted-foreground">
              {formattedBalance}
            </p>
          </div>
        )}
      </div>
    </DialogClose>
  );
});
