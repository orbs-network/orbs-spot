"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import { getPlaygroundHref } from "@/lib/developer-routes";
import { useDeveloperMode } from "@/lib/hooks/use-developer-mode";

/** Preserve debug partner testing and playground navigation context. */
export function AppLink({ href, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const searchParams = useSearchParams();
  const { isDeveloperPlayground } = useDeveloperMode();
  let nextHref = href;
  if (href.startsWith("/") && !href.startsWith("//")) {
    nextHref = isDeveloperPlayground ? getPlaygroundHref(href) : href;
    if (searchParams.get("debug") === "true") {
      const url = new URL(nextHref, "https://app.local");
      if (!url.searchParams.has("debug")) url.searchParams.set("debug", "true");
      const partner = searchParams.get("partner");
      if (partner && !url.searchParams.has("partner")) url.searchParams.set("partner", partner);
      nextHref = `${url.pathname}${url.search}${url.hash}`;
    }
    if (isDeveloperPlayground && searchParams.get("mockorders") === "true") {
      const url = new URL(nextHref, "https://app.local");
      if (!url.searchParams.has("mockorders")) url.searchParams.set("mockorders", "true");
      nextHref = `${url.pathname}${url.search}${url.hash}`;
    }
  }
  return <Link href={nextHref} {...props} />;
}
