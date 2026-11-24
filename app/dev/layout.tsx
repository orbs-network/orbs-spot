import { getAppConfig } from "@/lib/partners/config";
export const metadata = { title: `Developer playground | ${getAppConfig().brand.name}` };

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  return <div data-developer-playground className="w-full min-w-0">
    {children}
  </div>;
}
