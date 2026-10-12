import { useMemo } from "react";
import { formatDecimals, parseNativeCurrencyAddress, toAmountUI, toAmountWei } from "../utils";
import { formatDisplayAmount } from "../token-display";
import { useConnection } from "wagmi";

export const useToAmountUI = (decimals?: number, value?: string) => {
    return useMemo(() => {
       return toAmountUI(value, decimals);
    }, [decimals, value]);
};

export const useFormatDecimals = (value?: string,decimals = 6) => {
    return useMemo(() => {
        return formatDecimals(value, decimals);
    }, [decimals, value]);
};

export const useToAmountWei = (decimals?: number, value?: string) => {
    return useMemo(() => {
        return toAmountWei(value, decimals);
    }, [decimals, value]);
};

export const useFormatNumber = ({ value, decimalScale = 4, prefix, suffix }: { value?: string | number; decimalScale?: number; prefix?: string; suffix?: string }) => {
    return formatDisplayAmount(value, { decimalScale, prefix, suffix });
  };
  

  export const useParseNativeCurrencyAddress = (address?: string) => {
    const { chainId } = useConnection();
    return useMemo(() => {
        if(!address || !chainId) return undefined;
      return parseNativeCurrencyAddress(address, chainId);
    }, [address, chainId]);
  };
