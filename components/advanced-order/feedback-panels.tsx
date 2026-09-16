"use client";

import { useInputErrors, useDisclaimer } from "./use-order-form";

import { useClient } from "./use-order-client";
import { InlineMessage } from "@/components/ui/inline-message";
import { useTranslations } from "@/lib/use-translations";
import {
  ORBS_TWAP_FAQ_URL,
} from "@orbs-network/spot-ui";
import { AlertTriangleIcon, InfoIcon } from "lucide-react";
import { formatInputError } from "./utils";

export function InputErrorPanel() {
  const t = useTranslations();
  const error = useInputErrors();
  const client = useClient();
  const message = formatInputError(error, t);

  if (client.error) {
    return <InlineMessage variant="error"><div role="alert">Could not load order configuration. <button type="button" className="underline" onClick={() => void client.refetch()}>Retry</button></div></InlineMessage>;
  }

  if (!message) {
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

  if (!disclaimer) {
    return null;
  }

  return (
    <InlineMessage
      icon={
        <InfoIcon aria-hidden="true" className="relative top-1 size-4 shrink-0 text-muted-foreground" />
      }
    >
      <p className="flex-1 text-[14px] text-muted-foreground">
        {t(disclaimer)}{" "}
        <a
          href={ORBS_TWAP_FAQ_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary"
        >
          Learn more
        </a>
      </p>
    </InlineMessage>
  );
}
