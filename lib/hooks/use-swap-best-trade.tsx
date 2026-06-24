import {
  isFreshQuote,
  permit2Address,
  Quote,
} from "@orbs-network/liquidity-hub-sdk";
import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useSignEip } from "./use-sign-eip";
import { useApproval } from "./use-approval";
import { useWrap } from "./use-wrap";
import {
  getExplorerUrl,
  isNativeAddress,
  makeEllipsisAddress,
} from "../utils";
import { useDerivedSwap } from "./use-derived-swap";
import BN from "bignumber.js";
import { useLiquidityHub } from "./liquidity-hub";
import { useGetTransactionReceiptCallback } from "./use-get-transaction-receipt";
import { useBestTradeSwapStore, useSwapStore } from "./store";
import { SwapStatus } from "@orbs-network/swap-ui";
import { SwapStep, type BestTradeQuote } from "../types";
import { toast } from "sonner";
import { useBalances } from "./use-balances";
import { useCallback, useMemo, useRef } from "react";
import TokensPair from "@/components/tokens-pair";
import { useConnection, useWalletClient } from "wagmi";
import {
  parseSignature,
  serializeCompactSignature,
  signatureToCompactSignature,
  type Hex,
} from "viem";
import {
  isUserRejectedError,
  showTransactionRejectedToast,
} from "../tx-rejection";
import {
  isParaswapDeltaFailureStatus,
  isParaswapDeltaTerminalStatus,
  isFreshParaswapQuote,
  getParaswapUserMinAmountOut,
  type ParaswapDeltaBuildResponse,
  type ParaswapDeltaOrder,
  type ParaswapDeltaTypedData,
  type ParaswapTradeQuote,
  type ParaswapTransactionParams,
} from "../paraswap";
import { getActiveClientPartnerConfig } from "../partners/client";
import { useSignParaswapPermit2 } from "./use-paraswap-permit2";

type PreparedSwapQuote =
  | {
      provider: "liquidityHub";
      quote: Quote;
      paraswapQuote: ParaswapTradeQuote;
    }
  | {
      provider: "paraswap";
      quote: ParaswapTradeQuote;
    };

const getLiquidityHubComparableAmount = (quote: Quote) =>
  quote.userMinOutAmountWithGas || quote.minAmountOut || "0";

const isFreshBestTradeQuote = (
  quote?: Pick<BestTradeQuote, "timestamp">,
  maxAgeSeconds = 60,
) => Boolean(quote?.timestamp && Date.now() - quote.timestamp < maxAgeSeconds * 1000);

const QUOTE_QUERY_KEYS = [["quote-paraswap"], ["quote-liquidity-hub"]] as const;

const markQuoteQueriesFresh = (queryClient: QueryClient) => {
  const updatedAt = Date.now();
  for (const queryKey of QUOTE_QUERY_KEYS) {
    queryClient.setQueriesData(
      { queryKey },
      (data: unknown) => data,
      { updatedAt },
    );
  }
};

const getCachedLiquidityHubQuote = (quote: BestTradeQuote | undefined) => {
  if (
    quote?.provider !== "liquidityHub" ||
    !isFreshBestTradeQuote(quote, 60)
  ) {
    return undefined;
  }

  const originalQuote = quote.originalQuote as Quote | undefined;
  return originalQuote && isFreshQuote(originalQuote, 60)
    ? originalQuote
    : undefined;
};

const DELTA_ORDER_DEADLINE_SECONDS = 30 * 60;
const DELTA_ORDER_POLL_INTERVAL_MS = 3_000;
const DELTA_ORDER_TIMEOUT_MS = 5 * 60_000;

const getParaswapPermitDeadline = () =>
  Math.floor(Date.now() / 1000) + DELTA_ORDER_DEADLINE_SECONDS;

const sleep = (duration: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, duration);
  });

const getPrimaryType = (typedData: ParaswapDeltaTypedData) => {
  if (typedData.types.Order) {
    return "Order";
  }

  const [primaryType] = Object.keys(typedData.types).filter(
    (key) => key !== "EIP712Domain",
  );
  if (!primaryType) {
    throw new Error("ParaSwap Delta typed data is missing a primary type");
  }
  return primaryType;
};

const getTypedDataTypes = (typedData: ParaswapDeltaTypedData) =>
  Object.fromEntries(
    Object.entries(typedData.types).filter(([key]) => key !== "EIP712Domain"),
  );

