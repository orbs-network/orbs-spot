import { useConnection, useSwitchChain } from "wagmi";
import { Button } from "./ui/button";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { getChainName } from "@/lib/utils";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useBalance } from "@/lib/hooks/use-balances";
import BN from "bignumber.js";
import { useMemo } from "react";
import { useTranslations } from "@/lib/use-translations";

type SubmitSwapButtonProps = {
  onClick: () => void;
  isLoading: boolean;
  text: string;
  chainId?: number;
  disabled?: boolean;
  validateSwap?: boolean;
};

type SubmitButtonBaseProps = Omit<SubmitSwapButtonProps, "validateSwap">;

const SubmitButtonBase = ({
  onClick,
  isLoading,
  text,
  chainId,
  disabled,
}: SubmitButtonBaseProps) => {
  const { address, chainId: currentChainId } = useConnection();
  const { openConnectModal } = useConnectModal();
  const switchChain = useSwitchChain();

  if (!address) {
    return (
      <Button
        data-submit-button
        className="h-12 w-full rounded-[14px] text-base"
        onClick={() => {
          openConnectModal?.();
        }}
      >
        Connect Wallet
      </Button>
    );
  }

  if (chainId && currentChainId && currentChainId !== chainId) {
    return (
      <Button
        data-submit-button
        className="h-12 w-full rounded-[14px] text-base"
        onClick={() => {
          switchChain.mutate({ chainId });
        }}
      >
        Switch to {getChainName(chainId)} Network
      </Button>
    );
  }

  return (
    <Button
      data-submit-button
      className="h-12 w-full rounded-[14px] text-base"
      onClick={onClick}
      isLoading={isLoading}
      disabled={disabled || isLoading}
    >
      {text}
    </Button>
  );
};

const ValidatedSubmitSwapButton = ({
  onClick,
  isLoading,
  text,
  chainId,
  disabled,
}: SubmitButtonBaseProps) => {
  const t = useTranslations();
  const {
    inputCurrency,
    outputCurrency,
    parsedInputAmount,
    isLoadingTrade,
    noLiquidity,
  } = useDerivedSwap();
  const inputTokenBalance = useBalance(inputCurrency).wei;



  const insufficientBalance = useMemo(() => {
    return BN(inputTokenBalance ?? "0").lt(parsedInputAmount ?? "0");
  }, [inputTokenBalance, parsedInputAmount]);
  const enterAmount = BN(parsedInputAmount ?? "0").eq(0) 

  const _disabled =
    disabled ||
    !inputCurrency ||
    !outputCurrency ||
    isLoading ||
    insufficientBalance ||
    enterAmount ||
    noLiquidity;

  const _text = useMemo(() => {
    if (enterAmount) {
      return t("enterAmount");
    }
    if (isLoadingTrade) {
      return t("fetchingQuote");
    }
    if (insufficientBalance) {
      return t("insufficientFunds");
    }
    if(noLiquidity) {
      return t("noLiquidity");
    }
    return text;
  }, [
    enterAmount,
    insufficientBalance,
    text,
    t,
    isLoadingTrade,
    noLiquidity,
  ]);

  return (
    <SubmitButtonBase
      onClick={onClick}
      isLoading={isLoading && !noLiquidity}
      disabled={_disabled}
      text={_text}
      chainId={chainId}
    />
  );
};

export const SubmitSwapButton = ({
  validateSwap = true,
  ...props
}: SubmitSwapButtonProps) => {
  if (!validateSwap) {
    return <SubmitButtonBase {...props} />;
  }

  return <ValidatedSubmitSwapButton {...props} />;
};
