import { useConnection } from "wagmi";
import { DEFAULT_CHAIN_ID } from "../consts";

export const useDataChainId = (): number => {
  const { chainId } = useConnection();

  return chainId ?? DEFAULT_CHAIN_ID;
};
