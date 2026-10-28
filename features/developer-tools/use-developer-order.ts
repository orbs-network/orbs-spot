"use client";

import { useMemo } from "react";
import { useConnection } from "wagmi";
import { useClient, useOrders } from "@/components/advanced-order/use-order-client";
import { getWrappedNativeCurrency, isNativeAddress } from "@/lib/utils";
import { useDataChainId } from "@/lib/hooks/use-data-chain-id";
import { getDemoOrderForm, DEMO_ACCOUNT, type DeveloperExecutionMode } from "./demo-order";
import { useOrderReview } from "@/components/advanced-order/use-order-review";
import { useOrderModel } from "@/components/advanced-order/use-order-form";

/** Prepare the developer preview through the same client used for submission. */
export function useDeveloperOrder(mode: DeveloperExecutionMode = "demo") {
  const review = useOrderReview();
  const client = useClient();
  const { market } = useOrderModel();
  const history = useOrders();
  const { address: connectedAddress } = useConnection();
  const chainId = useDataChainId();
  const address = connectedAddress ?? (mode === "demo" ? DEMO_ACCOUNT : undefined);
  const form = useMemo(() => mode === "demo" ? getDemoOrderForm(review.form) : review.form, [mode, review.form]);
  const permit = useMemo(() => {
    if (!client.data || !form.canSubmit || !review.srcToken || !review.dstToken || !address) return;
    const inputTokenAddress = isNativeAddress(review.srcToken.address)
      ? getWrappedNativeCurrency(chainId)?.address
      : review.srcToken.address;
    if (!inputTokenAddress) return;
    const prepared = client.data.prepareOrder({ form, inputTokenAddress, outputTokenAddress: review.dstToken.address, swapperAddress: address });
    return { ...client.data.rePermitData, order: prepared.order };
  }, [address, chainId, client.data, form, review.srcToken, review.dstToken]);
  return {
    client: client.data,
    canDemoExecute: form.canSubmit && Boolean(market.value) && !market.isLoading && !market.noLiquidity && !market.error,
    module: review.form.module,
    derivedFormData: {
      ...review,
      form,
      rePermitData: permit,
      quotedOutputAmountRaw: market.isLoading || market.noLiquidity || market.error ? undefined : market.value || undefined,
    },
    fillDelayPanel: { fillDelay: review.form.schedule.fillDelay },
    durationPanel: { duration: review.form.schedule.duration },
    configuration: { error: client.error, loading: client.isLoading, retry: client.refetch },
    orderHistoryPanel: { refetchOrders: history.refetch },
  };
}
