import { createPublicClient, http } from "viem";
import { SUPPORTED_CHAINS } from "./consts";
import { getRpcUrl } from "./rpc-url";

export function getPublicClient(chainId: number) {
  const chain = SUPPORTED_CHAINS.find((supportedChain) => supportedChain.id === chainId);

  return createPublicClient({
    chain,
    transport: http(getRpcUrl(chainId)),
  });
}
