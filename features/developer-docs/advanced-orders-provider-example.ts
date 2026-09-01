import type {
  CodeSnippetFileOptions,
  CodeSnippetOptions,
  JsonContainer,
} from "@/components/developer-tools/json-inspector";

export const ADVANCED_ORDERS_PROVIDER_EXAMPLE_DATA: JsonContainer = {
  partner: "dex.partner ?? Partners.Unknown",
  module: "Module.TWAP",
  typedInputAmount: "dex.typedInputAmount",
  priceProtection: "priceProtection",
  minChunkSizeUsd: "getMinChunkSizeUsd(minChunkSizeUsd)",
  marketReferencePrice: {
    value: "dex.marketReferencePrice.value",
    isLoading: "dex.marketReferencePrice.isLoading",
    noLiquidity: "dex.marketReferencePrice.noLiquidity",
  },
  walletInteractions: "walletInteractions",
  chainId: "dex.chainId",
  account: "dex.account",
  srcToken: "dex.srcToken",
  dstToken: "dex.dstToken",
  srcBalance: "dex.srcBalanceRaw",
  dstBalance: "dex.dstBalanceRaw",
  srcUsd1Token: "dex.srcTokenUsd",
  dstUsd1Token: "dex.dstTokenUsd",
  fees: "advancedOrdersFeePercent",
  callbacks: "callbacks",
};

function formatAdvancedOrdersProviderCode() {
  return `import {
  getMinChunkSizeUsd,
  Module,
  Partners,
  SpotProvider as AdvancedOrdersProvider,
} from "@orbs-network/spot-react";
import {
  useAdvancedOrdersCallbacks,
  useMarketReferencePrice,
  useWalletInteractions,
} from "./hooks";

type AdvancedOrderFormProps = {
  module: Module;
  // Supply these values from the host integration configuration.
  priceProtection: number; // Percentage: 3 means 3%.
  minChunkSizeUsd: number; // Minimum USD value for each execution chunk.
  advancedOrdersFeePercent?: number;
};

export function AdvancedOrderForm({ module, priceProtection, minChunkSizeUsd, advancedOrdersFeePercent }: AdvancedOrderFormProps) {
  // Keep the existing DEX adapter as the only source of wallet, form, and quote state.
  const dex = useDexSpotAdapter();

  // These stable adapter objects are implemented in the Hooks tab.
  const walletInteractions = useWalletInteractions(dex.wTokenAddress);
  const marketReferencePrice = useMarketReferencePrice(dex.marketReferencePrice);
  const callbacks = useAdvancedOrdersCallbacks();

  // Provider boundary rules:
  // - partner selects trusted server configuration; Unknown is the safe fallback.
  // - module is selected by DEX navigation before the provider mounts.
  // - typed input is a decimal string, while balances are base-unit strings.
  // - quote freshness and loading rules stay in the DEX adapter.
  // - chain and account always come from the connected wallet.
  return (
    <AdvancedOrdersProvider
      partner={dex.partner ?? Partners.Unknown}
      module={module}
      typedInputAmount={dex.typedInputAmount}
      priceProtection={priceProtection}
      minChunkSizeUsd={getMinChunkSizeUsd(minChunkSizeUsd)}
      marketReferencePrice={marketReferencePrice}
      walletInteractions={walletInteractions}
      chainId={dex.chainId}
      account={dex.account}
      srcToken={dex.srcToken}
      dstToken={dex.dstToken}
      srcBalance={dex.srcBalanceRaw}
      dstBalance={dex.dstBalanceRaw}
      srcUsd1Token={dex.srcTokenUsd}
      dstUsd1Token={dex.dstTokenUsd}
      fees={advancedOrdersFeePercent}
      callbacks={callbacks}
    >
      {/* Provider consumers, including portalled modals, must remain in this scope. */}
      <SpotFormContent />
    </AdvancedOrdersProvider>
  );
}`;
}

