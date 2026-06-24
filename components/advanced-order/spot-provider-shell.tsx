"use client";

import { useBalance } from "@/lib/hooks/use-balances";
import { useDataChainId } from "@/lib/hooks/use-data-chain-id";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useSettings } from "@/lib/hooks/use-settings";
import { useUSDPrice } from "@/lib/hooks/use-usd-price";
import { getActiveClientPartnerConfig } from "@/lib/partners/client";
import {
  Module,
  Partners,
  SpotProvider,
} from "@orbs-network/spot-react";
import { type ReactNode } from "react";
import { useConnection } from "wagmi";
import {
  useSpotCallbacks,
  useSpotMarketReferencePrice,
  useSpotToken,
  useWalletInteractions,
} from "./hooks";

const getPartner = () => {
  switch (getActiveClientPartnerConfig().id) {
    case 'ef':
      return Partners.EfficientFrontier;
    case 'ht':
      return Partners.HtDigital;
    default:
      return Partners.Agent;
  }
}


export function SpotProviderShell({
  children,
  orderModule,
}: {
  children: ReactNode;
  orderModule: Module;
}) {
  const { inputCurrency, outputCurrency, inputAmount } = useDerivedSwap();
  const { chainId, address } = useConnection();
  const dataChainId = useDataChainId();
  const spotChainId = chainId ?? dataChainId;
  const spotAccount = chainId ? address : undefined;
  const walletInteractions = useWalletInteractions();
  const callbacks = useSpotCallbacks();
  const inputBalance = useBalance(inputCurrency).wei;
  const outputBalance = useBalance(outputCurrency).wei;
  const inputUsd = useUSDPrice({ token: inputCurrency?.address });
  const outputUsd = useUSDPrice({ token: outputCurrency?.address });
  const spotSrcToken = useSpotToken(inputCurrency);
  const spotDstToken = useSpotToken(outputCurrency);
  const marketReferencePrice = useSpotMarketReferencePrice();
  const { priceProtection } = useSettings();

  return (
    <SpotProvider
      chainId={spotChainId}
      typedInputAmount={inputAmount}
      walletInteractions={walletInteractions}
      account={spotAccount}
      partner={getPartner()}
      srcBalance={inputBalance}
      dstBalance={outputBalance}
      srcToken={spotSrcToken}
      dstToken={spotDstToken}
      srcUsd1Token={(inputUsd.data ?? 0).toString()}
      dstUsd1Token={(outputUsd.data ?? 0).toString()}
      priceProtection={priceProtection}
      module={orderModule}
      marketReferencePrice={marketReferencePrice}
      minChunkSizeUsd={10}
      callbacks={callbacks}
      fees={0}
      isDev={false}
      appId={getActiveClientPartnerConfig().id}
      enableQueryParams={false}
    >
      {children}
    </SpotProvider>
  );
}

