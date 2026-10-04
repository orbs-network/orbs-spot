import { notFound } from "next/navigation";
import { hasDeveloperTools } from "@/lib/partners/config";
import { getActivePartnerConfig } from "@/lib/partners/server";

export default function DevelopersLayout({ children }: { children: React.ReactNode }) {
  if (!hasDeveloperTools(getActivePartnerConfig())) notFound();
  return children;
}