const toCompactSignature = (signature: Hex): Hex => {
  if (signature.length === 130) {
    return signature;
  }
  if (signature.length !== 132) {
    throw new Error("Invalid ParaSwap Delta signature length");
  }

  return serializeCompactSignature(
    signatureToCompactSignature(parseSignature(signature)),
  );
};

const buildParaswapDeltaOrder = async ({
  account,
  deadline,
  partner,
  permit,
  quote,
}: {
  account: string;
  deadline: number;
  partner: string;
  permit?: Hex;
  quote: ParaswapTradeQuote;
}) => {
  if (quote.executionMode !== "delta") {
    throw new Error("ParaSwap Delta quote not found");
  }

  const response = await fetch("/api/paraswap/delta/build", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      route: quote.deltaRoute,
      side: quote.delta.side ?? "SELL",
      owner: account,
      deadline,
      slippageBps: quote.slippageBps,
      partner,
      permit,
    }),
  });

  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(data?.error ?? "Failed to build ParaSwap Delta order");
  }

  return data as ParaswapDeltaBuildResponse;
};

const submitParaswapDeltaOrder = async ({
  chainId,
  order,
  partner,
  signature,
}: {
  chainId: number;
  order: Record<string, unknown>;
  partner: string;
  signature: Hex;
}) => {
  const response = await fetch("/api/paraswap/delta/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chainId,
      order,
      signature,
      partner,
    }),
  });

  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(data?.error ?? "Failed to submit ParaSwap Delta order");
  }

  return data as ParaswapDeltaOrder;
};

const getParaswapDeltaOrder = async (chainId: number, orderId: string) => {
  const params = new URLSearchParams({
    chainId: chainId.toString(),
    orderId,
  });
  const response = await fetch(`/api/paraswap/delta/orders?${params.toString()}`);
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(data?.error ?? "Failed to fetch ParaSwap Delta order");
  }

  return data as ParaswapDeltaOrder;
};

const pollParaswapDeltaOrder = async (chainId: number, orderId: string) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < DELTA_ORDER_TIMEOUT_MS) {
    const order = await getParaswapDeltaOrder(chainId, orderId);
    if (isParaswapDeltaTerminalStatus(order.status)) {
      return order;
    }

    await sleep(DELTA_ORDER_POLL_INTERVAL_MS);
  }

  throw new Error("ParaSwap Delta order timed out");
};

const isHexTransactionHash = (value?: string): value is `0x${string}` =>
  Boolean(value && /^0x[0-9a-fA-F]{64}$/.test(value));

const getParaswapDeltaTransactionHash = (order: ParaswapDeltaOrder) => {
  const transaction = order.transactions?.find(
    (it) =>
      isHexTransactionHash(it.destinationTx) ||
      isHexTransactionHash(it.originTx),
  );

  if (isHexTransactionHash(transaction?.destinationTx)) {
    return transaction.destinationTx;
  }
  if (isHexTransactionHash(transaction?.originTx)) {
    return transaction.originTx;
  }

  return undefined;
};

const buildParaswapTransaction = async ({
  account,
  chainId,
  deadline,
  ignoreChecks,
  partner,
  permit,
  quote,
}: {
  account: string;
  chainId: number;
  deadline?: number;
  ignoreChecks?: boolean;
  partner: string;
  permit?: Hex;
  quote: ParaswapTradeQuote;
}) => {
  if (!quote.priceRoute) {
    throw new Error("ParaSwap Market fallback route not found");
  }

  const response = await fetch("/api/paraswap/transactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chainId,
      priceRoute: quote.priceRoute,
      srcToken: quote.srcToken,
      destToken: quote.destToken,
      srcDecimals: quote.srcDecimals,
      destDecimals: quote.destDecimals,
      amount: quote.inAmount,
      userAddress: account,
      slippageBps: quote.slippageBps,
      partner,
      ignoreChecks,
      permit,
      deadline,
    }),
  });

  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(data?.error ?? "Failed to build ParaSwap transaction");
  }

  return data as ParaswapTransactionParams;
};

