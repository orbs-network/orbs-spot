import type { Quote } from "@orbs-network/liquidity-hub-sdk";
import { useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";

import { useSignTypedDataPayload } from "./use-sign-typed-data";

export const useSignEip = () => {
  const { mutateAsync: signTypedData } = useSignTypedDataPayload();
  const { address: account } = useAccount();

  return useMutation({
    mutationFn: async (quote: Quote) => {
      const permitData = quote.eip712;
      const signature = await signTypedData({
        domain: permitData.domain,
        types: permitData.types,
        primaryType: permitData.primaryType,
        message: permitData.message,
        account,
      });
      return signature;
    },
  });
};
