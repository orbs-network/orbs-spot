import { getNativeConversion } from "../native-conversion";
import { getWrappedNativeCurrency } from "../utils";
import { useDataChainId } from "./use-data-chain-id";
import { useSwapParams } from "./use-swap-params";

export function useNativeConversion() {
  const chainId = useDataChainId();
  const { inputCurrency, outputCurrency } = useSwapParams();
  return getNativeConversion(inputCurrency, outputCurrency, getWrappedNativeCurrency(chainId)?.address);
}
