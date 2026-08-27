import { constructSDK } from "@orbs-network/liquidity-hub-sdk";
import { useMemo } from "react";
import { useConnection } from "wagmi";
import { getActiveLiquidityHubPartnerId } from "../partners/liquidity-hub";

export const useLiquidityHub = () => {
  const { chainId } = useConnection();
  return useMemo(() => {
    return constructSDK({
      chainId: chainId || 1,
      partner: getActiveLiquidityHubPartnerId(),
    });
  }, [chainId]);
};
