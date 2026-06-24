import { constructSimpleSDK, isFetcherError } from "@velora-dex/sdk";
import { PARASWAP_API_URL, PARASWAP_MARKET_VERSION } from "./paraswap";

export const createParaswapSdk = (chainId: number) =>
  constructSimpleSDK({
    apiURL: PARASWAP_API_URL,
    chainId,
    fetch,
    version: PARASWAP_MARKET_VERSION,
  });

export const getParaswapSdkErrorStatus = (error: unknown) =>
  isFetcherError(error) ? error.status : undefined;

const getErrorDataMessage = (data: unknown) => {
  if (!data) {
    return undefined;
  }
  if (typeof data === "string") {
    return data;
  }
  if (typeof data !== "object") {
    return undefined;
  }

  const record = data as Record<string, unknown>;
  const message =
    record.error ??
    record.message ??
    record.details ??
    record.reason;

  if (typeof message === "string") {
    return message;
  }
  if (message) {
    return JSON.stringify(message);
  }

  return JSON.stringify(record);
};

export const getParaswapSdkErrorMessage = (error: unknown) => {
  if (isFetcherError(error)) {
    return (
      getErrorDataMessage(error.response?.data) ??
      error.message
    );
  }

  return error instanceof Error ? error.message : undefined;
};
