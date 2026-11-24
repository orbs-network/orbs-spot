import { getAppConfig } from "@/lib/partners/config";
import { Eip712Inspector } from "@developer-inspector";

export const metadata = { title: `Order preview | ${getAppConfig().brand.name}` };

export default function DeveloperOrderInspectorPage() {
  return <Eip712Inspector />;
}
