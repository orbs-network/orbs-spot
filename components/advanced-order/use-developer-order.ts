"use client";

import { useMemo } from "react";
import { useConnection } from "wagmi";
import { useClient, useOrders, useSubmitButton } from "@orbs-network/spot-react";
import { getWrappedNativeCurrency, isNativeAddress } from "@/lib/utils";
import { useOrderReview } from "./use-order-review";

/** Prepare the developer preview through the same client used for submission. */
export function useDeveloperOrder() {
  const review = useOrderReview();
  const client = useClient();
  const history = useOrders();
  const button = useSubmitButton();
  const { address, chainId } = useConnection();
  const permit = useMemo(() => {
    if (!client.data || !review.form.canSubmit || !review.srcToken || !review.dstToken || !address) return;
    const inputTokenAddress = isNativeAddress(review.srcToken.address)
      ? getWrappedNativeCurrency(chainId)?.address
      : review.srcToken.address;
    if (!inputTokenAddress) return;
    const prepared = client.data.prepareOrder({ form: review.form, inputTokenAddress, outputTokenAddress: review.dstToken.address, swapperAddress: address });
    return { ...client.data.rePermitData, order: prepared.order };
  }, [address, chainId, client.data, review.form, review.srcToken, review.dstToken]);
  return {
    client: client.data,
    module: review.form.module,
    derivedFormData: { ...review, rePermitData: permit },
    fillDelayPanel: { fillDelay: review.form.schedule.fillDelay },
    durationPanel: { duration: review.form.schedule.duration },
    submitOrderButton: { ...button, error: client.error, loading: client.isLoading, retry: client.refetch },
    orderHistoryPanel: { refetchOrders: history.refetch },
  };
}
