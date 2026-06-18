import { createPublicClient, http } from "viem";
import * as chains from "viem/chains";
import { getRpcUrl } from "./rpc-url";

export function getPublicClient(chainId: number) {
  const chain = Object.values(chains).find((chain) => chain.id === chainId);

  return createPublicClient({
    chain,
    transport: http(getRpcUrl(chainId)),
  });
}
