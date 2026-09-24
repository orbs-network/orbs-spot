"use client";

import { useQueries } from "@tanstack/react-query";
import { isAddress, type Address } from "viem";
import { SUPPORTED_CHAINS } from "@/lib/consts";
import { record, type Payload, type TokenInfo } from "./inspect";
import { fetchTokenMetadata } from "./token-metadata";

export function useOrderTokens(
  payload: Payload | undefined,
  knownTokens: TokenInfo[],
) {
  const witness = record(payload?.message.witness);
  const addresses = [
    ...new Set(
      [
        record(witness.input).token,
        record(witness.output).token,
        record(payload?.message.permitted).token,
      ]
        .filter(
          (address): address is Address =>
            typeof address === "string" && isAddress(address),
        )
        .map((address) => address.toLowerCase() as Address),
    ),
  ];
  const chain = SUPPORTED_CHAINS.find(
    (item) => BigInt(item.id) === payload?.domain.chainId,
  );
  const known = knownTokens.filter(
    (token) =>
      Number.isInteger(token.decimals) &&
      token.decimals >= 0 &&
      token.decimals <= 255 &&
      typeof token.symbol === "string" &&
      Boolean(token.symbol.trim()),
  );
  const missing = addresses.filter(
    (address) =>
      !known.some((token) => token.address.toLowerCase() === address),
  );
  const queries = useQueries({
    queries: missing.map((address) => ({
      queryKey: [
        "order-preview-token",
        String(payload?.domain.chainId ?? ""),
        address,
      ],
      queryFn: ({ signal }: { signal: AbortSignal }) => {
        if (!chain) throw new Error("Unsupported token network.");
        return fetchTokenMetadata(chain, address, signal);
      },
      enabled: Boolean(chain),
      staleTime: 60 * 60_000,
      retry: 1,
    })),
  });
  const tokens = [
    ...known,
    ...queries.flatMap((query) => (query.data ? [query.data] : [])),
  ];
  return {
    tokens,
    isLoading: queries.some((query) => query.isFetching && !query.data),
    isUnavailable:
      missing.length > 0 &&
      (!chain || queries.some((query) => query.isError && !query.data)),
    canRetry: Boolean(chain),
    retry: () => {
      void Promise.allSettled(queries.map((query) => query.refetch()));
    },
  };
}
