/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation } from "@tanstack/react-query";
import { useSignTypedData } from "wagmi";

export type SignTypedDataPayload = {
  domain: Record<string, unknown>;
  types: Record<string, unknown>;
  primaryType: string;
  message: Record<string, unknown>;
  account?: `0x${string}`;
};

export const useSignTypedDataPayload = () => {
  const { signTypedDataAsync } = useSignTypedData();

  return useMutation({
    mutationFn: async (payload: SignTypedDataPayload) => {
      return signTypedDataAsync(payload as any);
    },
  });
};
