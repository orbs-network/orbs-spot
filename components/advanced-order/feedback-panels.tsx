"use client";

import { useInputErrors, useDisclaimer } from "./use-order-form";

import { useClient } from "./use-order-client";
import { InlineMessage } from "@/components/ui/inline-message";
import { useTranslations } from "@/lib/use-translations";
import {
  ORBS_TWAP_FAQ_URL,
  InputErrors,
} from "@orbs-network/spot-ui";
import { AlertTriangleIcon, InfoIcon } from "lucide-react";
import { formatInputError } from "./utils";
import { useDeveloperMode } from "@/lib/hooks/use-developer-mode";

export function InputErrorPanel() {
  const t = useTranslations();
  const error = useInputErrors();
  const client = useClient();
  const message = formatInputError(error, t);

  if (client.error) {
    return <InlineMessage variant="error"><div role="alert">Could not load order configuration. <button data-hover="text" type="button" className="underline" onClick={() => void client.refetch()}>Retry</button></div></InlineMessage>;
  }

  // Price controls present these errors directly beside the relevant input.
  const isPriceError = error && [
    InputErrors.MISSING_LIMIT_PRICE,
    InputErrors.EMPTY_TRIGGER_PRICE,
    InputErrors.STOP_LOSS_TRIGGER_PRICE_GREATER_THAN_MARKET_PRICE,
    InputErrors.TAKE_PROFIT_TRIGGER_PRICE_LESS_THAN_MARKET_PRICE,
    InputErrors.TRIGGER_LIMIT_PRICE_GREATER_THAN_TRIGGER_PRICE,
  ].includes(error.type);
  if (!message || isPriceError) {
    return null;
  }

  return (
    <InlineMessage
      variant="error"
      icon={
        <AlertTriangleIcon aria-hidden="true" className="relative top-0.5 size-4 shrink-0 text-destructive" />
      }
    >
      <p className="flex-1">{message}</p>
    </InlineMessage>
  );
}

export function DisclaimerPanel() {
  const t = useTranslations();
  const disclaimer = useDisclaimer();
  const { isDeveloperToolsAvailable } = useDeveloperMode();

  if (!disclaimer) {
    return null;
  }

  return (
    <InlineMessage
      icon={
        <InfoIcon aria-hidden="true" className="relative top-0.5 size-4 shrink-0 text-muted-foreground" />
      }
    >
      <p className="flex-1 text-[13px] text-muted-foreground">
        {t(disclaimer)}{" "}
        {isDeveloperToolsAvailable && <a
          href={ORBS_TWAP_FAQ_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary"
        >
          Learn more
        </a>}
      </p>
    </InlineMessage>
  );
}
