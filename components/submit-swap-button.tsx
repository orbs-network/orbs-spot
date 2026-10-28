import { trackFunnel } from "@/lib/funnel-analytics";
import { useConnection, useSwitchChain } from "wagmi";
import { Button } from "./ui/button";
import { useWalletConnectModal } from "@/features/wallet-connection/provider";
import { DEFAULT_CHAIN_ID } from "@/lib/consts";
import { toast } from "sonner";
import { getNetworkLabel } from "./network-label";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useBalance } from "@/lib/hooks/use-balances";
import BN from "bignumber.js";
import { useMemo } from "react";
import { useTranslations } from "@/lib/use-translations";
import { useSpotPartnerChains } from "@/lib/hooks/use-spot-partner-chains";
import { useUSDPrice } from "@/lib/hooks/use-usd-price";
import { MIN_SWAP_VALUE_USD } from "@/lib/swap/quotes";

type SubmitSwapButtonProps = {
  onClick: () => void;
  isLoading: boolean;
  text: string;
  chainId?: number;
  disabled?: boolean;
  validateSwap?: boolean;
};

type SubmitButtonBaseProps = Omit<SubmitSwapButtonProps, "validateSwap"> & {
  product?: "swap" | "advanced";
};

export const SubmitButtonBase = ({
  onClick,
  isLoading,
  text,
  chainId,
  disabled,
  product = "swap",
}: SubmitButtonBaseProps) => {
  const { chains: supportedChains, isLoading: networksLoading, isError: networksError } = useSpotPartnerChains();
  const networkUnavailableMessage = networksLoading ? "Loading networks…" : networksError ? "Networks unavailable" : "No supported networks";
  const {
    address,
    chainId: currentChainId,
    isConnecting,
    isReconnecting,
  } = useConnection();
  const { openConnectModal } = useWalletConnectModal();
  const switchChain = useSwitchChain();
  const isWalletLoading = isConnecting || isReconnecting;

  if (!address || isWalletLoading) {
    return (
      <Button
        data-submit-button
        className="h-12 w-full rounded-[14px] text-base motion-reduce:[&_svg]:animate-none"
        isLoading={isWalletLoading}
        aria-busy={isWalletLoading}
        onClick={() => {
          trackFunnel({ name: "wallet_connect_requested", product });
          openConnectModal?.();
        }}
      >
        {isWalletLoading ? "Connecting…" : "Connect Wallet"}
      </Button>
    );
  }

  const targetChainId = chainId && supportedChains.some(chain => chain.id === chainId) ? chainId
    : currentChainId && supportedChains.some(chain => chain.id === currentChainId) ? currentChainId
    : supportedChains.find(chain => chain.id === DEFAULT_CHAIN_ID)?.id ?? supportedChains[0]?.id;
  if (!targetChainId) {
    return <Button data-submit-button className="h-12 w-full rounded-[14px] text-base" disabled>
      {networkUnavailableMessage}
    </Button>;
  }
  if (currentChainId && currentChainId !== targetChainId) {
    return (
      <Button
        data-submit-button
        className="h-12 w-full rounded-[14px] text-base"
        disabled={switchChain.isPending}
        isLoading={switchChain.isPending}
        onClick={() => {
          switchChain.mutate({ chainId: targetChainId }, { onError: () => toast.error("Network switch cancelled or unavailable. Select the network in your wallet.") });
        }}
      >
        Switch to {getNetworkLabel(targetChainId)}
      </Button>
    );
  }

  return (
    <Button
      data-submit-button
      className="h-12 w-full rounded-[14px] text-base"
      onClick={onClick}
      isLoading={isLoading}
      aria-busy={isLoading}
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
    inputAmount,
    outputCurrency,
    parsedInputAmount,
    isLoadingTrade,
    noLiquidity,
    quoteError,
    trade,
  } = useDerivedSwap();
  const inputTokenBalance = useBalance(inputCurrency).wei;
  const inputUsd = useUSDPrice({ token: inputCurrency?.address, amount: inputAmount });
  const priceUnavailable = inputUsd.data === undefined || inputUsd.isError;
  const belowMinimum = inputUsd.data !== undefined && inputUsd.data < MIN_SWAP_VALUE_USD;



  const insufficientBalance = useMemo(() => {
    return BN(inputTokenBalance ?? "0").lt(parsedInputAmount ?? "0");
  }, [inputTokenBalance, parsedInputAmount]);
  const enterAmount = !BN(parsedInputAmount).isFinite() || BN(parsedInputAmount).lte(0)

  const _disabled =
    disabled ||
    !inputCurrency ||
    !outputCurrency ||
    isLoading ||
    insufficientBalance ||
    isLoadingTrade ||
    !!quoteError ||
    !trade ||
    priceUnavailable ||
    belowMinimum ||
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
    if (quoteError) return "Quote unavailable";
    if (priceUnavailable) return inputUsd.isLoading ? "Loading price…" : "Price unavailable";
    if (belowMinimum) return `Minimum swap is $${MIN_SWAP_VALUE_USD}`;
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
    quoteError,
    priceUnavailable,
    belowMinimum,
    inputUsd.isLoading,
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
    return <SubmitButtonBase {...props} product="advanced" />;
  }

  return <ValidatedSubmitSwapButton {...props} />;
};
