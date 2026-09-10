import { createClient } from "@orbs-network/liquidity-hub-sdk";
import { useMemo } from "react";
import { useConnection } from "wagmi";
import { getActiveLiquidityHubPartnerId } from "../partners/liquidity-hub";

export const useLiquidityHub = () => {
  const { chainId } = useConnection();
  return useMemo(() => {
    return createClient({
      chainId: chainId || 1,
      partner: getActiveLiquidityHubPartnerId(),
      apiUrl: `/api/liquidity-hub/${chainId || 1}`,
    });
  }, [chainId]);
};
