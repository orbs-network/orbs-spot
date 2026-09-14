import { Partners } from "@orbs-network/spot-react";

import { getActiveClientPartnerConfig } from "./client";

export function getActiveSpotPartner() {
  switch (getActiveClientPartnerConfig().id) {
    case "ef":
      return Partners.EfficientFrontier;
    case "ht":
      return Partners.HtDigital;
    case "ginco":
      return Partners.Ginco;
    default:
      return Partners.External;
  }
}
