import type { Metadata } from "next";
import { ORDER_INSPECTOR_PATH } from "@/lib/developer-routes";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = { title: "Order preview | Orbs Spot" };

export default async function Eip712InspectorPage({ searchParams }: PageProps<"/developers/eip712">) {
  const query = await searchParams;
  if (query.debug !== "true") notFound();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === "dev") continue;
    if (Array.isArray(value)) value.forEach(item => params.append(key, item));
    else if (value !== undefined) params.set(key, value);
  }
  redirect(`${ORDER_INSPECTOR_PATH}${params.size ? `?${params}` : ""}`);
}