function formatAdvancedOrdersHooksCode() {
  return `import { useCallback, useMemo } from "react";
import { erc20Abi, parseAbi, type Address, type Hash } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { useRefetchBalances } from "./use-refetch-balances";
import type {
  Callbacks,
  MarketReferencePrice,
  WalletInteractions,
} from "@orbs-network/spot-react";

const wrappedNativeAbi = parseAbi(["function deposit() payable"]);

// Keep the provider's quote object stable while the DEX quote fields are unchanged.
export function useMarketReferencePrice({ value, isLoading, noLiquidity }: MarketReferencePrice): MarketReferencePrice {
  return useMemo(
    () => ({ value, isLoading, noLiquidity }),
    [value, isLoading, noLiquidity],
  );
}

// Adapt the host wallet stack to the five operations required by Spot.
export function useWalletInteractions(wTokenAddress?: Address): WalletInteractions {
  const wallet = useWalletClient().data;
  const publicClient = usePublicClient();

  const requireWallet = useCallback(() => {
    if (!wallet) throw new Error("Connect a wallet first");
    return wallet;
  }, [wallet]);

  const waitForSuccess = useCallback(async (hash: Hash) => {
    if (!publicClient) throw new Error("Public client is unavailable");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Transaction reverted");
    return hash;
  }, [publicClient]);

  const wrapNativeToken = useCallback<WalletInteractions["wrapNativeToken"]>(async (amount) => {
    if (!wTokenAddress) throw new Error("Wrapped native token is unavailable");
    const wallet = requireWallet();
    const hash = await wallet.writeContract({
      address: wTokenAddress,
      abi: wrappedNativeAbi,
      functionName: "deposit",
      value: BigInt(amount),
      account: wallet.account,
      chain: wallet.chain,
    });
    return waitForSuccess(hash);
  }, [requireWallet, waitForSuccess, wTokenAddress]);

  const approveToken = useCallback<WalletInteractions["approveToken"]>(async ({ tokenAddress, amount, spenderAddress }) => {
    const wallet = requireWallet();
    const hash = await wallet.writeContract({
      address: tokenAddress as Address,
      abi: erc20Abi,
      functionName: "approve",
      args: [spenderAddress as Address, BigInt(amount)],
      account: wallet.account,
      chain: wallet.chain,
    });
    return waitForSuccess(hash);
  }, [requireWallet, waitForSuccess]);

  const cancelOrder = useCallback<WalletInteractions["cancelOrder"]>(async ({ contractAddress, args, abi }) => {
    const wallet = requireWallet();
    const hash = await wallet.writeContract({
      address: contractAddress as Address,
      abi,
      functionName: "cancel",
      args,
      account: wallet.account,
      chain: wallet.chain,
    });
    return waitForSuccess(hash);
  }, [requireWallet, waitForSuccess]);

  const signOrder = useCallback<WalletInteractions["signOrder"]>(({ domain, types, primaryType, message, account }) => {
    // Return the complete wallet signature unchanged; Spot submits it as-is.
    return requireWallet().signTypedData({ domain, types, primaryType, message, account });
  }, [requireWallet]);

  const getAllowance = useCallback<WalletInteractions["getAllowance"]>(async ({ tokenAddress, spenderAddress }) => {
    if (!publicClient) throw new Error("Public client is unavailable");
    const allowance = await publicClient.readContract({
      address: tokenAddress as Address,
      abi: erc20Abi,
      functionName: "allowance",
      args: [requireWallet().account.address, spenderAddress as Address],
    });
    return allowance.toString();
  }, [publicClient, requireWallet]);

  return useMemo(
    () => ({ wrapNativeToken, approveToken, cancelOrder, signOrder, getAllowance }),
    [wrapNativeToken, approveToken, cancelOrder, signOrder, getAllowance],
  );
}

// Keep the full callback surface visible. Only these two lifecycle events
// refetch balances by default; replace other no-ops when the host needs them.
export function useAdvancedOrdersCallbacks(): Required<Callbacks> {
  // Read this action from the host balance hook instead of threading DEX state
  // through the provider component.
  const refetchBalances = useRefetchBalances();

  return useMemo(() => ({
    onCancelOrderRequest: () => {},
    onCancelOrderSuccess: () => {},
    onCancelOrderFailed: () => {},
    onOrdersProgressUpdate: refetchBalances,
    onSignOrderRequest: () => {},
    onOrderCreated: () => {},
    onSignOrderSuccess: () => {},
    onSignOrderError: () => {},
    onApproveRequest: () => {},
    onApproveSuccess: () => {},
    onWrapRequest: () => {},
    onWrapSuccess: refetchBalances,
    onOrderFilled: () => {},
    onCopy: () => {},
    onSubmitOrderFailed: () => {},
    onSubmitOrderRejected: () => {},
    onLimitPriceChange: () => {},
    onTriggerPriceChange: () => {},
    onTriggerPricePercentChange: () => {},
    onLimitPricePercentChange: () => {},
    onDurationChange: () => {},
    onFillDelayChange: () => {},
    onChunksChange: () => {},
  }), [refetchBalances]);
}`;
}

const ADVANCED_ORDERS_HOOKS_FILE: CodeSnippetFileOptions = {
  format: formatAdvancedOrdersHooksCode,
  name: "hooks.ts",
  showFieldTooltips: false,
  syntaxLanguage: "typescript",
};

export const ADVANCED_ORDERS_PROVIDER_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy provider",
  fileName: "provider.tsx",
  files: [ADVANCED_ORDERS_HOOKS_FILE],
  format: formatAdvancedOrdersProviderCode,
  language: "TSX",
  syntaxLanguage: "tsx",
};