const usePrepareQuote = () => {
  const {
    ensureLiquidityHubQuote,
    liquidityHubQuote,
    paraswapQuote,
    refetchParaswapQuote,
  } = useDerivedSwap();

  const getLiquidityHubQuoteForComparison = useCallback(
    async (paraswapQuote: ParaswapTradeQuote) => {
      const isQuoteForParaswapQuote = (quote?: BestTradeQuote) =>
        quote?.provider === "liquidityHub" &&
        quote.dexMinAmountOut === getParaswapUserMinAmountOut(paraswapQuote) &&
        quote.paraswapQuoteUpdatedAt === paraswapQuote.timestamp;
      const readyQuote = isQuoteForParaswapQuote(liquidityHubQuote)
        ? getCachedLiquidityHubQuote(liquidityHubQuote)
        : undefined;
      if (readyQuote) {
        return readyQuote;
      }

      const ensuredQuote = await ensureLiquidityHubQuote(paraswapQuote).catch(
        () => undefined,
      );

      return isQuoteForParaswapQuote(ensuredQuote)
        ? getCachedLiquidityHubQuote(ensuredQuote)
        : undefined;
    },
    [ensureLiquidityHubQuote, liquidityHubQuote],
  );

  const compareQuotes = useCallback(
    async (paraswapQuote: ParaswapTradeQuote): Promise<PreparedSwapQuote> => {
      const paraswapUserMinAmountOut =
        getParaswapUserMinAmountOut(paraswapQuote);
      const selectedLiquidityHubQuote =
        await getLiquidityHubQuoteForComparison(paraswapQuote);

        console.log('paraswapUserMinAmountOut', paraswapUserMinAmountOut);
        console.log('selectedLiquidityHubQuote', selectedLiquidityHubQuote?.userMinOutAmountWithGas);
        return {
          provider: "paraswap",
          quote: paraswapQuote,
        };
      if (
        selectedLiquidityHubQuote &&
        paraswapQuote.priceRoute &&
        BN(getLiquidityHubComparableAmount(selectedLiquidityHubQuote)).gt(
          BN(paraswapUserMinAmountOut),
        )
      ) {
        console.log('provider', 'liquidityHub');

        return {
          provider: "liquidityHub",
          quote: selectedLiquidityHubQuote,
          paraswapQuote,
        };
      }

      console.log('provider', 'paraswap');

      return {
        provider: "paraswap",
        quote: paraswapQuote,
      };
    },
    [getLiquidityHubQuoteForComparison],
  );

  return useMutation({
    mutationFn: async (): Promise<PreparedSwapQuote> => {
      let selectedParaswapQuote = paraswapQuote;
      if (!isFreshParaswapQuote(selectedParaswapQuote, 60)) {
        const freshQuote = (await refetchParaswapQuote())?.data ?? undefined;
        selectedParaswapQuote = freshQuote ?? undefined;
      }

      if (!selectedParaswapQuote) {
        throw new Error("ParaSwap route not found");
      }

      return compareQuotes(selectedParaswapQuote);
    },
  });
};

const getTotalSteps = (shouldWrap: boolean, shouldApprove: boolean) => {
  let totalSteps = 1;
  if (shouldWrap) {
    totalSteps++;
  }
  if (shouldApprove) {
    totalSteps++;
  }
  return totalSteps;
};

type ToastId = string | number;

const getReadableSwapError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return "Something went wrong while preparing the transaction.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("quote")) {
    return "The quote expired or could not be refreshed. Try again with a fresh quote.";
  }
  if (message.includes("delta order") || message.includes("gasless order")) {
    return "The gasless order was not completed. Please try again.";
  }
  if (message.includes("allowance") || message.includes("approval")) {
    return "Token approval did not complete. Please try approving again.";
  }
  if (message.includes("insufficient")) {
    return "The wallet does not have enough balance for this swap.";
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "Network request failed. Check your connection and try again.";
  }

  return "The transaction could not be completed. Please try again.";
};

