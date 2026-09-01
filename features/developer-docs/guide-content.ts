import fs from "node:fs";
import path from "node:path";

import type {
  DeveloperGuide,
  DeveloperGuideId,
  DeveloperGuideStep,
} from "./guide-types";

interface GuideSource {
  description: string;
  fileName: string;
  hashAliases: Record<string, string>;
  id: DeveloperGuideId;
  introSections: readonly string[];
  label: string;
  route: string;
  stepOrder: readonly string[];
}

const GUIDE_SOURCES = [
  {
    description: "Best-price routing for swaps",
    fileName: "liquidity-hub.md",
    hashAliases: {
      "end-to-end-flow": "execute-the-full-flow",
      "execute-swap": "execute-the-full-flow",
      "execute-and-confirm": "execute-the-full-flow",
      "fallback-and-errors": "errors-and-recovery",
      "fetch-quote": "request-quotes",
      "refresh-and-sign": "execute-the-full-flow",
      "wrap-and-approve": "execute-the-full-flow",
      overview: "install-and-initialize",
    },
    id: "liquidity-hub",
    introSections: ["Concepts", "Integration Resources"],
    label: "Liquidity Hub",
    route: "/developers/liquidity-hub",
    stepOrder: [],
  },
  {
    description: "Direct HTTP + EIP-712 integration",
    fileName: "advanced-orders.md",
    hashAliases: {
      allowance: "create-order",
      "cancel-order": "cancel-order-sink-orders",
      "core-setup": "fetch-partner-config",
      "end-to-end": "create-order",
      "fetch-orders": "fetch-order-sink-orders",
      "generated-order-fields": "build-the-order",
      overview: "fetch-partner-config",
      "output-limit-and-trigger-rules": "build-the-order",
      "protocol-reference": "fetch-partner-config",
      sign: "create-order",
      submit: "create-order",
      "witness-fields": "build-the-order",
    },
    id: "advanced-orders-core",
    introSections: ["Concepts", "Integration Resources"],
    label: "Advanced Orders · Direct API",
    route: "/developers/orders-sink/direct",
    stepOrder: [
      "fetch-partner-config",
      "build-the-order",
      "strategy-recipes",
      "create-order",
      "fetch-order-sink-orders",
      "cancel-order-sink-orders",
      "operational-checklist",
    ],
  },
  {
    description: "Provider + hooks for React",
    fileName: "advanced-orders-react.md",
    hashAliases: {
      callbacks: "submit-modal-and-lifecycle",
      history: "order-history",
      install: "install-the-react-sdk",
      "install-the-react-package": "install-the-react-sdk",
      "install-the-react-packages": "install-the-react-sdk",
      "integration-model": "advanced-orders-provider",
      "lifecycle-and-reset": "submit-modal-and-lifecycle",
      "order-history-and-cancellation": "order-history",
      "order-history-details-fills-and-cancellation": "order-history",
      overview: "prerequisites",
      "package-guardrails-and-escape-hatches": "order-history",
      "connect-spotprovider": "advanced-orders-provider",
      "adapt-wallet-interactions": "advanced-orders-provider",
      provider: "advanced-orders-provider",
      submit: "submit-modal-and-lifecycle",
      "submit-and-show-progress": "submit-modal-and-lifecycle",
      wallet: "advanced-orders-provider",
    },
    id: "advanced-orders-react",
    introSections: ["Integration Resources"],
    label: "Advanced Orders · React SDK",
    route: "/developers/orders-sink/react",
    stepOrder: [],
  },
] as const satisfies readonly GuideSource[];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function splitGuide(
  markdown: string,
  introSectionTitles: readonly string[],
  stepOrder: readonly string[],
): {
  intro: string;
  introReference: string;
  steps: DeveloperGuideStep[];
  title: string;
} {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  const titleMatch = normalized.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1] ?? "Spot Integration Docs";
  const withoutTitle = normalized.replace(/^#\s+.+\n?/, "").trim();
  const sections = withoutTitle.split(/\n(?=##\s+)/g);
  const intro = sections[0]?.startsWith("## ") ? "" : (sections.shift() ?? "");
  const introSectionIds = new Set(introSectionTitles.map(slugify));
  const introReference: string[] = [];
  const steps: DeveloperGuideStep[] = [];

  for (const section of sections) {
    const [heading = "", ...content] = section.split("\n");
    const stepTitle = heading.replace(/^##\s+/, "").trim();
    const stepContent = content.join("\n").trim();

    if (stepTitle && stepContent) {
      const id = slugify(stepTitle);
      if (introSectionIds.has(id)) {
        const nestedContent = stepContent.replace(
          /^(#{3,4})(\s+)/gm,
          "#$1$2",
        );
        introReference.push(`### ${stepTitle}\n\n${nestedContent}`);
        continue;
      }

      steps.push({
        content: stepContent,
        id,
        title: stepTitle,
      });
    }
  }

  if (stepOrder.length > 0) {
    const orderById = new Map(stepOrder.map((id, index) => [id, index]));
    steps.sort(
      (left, right) =>
        (orderById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (orderById.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }

  return {
    intro,
    introReference: introReference.join("\n\n"),
    steps,
    title,
  };
}

export function loadDeveloperGuides(): DeveloperGuide[] {
  const contentDirectory = path.join(
    process.cwd(),
    "features",
    "developer-docs",
    "content",
  );

  return GUIDE_SOURCES.map((source): DeveloperGuide => {
    const markdown = fs.readFileSync(
      path.join(contentDirectory, source.fileName),
      "utf8",
    );
    const guide = splitGuide(
      markdown,
      source.introSections,
      source.stepOrder,
    );

    return {
      description: source.description,
      hashAliases: source.hashAliases,
      id: source.id,
      intro: guide.intro,
      introReference: guide.introReference,
      label: source.label,
      route: source.route,
      steps: guide.steps,
      title: guide.title,
    };
  });
}
