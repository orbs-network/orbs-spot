import { useConnection } from "wagmi";
import { DEFAULT_CHAIN_ID, SPOT_CHAINS } from "../consts";

export const useDataChainId = (): number => {
  const { chainId } = useConnection();

  const ids = process.env.NEXT_PUBLIC_RPC_CHAIN_IDS;
  const configured = ids ? new Set(ids.split(",").map(Number)) : undefined;
  const defaultChain = configured ? SPOT_CHAINS.find(chain => configured.has(chain.id))?.id : DEFAULT_CHAIN_ID;
  return chainId ?? defaultChain ?? DEFAULT_CHAIN_ID;
};
