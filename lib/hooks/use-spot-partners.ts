"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSpotPartners } from "@/lib/spot/partners";

export function useSpotPartners(enabled = true) {
  return useQuery({
    queryKey: ["spot", "partners"],
    queryFn: ({ signal }) => fetchSpotPartners(signal),
    staleTime: 5 * 60_000,
    retry: 2,
    enabled,
  });
}