const useToasts = () => {
  const wrapToastId = useRef<ToastId | undefined>(undefined);
  const approveToastId = useRef<ToastId | undefined>(undefined);
  const swapToastId = useRef<ToastId | undefined>(undefined);
  const activeToastId = useRef<ToastId | undefined>(undefined);
  const { inputCurrency, outputCurrency } = useDerivedSwap();
  const { chainId } = useConnection();

  const dismissPendingToasts = useCallback(() => {
    for (const id of [
      wrapToastId.current,
      approveToastId.current,
      swapToastId.current,
    ]) {
      if (id) toast.dismiss(id);
    }
    wrapToastId.current = undefined;
    approveToastId.current = undefined;
    swapToastId.current = undefined;
    activeToastId.current = undefined;
  }, []);

  const onWrapRequest = useCallback(() => {
    wrapToastId.current = toast.loading(
      `Wrapping ${inputCurrency?.symbol ?? "token"}...`,
      {
        description: "Confirm the wrap transaction in your wallet.",
      }
    );
    activeToastId.current = wrapToastId.current;
  }, [inputCurrency?.symbol]);

  const onWrapSuccess = useCallback(() => {
    const id = wrapToastId.current;
    toast.success(`Wrapped ${inputCurrency?.symbol ?? "token"}`, {
      id,
      description: "Funds are ready for the swap.",
      duration: 4_000,
    });
    activeToastId.current = undefined;
  }, [inputCurrency?.symbol]);

  const onApproveRequest = useCallback(() => {
    approveToastId.current = toast.loading(
      `Approving ${inputCurrency?.symbol ?? "token"}...`,
      {
        description: "Confirm token spending in your wallet.",
      }
    );
    activeToastId.current = approveToastId.current;
  }, [inputCurrency?.symbol]);

  const onApproveSuccess = useCallback(() => {
    const id = approveToastId.current;
    toast.success(`Approved ${inputCurrency?.symbol ?? "token"}`, {
      id,
      description: "Approval confirmed.",
      duration: 4_000,
    });
    activeToastId.current = undefined;
  }, [inputCurrency?.symbol]);

  const onSwapRequest = useCallback(() => {
    swapToastId.current = toast.loading(
      <TokensPair
        prefix="Swapping"
        srcTokenAddress={inputCurrency?.address}
        dstTokenAddress={outputCurrency?.address}
      />
    );
    activeToastId.current = swapToastId.current;
  }, [inputCurrency?.address, outputCurrency?.address]);

  const onSwapConfirming = useCallback(
    (txHash?: `0x${string}`) => {
      toast.loading(
        <TokensPair
          prefix="Confirming"
          srcTokenAddress={inputCurrency?.address}
          dstTokenAddress={outputCurrency?.address}
        />,
        {
          id: swapToastId.current,
          description: txHash
            ? `Transaction ${makeEllipsisAddress(txHash, {
                start: 8,
                end: 6,
              })}`
            : "Waiting for gasless order execution.",
        }
      );
    },
    [inputCurrency?.address, outputCurrency?.address]
  );

  const onSwapSuccess = useCallback((txHash?: `0x${string}`) => {
    toast.success(
      <TokensPair
        prefix="Swap completed"
        srcTokenAddress={inputCurrency?.address}
        dstTokenAddress={outputCurrency?.address}
      />,
      {
        id: swapToastId.current,
        description: txHash ? (
          <a
            href={getExplorerUrl(chainId, txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:text-blue-600"
          >
            View on explorer
          </a>
        ) : (
          "Gasless order completed."
        ),
        duration: 20_000,
        closeButton: true,
      }
    );
    activeToastId.current = undefined;
  }, [inputCurrency?.address, outputCurrency?.address, chainId]);

  const onSwapFailed = useCallback((error: unknown) => {
    const id = activeToastId.current ?? swapToastId.current;
    dismissPendingToasts();
    toast.error("Swap failed", {
      id,
      description: getReadableSwapError(error),
      duration: 8_000,
      closeButton: true,
    });
    activeToastId.current = undefined;
  }, [dismissPendingToasts]);

  const onTransactionRejected = useCallback(() => {
    const id = activeToastId.current ?? swapToastId.current;
    dismissPendingToasts();
    showTransactionRejectedToast({
      id,
    });
    activeToastId.current = undefined;
  }, [dismissPendingToasts]);

  return useMemo(
    () => ({
      dismissPendingToasts,
      onWrapRequest,
      onApproveRequest,
      onSwapRequest,
      onSwapConfirming,
      onSwapSuccess,
      onApproveSuccess,
      onWrapSuccess,
      onSwapFailed,
      onTransactionRejected,
    }),
    [
      dismissPendingToasts,
      onApproveRequest,
      onApproveSuccess,
      onSwapConfirming,
      onSwapFailed,
      onSwapRequest,
      onSwapSuccess,
      onTransactionRejected,
      onWrapRequest,
      onWrapSuccess,
    ]
  );
};

export const useSwapBestTrade = () => {
  const { mutateAsync: prepareQuote } = usePrepareQuote();
  const status = useBestTradeSwapStore((state) => state.status);
  const updateStore = useBestTradeSwapStore((state) => state.updateStore);
  const totalSteps = useBestTradeSwapStore((state) => state.totalSteps);
  const currentStepIndex = useBestTradeSwapStore(
    (state) => state.currentStepIndex
  );
  const resetStore = useBestTradeSwapStore((state) => state.resetStore);
  const txHash = useBestTradeSwapStore((state) => state.txHash);

  const { mutateAsync: signEip } = useSignEip();
  const queryClient = useQueryClient();
  const { parsedInputAmount, inputCurrency, outputCurrency } = useDerivedSwap();
  const liquidityHubClient = useLiquidityHub();
  const { address: account, chainId } = useConnection();
  const { data: walletClient } = useWalletClient();
  const setPauseQuote = useSwapStore((state) => state.setPauseQuote);
  const { refetch: refetchBalances } = useBalances();
  const { mutateAsync: getTransactionReceiptCallback } =
    useGetTransactionReceiptCallback();
  const { mutateAsync: signParaswapPermit2 } = useSignParaswapPermit2();
  const { ensureAllowance, approve } = useApproval(
    permit2Address,
    inputCurrency?.address,
    parsedInputAmount
  );
  const { mutateAsync: wrap } = useWrap();
  const toasts = useToasts();
  const partner = getActiveClientPartnerConfig().id;

  const { mutateAsync: swapBestTrade, isPending: isSwapPending } = useMutation({
    mutationFn: async () => {
      if (!inputCurrency || !outputCurrency) {
        throw new Error("Input or output currency not found");
      }
      toasts.dismissPendingToasts();
      resetStore();
      let currentStepIndex = 0;
      setPauseQuote(true);

      let selectedQuote = await prepareQuote();
      const isNativeIn = isNativeAddress(inputCurrency.address);
      if (
        selectedQuote.provider === "paraswap" &&
        !isNativeIn &&
        !selectedQuote.quote.spender
      ) {
        throw new Error("ParaSwap spender not found");
      }

      const hasAllowance =
        isNativeIn && selectedQuote.provider === "paraswap"
          ? true
          : await ensureAllowance();
      const shouldWrap =
        selectedQuote.provider === "liquidityHub" && isNativeIn;
      const shouldApprove = !hasAllowance;
      const totalSteps = getTotalSteps(shouldWrap, shouldApprove);

      if (shouldWrap) {
        updateStore({
          status: SwapStatus.LOADING,
          totalSteps,
          currentStep: SwapStep.WRAP,
          currentStepIndex,
        });

        toasts.onWrapRequest();
        await wrap(parsedInputAmount);
        toasts.onWrapSuccess();
        currentStepIndex++;
        updateStore({ currentStepIndex });
      }

      if (shouldApprove) {
        updateStore({
          status: SwapStatus.LOADING,
          totalSteps,
          currentStep: SwapStep.APPROVE,
          currentStepIndex,
        });
        toasts.onApproveRequest();
        await approve();
        toasts.onApproveSuccess();
        currentStepIndex++;
        updateStore({ currentStepIndex });
      }

      if (
        selectedQuote.provider === "liquidityHub" &&
        (shouldWrap || shouldApprove) &&
        !isFreshQuote(selectedQuote.quote, 60)
      ) {
        selectedQuote = await prepareQuote();
        if (selectedQuote.provider !== "liquidityHub") {
          throw new Error("Quote expired or could not be refreshed");
        }
      }

      updateStore({
        status: SwapStatus.LOADING,
        totalSteps,
        currentStep: SwapStep.SWAP,
        currentStepIndex,
      });
      toasts.onSwapRequest();

      let txHash: `0x${string}` | undefined;
      if (selectedQuote.provider === "liquidityHub") {
        if (!account || !chainId) {
          throw new Error("Wallet is not ready for Liquidity Hub transaction");
        }

        const txParams = await buildParaswapTransaction({
          account,
          chainId,
          ignoreChecks: true,
          partner,
          quote: selectedQuote.paraswapQuote,
        });
        const signature = await signEip(selectedQuote.quote);
        const tx = await liquidityHubClient.swap(selectedQuote.quote, signature, {
          data: txParams.data,
          to: txParams.to,
        });
        txHash = tx as `0x${string}`;
        updateStore({ executionMode: "transaction", txHash });
        toasts.onSwapConfirming(txHash);
        const receipt = await getTransactionReceiptCallback(txHash);
        return { receipt, txHash };
      } else {
        if (!walletClient || !account || !chainId) {
          throw new Error("Wallet is not ready for ParaSwap transaction");
        }

        const permitDeadline = isNativeIn ? undefined : getParaswapPermitDeadline();
        const permit = permitDeadline
          ? await signParaswapPermit2({
              amount: selectedQuote.quote.inAmount,
              deadline: permitDeadline,
              spenderAddress: selectedQuote.quote.spender,
              tokenAddress: inputCurrency.address,
            })
          : undefined;

        if (selectedQuote.quote.executionMode === "delta") {
          const builtOrder = await buildParaswapDeltaOrder({
            account,
            deadline: permitDeadline ?? getParaswapPermitDeadline(),
            partner,
            permit,
            quote: selectedQuote.quote,
          });
          const typedData = builtOrder.toSign;
          const signature = await walletClient.signTypedData({
            account,
            domain: typedData.domain,
            types: getTypedDataTypes(typedData),
            primaryType: getPrimaryType(typedData),
            message: typedData.value,
          });
          const submittedOrder = await submitParaswapDeltaOrder({
            chainId,
            order: typedData.value,
            partner,
            signature: toCompactSignature(signature),
          });

          if (!submittedOrder.id) {
            throw new Error("ParaSwap Delta order id not found");
          }

          updateStore({
            executionMode: "gasless",
            orderId: submittedOrder.id,
          });
          toasts.onSwapConfirming();

          const settledOrder = isParaswapDeltaTerminalStatus(
            submittedOrder.status,
          )
            ? submittedOrder
            : await pollParaswapDeltaOrder(chainId, submittedOrder.id);

          if (isParaswapDeltaFailureStatus(settledOrder.status)) {
            throw new Error(
              `ParaSwap Delta order ${settledOrder.status.toLowerCase()}`,
            );
          }

          txHash = getParaswapDeltaTransactionHash(settledOrder);
          if (txHash) {
            updateStore({ txHash });
          }
          return { order: settledOrder, txHash };
        }

        const txParams = await buildParaswapTransaction({
          account,
          chainId,
          deadline: permitDeadline,
          partner,
          permit,
          quote: selectedQuote.quote,
        });
        txHash = await walletClient.sendTransaction({
          account,
          chain: walletClient.chain,
          to: txParams.to,
          data: txParams.data,
          value: BigInt(txParams.value || "0"),
          gas: txParams.gas ? BigInt(txParams.gas) : undefined,
          maxFeePerGas: txParams.maxFeePerGas
            ? BigInt(txParams.maxFeePerGas)
            : undefined,
          maxPriorityFeePerGas: txParams.maxPriorityFeePerGas
            ? BigInt(txParams.maxPriorityFeePerGas)
            : undefined,
        });
        updateStore({ executionMode: "transaction", txHash });
        toasts.onSwapConfirming(txHash);
        const receipt = await getTransactionReceiptCallback(txHash);
        return { receipt, txHash };
      }
    },
    onSuccess: ({ txHash }) => {
      toasts.onSwapSuccess(txHash);
      updateStore({ status: SwapStatus.SUCCESS });
    },
    onError: (error) => {
      if (process.env.NODE_ENV !== "production") {
        console.error(error);
      }

      if (isUserRejectedError(error)) {
        toasts.onTransactionRejected();
        updateStore({ status: undefined });
      } else {
        updateStore({ status: SwapStatus.FAILED });
        toasts.onSwapFailed(error);
      }
    },
    onSettled: (_data, error) => {
      if (isUserRejectedError(error)) {
        markQuoteQueriesFresh(queryClient);
        setPauseQuote(false);
        return;
      }

      setPauseQuote(false);
      refetchBalances();
    },
  });

  return useMemo(
    () => ({
      onSwapBestTrade: swapBestTrade,
      isPreparing: isSwapPending && !status,
      status,
      totalSteps,
      currentStepIndex,
      txHash,
      reset: resetStore,
    }),
    [
      currentStepIndex,
      isSwapPending,
      resetStore,
      status,
      swapBestTrade,
      totalSteps,
      txHash,
    ]
  );
};
