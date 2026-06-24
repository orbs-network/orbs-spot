import {
  useQuery,
  useQueryClient,
  type QueryFunctionContext,
} from "@tanstack/react-query";
import { useLiquidityHub } from "./liquidity-hub";
import { BestTradeQuote, Currency } from "../types";
import { useSettings } from "./use-settings";
import BN from "bignumber.js";
import {
  getWrappedNativeCurrency,
  isNativeAddress,
} from "../utils";
import { useConnection } from "wagmi";
import { useSwapStore } from "./store";
import { useCallback, useMemo } from "react";
import {
  createParaswapDeltaTradeQuote,
  createParaswapTradeQuote,
  getParaswapSlippageBps,
  getParaswapUserMinAmountOut,
  type ParaswapDeltaQuoteResponse,
  type ParaswapTradeQuote,
} from "../paraswap";
import { getActiveClientPartnerConfig } from "../partners/client";

const stopQuoteLiquidityHub = (_error?: string) => {
  if (!_error) return false;
  const error = _error.toLowerCase();
  if (error.includes("not supported")) {
    return true;
  }
  if (error.includes("ldv")) {
    return true;
  }
  return false;
};

const QUOTE_REFETCH_INTERVAL_MS = 15_000;

let activeLiquidityHubQuote:
  | {
      abortController: AbortController;
      key: string;
      promise: Promise<BestTradeQuote>;
    }
  | undefined;

const getLiquidityHubQuoteRequestKey = ({
  account,
  chainId,
  dexMinAmountOut,
  fromToken,
  inAmount,
  quoteUpdatedAt,
  slippage,
  toToken,
}: {
  account: string;
  chainId: number;
  dexMinAmountOut: string;
  fromToken: string;
  inAmount: string;
  quoteUpdatedAt?: number;
  slippage: number;
  toToken: string;
}) =>
  JSON.stringify([
    account,
    chainId,
    fromToken,
    toToken,
    inAmount,
    dexMinAmountOut,
    quoteUpdatedAt,
    slippage,
  ]);

