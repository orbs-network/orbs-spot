import { constructSDK } from "@orbs-network/liquidity-hub-sdk";
import { useMemo } from "react";
import { useConnection } from "wagmi";
import { getActiveClientPartnerConfig } from "../partners/client";

export const useLiquidityHub = () => {
  const { chainId } = useConnection();
  return useMemo(() => {
    const id = getActiveClientPartnerConfig().id;
    return constructSDK({
      chainId: chainId || 1,
      partner: id === 'ginco' ? 'playground' : id,
    });
  }, [chainId]);
};
