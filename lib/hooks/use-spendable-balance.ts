"use client";

import { useGasPrice } from "wagmi";
import { formatUnits } from "viem";
import type { Currency } from "@/lib/types";
import { isNativeAddress } from "@/lib/utils";
import { spendableNativeBalance } from "@/lib/spendable-balance";
import { useBalance } from "./use-balances";
import { useDataChainId } from "./use-data-chain-id";

export function useSpendableBalance(currency?: Currency) {
  const balance = useBalance(currency);
  const chainId = useDataChainId();
  const native = !!currency && isNativeAddress(currency.address);
  const gas = useGasPrice({ chainId, query: {
    enabled: native && !!balance.wei && BigInt(balance.wei) > BigInt(0),
    staleTime: 30_000, refetchInterval: native ? 30_000 : false,
  } });
  const unavailable = native && (!gas.data || gas.isError);
  const raw = native ? spendableNativeBalance(BigInt(balance.wei || "0"), gas.data ?? BigInt(0)) : BigInt(balance.wei || "0");
  return { ...balance, spendable: formatUnits(raw, currency?.decimals ?? 18),
    maxDisabled: balance.isLoading || unavailable,
    maxHint: native ? unavailable ? "Waiting for network fees before calculating Max" : "Keeps an estimated reserve for network fees" : undefined };
}
