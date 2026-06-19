import { Quote } from "@orbs-network/liquidity-hub-sdk";
import { useMutation } from "@tanstack/react-query";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { useSignTypedDataPayload } from "./use-sign-typed-data";

export const useSignEip = () => {
  const { mutateAsync: signTypedData } = useSignTypedDataPayload();

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

      const signature = await signTypedData(payload);
      return signature;
    },
  });
};
