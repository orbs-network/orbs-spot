"use client";

import { useSearchParams } from "next/navigation";
import { getSpotApiUrl } from "@/lib/spot/api";

export function useSpotApiUrl(): string {
  return getSpotApiUrl(useSearchParams());
}
