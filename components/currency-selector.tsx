import {
  memo,
  type ReactElement,
  type ReactNode,
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
import { Virtuoso, type Components } from "react-virtuoso";
import type { Currency } from "@/lib/types";
import { useFormatNumber } from "@/lib/hooks/common";
import BN from "bignumber.js";
import { useConnection } from "wagmi";
import {
  getTokenKey,
  getPopularTokenForChain,
  dynamicDecimals,
  isNativeAddress,
  makeEllipsisAddress,
  toAmountUI,
} from "@/lib/utils";
import { Input } from "./ui/input";
import { Skeleton } from "./ui/skeleton";
import { useCurrencies } from "@/lib/hooks/use-currencies";
import { CurrencyLogo } from "./ui/currency-logo";
import { EmptyState } from "./ui/empty-state";
import { useUserStore } from "@/lib/hooks/store";
import { DEFAULT_CHAIN_ID } from "@/lib/consts";

type Props = {
  onCurrencyChange: (currency: Currency) => void;
  trigger?: ReactElement;
};

const formatTokenSymbol = (symbol?: string) => {
  switch (symbol?.toLowerCase()) {
    case 'bsc-usd':
      return 'USDT';

  
    default:
      return symbol;
  }
};

const formatTokenName = (name?: string) => {
  return (name ?? "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const TOKEN_AMOUNT_VISIBLE_CHARACTERS = 7;

const limitTokenAmountText = (amount?: string) => {
  if (!amount || amount.length <= TOKEN_AMOUNT_VISIBLE_CHARACTERS) {
    return amount;
  }

  return `${amount.slice(0, TOKEN_AMOUNT_VISIBLE_CHARACTERS)}…`;
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
        <DialogClose key={c.address} asChild>
          <button
            type="button"
            className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-border/60 bg-secondary p-3 transition-colors hover:border-primary/25 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            onClick={() => onCurrencyChange(c)}
            aria-label={`Select ${formatTokenName(c.name) || formatTokenSymbol(c.symbol)}`}
          >
            <CurrencyLogo
              currency={c}
              name={formatTokenName(c.name)}
              symbol={formatTokenSymbol(c.symbol)}
              className="size-6"
              fallbackClassName="text-[10px]"
            />
            <p className="max-w-full cursor-pointer truncate text-center text-xs font-semibold leading-tight">
              {formatTokenSymbol(c.symbol)}
            </p>
          </button>
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
        aria-label="Search tokens"
        autoComplete="off"
        name="token-search"
        placeholder="Search tokens…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

const Loader = () => {
  return (
    <div className="flex flex-col gap-5 p-3">
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

  const onOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button aria-label="Select token">
            <PlusIcon aria-hidden="true" className="size-4" />
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
      className="!flex max-h-[88dvh] flex-col gap-2 overflow-hidden p-0 sm:!max-w-[440px]"
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
  children: ReactNode;
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

type CurrencyListContext = {
  currencies: Currency[];
  onCurrencyChange: (currency: Currency) => void;
};

function CurrencyListHeader({ context }: { context: CurrencyListContext }) {
  return (
    <PopularTokens
      onCurrencyChange={context.onCurrencyChange}
      currencies={context.currencies}
    />
  );
}

const CURRENCY_LIST_COMPONENTS: Components<Currency, CurrencyListContext> = {
  Header: CurrencyListHeader,
};

const CurrencySelectorList = memo(function CurrencySelectorList({
  search,
  onCurrencyChange,
}: {
  search: string;
  onCurrencyChange: (currency: Currency) => void;
}) {
  const { chainId } = useConnection();
  const {
    balances,
    currencies,
    isError,
    isLoading,
    refetch,
    usdPrices,
  } = useCurrencies(search);
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
  const virtuosoContext = useMemo(() => {
    return {
      currencies: popularCurrencies,
      onCurrencyChange,
    };
  }, [onCurrencyChange, popularCurrencies]);
  const computeItemKey = useCallback(
    (_: number, currency: Currency) => getTokenKey(currency.address),
    [],
  );

  return (
    <TokenListShell status="ready">
      {isError ? (
        <EmptyState
          role="alert"
          className="mx-3 min-h-[300px]"
          title="Couldn’t load tokens"
          description="Check your connection, then try loading the token list again."
          action={
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        />
      ) : isEmptyList ? (
        <EmptyState
          role="status"
          className="mx-3 min-h-[300px]"
          title="No tokens found"
          description="Try a token name, symbol, or contract address."
        />
      ) : isLoading ? (
        <Loader />
      ) : (
        <Virtuoso
          style={{ height: "100%" }}
          data={currencies}
          itemContent={itemContent}
          components={CURRENCY_LIST_COMPONENTS}
          context={virtuosoContext}
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
  const displayName = formatTokenName(currency.name);
  const displaySymbol = formatTokenSymbol(currency.symbol);
  const isTokenAddress = !isNativeAddress(currency.address);
  const balance = useMemo(
    () => toAmountUI(balanceWei, currency.decimals),
    [balanceWei, currency.decimals],
  );
  const formattedBalance = useFormatNumber({ value: balance });
  const displayBalance = useMemo(() => {
    const balanceText =
      BN(balance || 0).gt(0) && formattedBalance === "0"
        ? dynamicDecimals(balance, 4, 18)
        : formattedBalance;

    return limitTokenAmountText(balanceText);
  }, [balance, formattedBalance]);
  const usdValue = useMemo(
    () =>
     BN(balance || 0)
        .times(usdPrice || 0)
        .toFixed(),
    [balance, usdPrice],
  );
  const formattedUsdValue = useFormatNumber({
    value: usdValue,
    decimalScale: 2,
  });
  const hasBalance = BN(balanceWei ?? "0").gt(0);

  return (
    <DialogClose asChild>
      <button
        type="button"
        className="group mx-3 mb-2 flex w-[calc(100%-1.5rem)] cursor-pointer items-center justify-between gap-3 rounded-[13px] border border-transparent px-3 py-2.5 text-left transition-colors hover:border-primary/14 hover:bg-primary/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 data-[highlighted]:bg-primary/6"
        onClick={() => onCurrencyChange(currency)}
      >
        <div className="flex items-center gap-3 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          <CurrencyLogo
            currency={currency}
            name={displayName}
            symbol={displaySymbol}
          />
          <div className="flex min-w-0 flex-1 flex-col items-start">
            <p className="max-w-[calc(100%-16px)] overflow-hidden text-ellipsis whitespace-nowrap text-base font-medium">
              {displayName || displaySymbol}
            </p>
            <p className="text-sm font-medium text-muted-foreground">
              {displaySymbol}
              {isTokenAddress && (
                <span className="text-xs text-muted-foreground/80 ml-1">
                  {makeEllipsisAddress(currency.address, { start: 6, end: 4 })}
                </span>
              )}
            </p>
          </div>
        </div>
        {hasBalance && (
          <div className="flex flex-col items-end gap-0">
            <p className="text-base font-semibold">
              ${formattedUsdValue || "0"}
            </p>

            <p className="text-sm text-muted-foreground">
              {displayBalance}
            </p>
          </div>
        )}
      </button>
    </DialogClose>
  );
});
