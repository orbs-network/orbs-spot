import { Quote } from "@orbs-network/liquidity-hub-sdk";
import { useMutation } from "@tanstack/react-query";
import { useSignTypedData } from "wagmi";
import { _TypedDataEncoder } from "@ethersproject/hash";

export const useSignEip = () => {
  const { signTypedDataAsync } = useSignTypedData();

  return useMutation({
    mutationFn: async (quote: Quote) => {
        const permitData = quote.permitData;
        const populated = await _TypedDataEncoder.resolveNames(
            permitData.domain,
            permitData.types,
            permitData.values,
            async (name: string) => name
          );
          const payload = _TypedDataEncoder.getPayload(
            populated.domain,
            permitData.types,
            populated.value
          );

      const signature = await signTypedDataAsync(payload);
      return signature;
    },
  });
};
