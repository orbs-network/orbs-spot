"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";

/** Keep explicit sample-order previews enabled when navigating within the app. */
export function AppLink({ href, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const searchParams = useSearchParams();
  let nextHref = href;
  if (searchParams.get("mockorders") === "true" && href.startsWith("/") && !href.startsWith("//")) {
    const url = new URL(href, "https://app.local");
    if (!url.searchParams.has("mockorders")) url.searchParams.set("mockorders", "true");
    nextHref = `${url.pathname}${url.search}${url.hash}`;
  }
  return <Link href={nextHref} {...props} />;
}
