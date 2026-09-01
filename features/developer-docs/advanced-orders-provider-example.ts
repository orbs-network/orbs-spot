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
  enableQueryParams: false,
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
import { useDexSpotAdapter } from "./use-dex-spot-adapter";

type AdvancedOrderFormProps = {
  module: Module;
  // Supply these values from the host integration configuration.
  priceProtection: number; // Percentage: 3 means 3%.
  minChunkSizeUsd: number; // Minimum USD value for each execution chunk.
  advancedOrdersFeePercent?: number;
};

export function AdvancedOrderForm({ module, priceProtection, minChunkSizeUsd, advancedOrdersFeePercent = 0 }: AdvancedOrderFormProps) {
  // Keep the existing DEX adapter as the only source of wallet, form, and quote state.
  const dex = useDexSpotAdapter();

  // These stable adapter objects are implemented in the Hooks tab.
  const walletInteractions = useWalletInteractions(dex.wTokenAddress);
  const marketReferencePrice = useMarketReferencePrice();
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
      enableQueryParams={false}
      callbacks={callbacks}
    >
      {/* Provider consumers, including portalled modals, must remain in this scope. */}
      <SpotFormContent />
    </AdvancedOrdersProvider>
  );
}`;
}

function formatAdvancedOrdersHooksCode() {
  return `import BigNumber from "bignumber.js";
import { useCallback, useMemo } from "react";
import { erc20Abi, maxUint256, parseAbi, type Address, type Hash } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { isUserRejectedError, showWalletRejection } from "./wallet-errors";
import { useRefetchBalances } from "./use-refetch-balances";
import { useAdvancedOrdersNotifications } from "./use-advanced-orders-notifications";
import { useDexSpotAdapter } from "./use-dex-spot-adapter";
import { useQueueWrappedInput } from "./use-queue-wrapped-input";
import type {
  Callbacks,
  MarketReferencePrice,
  WalletInteractions,
} from "@orbs-network/spot-react";

const wrappedNativeAbi = parseAbi(["function deposit() payable"]);

// Never expose a quote produced for a previous typed input amount.
export function useMarketReferencePrice(): MarketReferencePrice {
  const dex = useDexSpotAdapter();
  const outputTokenDecimals = dex.dstToken?.decimals;
  const shouldQuote = Boolean(dex.typedInputAmount && outputTokenDecimals !== undefined);
  const isQuoteStale = shouldQuote && dex.typedInputAmount !== dex.quotedInputAmount;
  const fallbackOutputRaw = useMemo(() => {
    const inputUsd = new BigNumber(dex.inputAmountUsd ?? 0);
    const outputUsd = new BigNumber(dex.outputTokenUsd ?? 0);
    if (outputTokenDecimals === undefined || !inputUsd.isFinite() ||
        !outputUsd.isFinite() || inputUsd.lte(0) || outputUsd.lte(0)) {
      return undefined;
    }
    return inputUsd
      .div(outputUsd)
      .times(new BigNumber(10).pow(outputTokenDecimals))
      .integerValue(BigNumber.ROUND_DOWN)
      .toFixed(0);
  }, [dex.inputAmountUsd, dex.outputTokenUsd, outputTokenDecimals]);

  const value = !shouldQuote || isQuoteStale
    ? undefined
    : dex.quoteOutputRaw ?? fallbackOutputRaw;
  const isLoading = shouldQuote && (
    isQuoteStale || dex.isQuoteLoading ||
    (!dex.quoteOutputRaw && dex.isUsdPriceLoading)
  );

  return useMemo(
    () => ({ value, isLoading, noLiquidity: shouldQuote && !isLoading && !value }),
    [isLoading, shouldQuote, value],
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

  const runWalletOperation = useCallback(async <T,>(
    action: "wrap" | "approve" | "cancel" | "sign",
    operation: () => Promise<T>,
  ): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      if (isUserRejectedError(error)) showWalletRejection(action);
      throw error;
    }
  }, []);

  const wrapNativeToken = useCallback<WalletInteractions["wrapNativeToken"]>(async (amount) => {
    if (!wTokenAddress) throw new Error("Wrapped native token is unavailable");
    const wallet = requireWallet();
    return runWalletOperation("wrap", async () => {
      const hash = await wallet.writeContract({
        address: wTokenAddress,
        abi: wrappedNativeAbi,
        functionName: "deposit",
        value: BigInt(amount),
        account: wallet.account,
        chain: wallet.chain,
      });
      return waitForSuccess(hash);
    });
  }, [requireWallet, runWalletOperation, waitForSuccess, wTokenAddress]);

  const approveToken = useCallback<WalletInteractions["approveToken"]>(async ({ tokenAddress, spenderAddress }) => {
    const wallet = requireWallet();
    return runWalletOperation("approve", async () => {
      const hash = await wallet.writeContract({
        address: tokenAddress as Address,
        abi: erc20Abi,
        functionName: "approve",
        // Spot passes an amount, but recurring chunks need durable allowance.
        args: [spenderAddress as Address, maxUint256],
        account: wallet.account,
        chain: wallet.chain,
      });
      return waitForSuccess(hash);
    });
  }, [requireWallet, runWalletOperation, waitForSuccess]);

  const cancelOrder = useCallback<WalletInteractions["cancelOrder"]>(async ({ contractAddress, args, abi }) => {
    const wallet = requireWallet();
    return runWalletOperation("cancel", async () => {
      const hash = await wallet.writeContract({
        address: contractAddress as Address,
        abi,
        functionName: "cancel",
        args,
        account: wallet.account,
        chain: wallet.chain,
      });
      return waitForSuccess(hash);
    });
  }, [requireWallet, runWalletOperation, waitForSuccess]);

  const signOrder = useCallback<WalletInteractions["signOrder"]>(({ domain, types, primaryType, message, account }) => {
    // Return the complete wallet signature unchanged; Spot submits it as-is.
    return runWalletOperation("sign", () =>
      requireWallet().signTypedData({ domain, types, primaryType, message, account }),
    );
  }, [requireWallet, runWalletOperation]);

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

// Wire the user-visible lifecycle; omit callbacks the host does not use.
export function useAdvancedOrdersCallbacks(): Callbacks {
  // Read this action from the host balance hook instead of threading DEX state
  // through the provider component.
  const refetchBalances = useRefetchBalances();
  const notifications = useAdvancedOrdersNotifications();
  const queueWrappedInput = useQueueWrappedInput();

  return useMemo(() => ({
    onCancelOrderRequest: notifications.cancelRequest,
    onCancelOrderSuccess: notifications.cancelSuccess,
    onCancelOrderFailed: notifications.cancelFailed,
    onOrdersProgressUpdate: () => void refetchBalances(),
    onSignOrderRequest: notifications.signRequest,
    onOrderCreated: notifications.orderCreated,
    onSignOrderSuccess: notifications.signSuccess,
    onSignOrderError: notifications.signFailed,
    onApproveRequest: notifications.approveRequest,
    onApproveSuccess: notifications.approveSuccess,
    onWrapRequest: notifications.wrapRequest,
    onWrapSuccess: async (result) => {
      // Keep native input visible until the submit modal exit completes.
      queueWrappedInput();
      notifications.wrapSuccess(result);
      await refetchBalances();
    },
    onOrderFilled: notifications.orderFilled,
    onCopy: notifications.copied,
    onSubmitOrderFailed: notifications.submitFailed,
    onSubmitOrderRejected: notifications.submitRejected,
  }), [notifications, queueWrappedInput, refetchBalances]);
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