const useQuoteLiquidityHub = (
  inputCurrency?: Currency,
  outputCurrency?: Currency,
  parsedInputAmount = "",
  paraswapQuote?: ParaswapTradeQuote,
  enabled = true,
) => {
  const liquidityHub = useLiquidityHub();
  const queryClient = useQueryClient();
  const { slippage } = useSettings();
  const pauseQuote = useSwapStore((state) => state.pauseQuote);
  const { chainId, address: account } = useConnection();
  const inputCurrencyAddress = inputCurrency?.address ?? "";
  const outputCurrencyAddress = outputCurrency?.address ?? "";
  const paraswapUserMinAmountOut = paraswapQuote
    ? getParaswapUserMinAmountOut(paraswapQuote)
    : undefined;
  const paraswapQuoteUpdatedAt = paraswapQuote?.timestamp;
  const isQuoteEnabled =
    enabled &&
    !pauseQuote &&
    !!account &&
    !!chainId &&
    !!inputCurrencyAddress &&
    !!outputCurrencyAddress &&
    BN(parsedInputAmount).gt(0) &&
    !!paraswapUserMinAmountOut &&
    !!paraswapQuoteUpdatedAt;

  const getQueryKey = useCallback(
    (
      dexMinAmountOut = paraswapUserMinAmountOut,
      quoteUpdatedAt = paraswapQuoteUpdatedAt,
    ) => [
      "quote-liquidity-hub",
      chainId,
      account,
      inputCurrencyAddress,
      outputCurrencyAddress,
      parsedInputAmount,
      dexMinAmountOut,
      quoteUpdatedAt,
      slippage,
    ],
    [
      account,
      chainId,
      inputCurrencyAddress,
      outputCurrencyAddress,
      parsedInputAmount,
      paraswapUserMinAmountOut,
      paraswapQuoteUpdatedAt,
      slippage,
    ],
  );

  const fetchQuote = useCallback(
    async ({
      dexMinAmountOut = paraswapUserMinAmountOut,
      quoteUpdatedAt = paraswapQuoteUpdatedAt,
    }: {
      dexMinAmountOut?: string;
      quoteUpdatedAt?: number;
      signal?: AbortSignal;
    }): Promise<BestTradeQuote> => {
      if (
        !account ||
        !chainId ||
        !inputCurrency ||
        !outputCurrency ||
        !dexMinAmountOut
      ) {
        throw new Error("Missing ParaSwap minimum amount for Liquidity Hub quote");
      }

      const fromToken = isNativeAddress(inputCurrencyAddress)
        ? getWrappedNativeCurrency(chainId)?.address ?? ""
        : inputCurrencyAddress;
      const requestKey = getLiquidityHubQuoteRequestKey({
        account,
        chainId,
        dexMinAmountOut,
        fromToken,
        inAmount: parsedInputAmount,
        quoteUpdatedAt,
        slippage,
        toToken: outputCurrencyAddress,
      });

      if (activeLiquidityHubQuote?.key === requestKey) {
        return activeLiquidityHubQuote.promise;
      }

      activeLiquidityHubQuote?.abortController.abort();
      const abortController = new AbortController();

      const promise = liquidityHub
        .getQuote({
          fromToken,
          toToken: outputCurrencyAddress,
          inAmount: parsedInputAmount,
          dexMinAmountOut,
          slippage: slippage,
          signal: abortController.signal,
          account: account,
        })
        .then(
          (quote) =>
            ({
              provider: "liquidityHub",
              outAmount: quote.outAmount,
              minAmountOut: quote.userMinOutAmountWithGas,
              inToken: inputCurrency.address,
              outToken: outputCurrency.address,
              inAmount: quote.inAmount,
              gas: (quote.gasAmountOut as string | undefined) ?? "0",
              dexMinAmountOut,
              paraswapQuoteUpdatedAt: quoteUpdatedAt,
              timestamp: Date.now(),
              originalQuote: quote,
            }) satisfies BestTradeQuote,
        )
        .finally(() => {
          if (activeLiquidityHubQuote?.key === requestKey) {
            activeLiquidityHubQuote = undefined;
          }
        });

      activeLiquidityHubQuote = {
        abortController,
        key: requestKey,
        promise,
      };

      return promise;
    },
    [
      account,
      chainId,
      inputCurrency,
      inputCurrencyAddress,
      liquidityHub,
      outputCurrency,
      outputCurrencyAddress,
      paraswapUserMinAmountOut,
      paraswapQuoteUpdatedAt,
      parsedInputAmount,
      slippage,
    ],
  );

  const queryKey = useMemo(() => getQueryKey(), [getQueryKey]);
  const queryFn = useCallback(
    ({ signal }: QueryFunctionContext) => fetchQuote({ signal }),
    [fetchQuote],
  );

  const quote = useQuery<BestTradeQuote>({
    queryKey,
    queryFn,
    staleTime: QUOTE_REFETCH_INTERVAL_MS,
    refetchOnMount: false,
    retry: (failureCount, error) => {
      if (stopQuoteLiquidityHub(error?.message)) {
        return false;
      }
      return failureCount < 2;
    },
    enabled: isQuoteEnabled,
  });

  const ensureQuote = useCallback(
    (quote = paraswapQuote) => {
      const dexMinAmountOut = quote
        ? getParaswapUserMinAmountOut(quote)
        : undefined;
      const quoteUpdatedAt = quote?.timestamp;

      return queryClient.fetchQuery({
        queryKey: getQueryKey(dexMinAmountOut, quoteUpdatedAt),
        queryFn: ({ signal }) =>
          fetchQuote({ dexMinAmountOut, quoteUpdatedAt, signal }),
        staleTime: 60_000,
      });
    },
    [fetchQuote, getQueryKey, paraswapQuote, queryClient],
  );

  return {
    ...quote,
    ensureQuote,
  };
};

