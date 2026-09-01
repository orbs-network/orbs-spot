export type DeveloperGuideId =
  | "liquidity-hub"
  | "advanced-orders-core"
  | "advanced-orders-react";

export interface DeveloperGuideStep {
  content: string;
  id: string;
  title: string;
}

export interface DeveloperGuide {
  description: string;
  hashAliases: Record<string, string>;
  id: DeveloperGuideId;
  intro: string;
  introReference: string;
  label: string;
  route: string;
  steps: DeveloperGuideStep[];
  title: string;
}
