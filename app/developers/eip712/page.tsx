import { getAppConfig } from "@/lib/partners/config";
import { ORDER_INSPECTOR_PATH } from "@/lib/developer-routes";
import { notFound, redirect } from "next/navigation";
import { isSpotDebugMode } from "@/lib/spot/api";

export const metadata = { title: `Order preview | ${getAppConfig().brand.name}` };

export default async function Eip712InspectorPage({ searchParams }: PageProps<"/developers/eip712">) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === "dev") continue;
    if (Array.isArray(value)) value.forEach(item => params.append(key, item));
    else if (value !== undefined) params.set(key, value);
  }
  if (!isSpotDebugMode(params)) notFound();
  redirect(`${ORDER_INSPECTOR_PATH}${params.size ? `?${params}` : ""}`);
}