const useQuoteParaswap = (
  inputCurrency?: Currency,
  outputCurrency?: Currency,
  parsedInputAmount = "",
  enabled = true,
) => {
  const { slippage } = useSettings();
  const pauseQuote = useSwapStore((state) => state.pauseQuote);
  const { chainId, address: account } = useConnection();
  const inputCurrencyAddress = inputCurrency?.address ?? "";
  const outputCurrencyAddress = outputCurrency?.address ?? "";
  const partner = getActiveClientPartnerConfig().id;
  const slippageBps = getParaswapSlippageBps(slippage);
  const isQuoteEnabled =
    enabled &&
    !pauseQuote &&
    !!account &&
    !!chainId &&
    !!inputCurrency &&
    !!outputCurrency &&
    BN(parsedInputAmount).gt(0);

  return useQuery({
    queryKey: [
      "quote-paraswap",
      chainId,
      account,
      inputCurrencyAddress,
      outputCurrencyAddress,
      parsedInputAmount,
      slippageBps,
      partner,
    ],
    queryFn: async ({ signal }) => {
      if (!chainId || !account || !inputCurrency || !outputCurrency) {
        throw new Error("Missing ParaSwap quote parameters");
      }

      const params = new URLSearchParams({
        chainId: chainId.toString(),
        srcToken: inputCurrency.address,
        srcDecimals: inputCurrency.decimals.toString(),
        destToken: outputCurrency.address,
        destDecimals: outputCurrency.decimals.toString(),
        amount: parsedInputAmount,
        userAddress: account,
        partner,
      });

      const response = await fetch(`/api/paraswap/quote?${params.toString()}`, {
        signal,
      });
      const data = await response.json().catch(() => undefined);

      if (!response.ok) {
        if (data?.noRoute) {
          return null;
        }

        throw new Error(data?.error ?? "Failed to fetch ParaSwap quote");
      }

      const result = data as ParaswapDeltaQuoteResponse;
      if (result.delta?.route) {
        return createParaswapDeltaTradeQuote({
          delta: result.delta,
          inputAddress: inputCurrency.address,
          marketPriceRoute: result.market,
          outputAddress: outputCurrency.address,
          slippageBps,
          srcDecimals: inputCurrency.decimals,
          destDecimals: outputCurrency.decimals,
        });
      }

      if (!result.market?.destAmount) {
        return null;
      }

      return createParaswapTradeQuote({
        inputAddress: inputCurrency.address,
        outputAddress: outputCurrency.address,
        priceRoute: result.market,
        slippageBps,
      });
    },
    refetchInterval: (it) => {
      if (pauseQuote || it.state.data === null) {
        return false;
      }
      return QUOTE_REFETCH_INTERVAL_MS;
    },
    retry: (failureCount) => failureCount < 2,
    staleTime: QUOTE_REFETCH_INTERVAL_MS,
    refetchOnMount: false,
    enabled: isQuoteEnabled,
  });
};

export const useTrade = (
  inputCurrency?: Currency,
  outputCurrency?: Currency,
  parsedInputAmount = "",
  enabled = true,
) => {
  const paraswapQuote = useQuoteParaswap(
    inputCurrency,
    outputCurrency,
    parsedInputAmount,
    enabled,
  );
  const trade = paraswapQuote.data ?? undefined;
  const liquidityHubQuote = useQuoteLiquidityHub(
    inputCurrency,
    outputCurrency,
    parsedInputAmount,
    trade,
    enabled,
  );

  return useMemo(
    () => ({
      isLoading: enabled && paraswapQuote.isLoading && !trade,
      isError: paraswapQuote.isError,
      isNoRoute: paraswapQuote.isSuccess && paraswapQuote.data === null,
      refetch: paraswapQuote.refetch,
      ensureLiquidityHubQuote: liquidityHubQuote.ensureQuote,
      refetchLiquidityHubQuote: liquidityHubQuote.refetch,
      refetchParaswapQuote: paraswapQuote.refetch,
      data: trade,
      liquidityHubQuote: liquidityHubQuote.data,
      paraswapQuote: trade,
    }),
    [
      enabled,
      liquidityHubQuote.ensureQuote,
      liquidityHubQuote.refetch,
      liquidityHubQuote.data,
      paraswapQuote.data,
      paraswapQuote.isError,
      paraswapQuote.isLoading,
      paraswapQuote.isSuccess,
      paraswapQuote.refetch,
      trade,
    ]
  );
};
