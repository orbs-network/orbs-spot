"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import { getPlaygroundHref } from "@/lib/developer-routes";
import { useDeveloperMode } from "@/lib/hooks/use-developer-mode";
import { isSpotDebugMode } from "@/lib/spot/api";

/** Preserve selected API, debug partner testing, and playground navigation context. */
export function AppLink({ href, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const searchParams = useSearchParams();
  const { isDeveloperPlayground } = useDeveloperMode();
  let nextHref = href;
  if (href.startsWith("/") && !href.startsWith("//")) {
    nextHref = isDeveloperPlayground ? getPlaygroundHref(href) : href;
    const url = new URL(nextHref, "https://app.local");
    if (searchParams.get("debug") === "true") {
      if (!url.searchParams.has("debug")) url.searchParams.set("debug", "true");
    }
    if (isSpotDebugMode(searchParams)) {
      const partner = searchParams.get("partner");
      if (partner && !url.searchParams.has("partner")) url.searchParams.set("partner", partner);
    }
    if (isDeveloperPlayground && searchParams.get("mockorders") === "true") {
      if (!url.searchParams.has("mockorders")) url.searchParams.set("mockorders", "true");
    }
    // An explicit destination API takes precedence over the current selection.
    if (!url.searchParams.has("api") && searchParams.has("api")) {
      url.searchParams.set("api", searchParams.get("api") ?? "");
    }
    nextHref = `${url.pathname}${url.search}${url.hash}`;
  }
  return <Link href={nextHref} {...props} />;
}
