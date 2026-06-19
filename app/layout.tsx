import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { Navigation } from "@/components/navigation";

import "@rainbow-me/rainbowkit/styles.css";
import { Toaster } from "@/components/ui/sonner";
import { getActivePartnerConfig } from "@/lib/partners/server";
import { getPartnerStyleVariables } from "@/lib/partners/styles";
import type { PartnerBrand } from "@/lib/partners/types";

function getIconType(url: string) {
  const pathname = url.split("?")[0]?.toLowerCase() ?? "";

  if (pathname.endsWith(".svg")) return "image/svg+xml";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".ico")) return "image/x-icon";

  return undefined;
}

function getPartnerIcons(brand: PartnerBrand): Metadata["icons"] {
  const iconUrl = brand.iconSrc ?? "/favicon.ico";
  const appleIconUrl = brand.appleIconSrc ?? brand.iconSrc ?? "/icon.png";
  const iconType = getIconType(iconUrl);

  return {
    icon: [
      {
        url: iconUrl,
        ...(iconType ? { type: iconType } : {}),
      },
    ],
    shortcut: iconUrl,
    apple: appleIconUrl,
  };
}

export function generateMetadata(): Metadata {
  const partner = getActivePartnerConfig();
  const { metadata, name } = partner.brand;

  return {
    title: metadata.title,
    description: metadata.description,
    applicationName: name,
    openGraph: {
      title: metadata.title,
      description: metadata.description,
      url: metadata.url,
      siteName: name,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: metadata.title,
      description: metadata.description,
    },
    icons: getPartnerIcons(partner.brand),
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const partner = getActivePartnerConfig();

  return (
    <html lang="en" data-partner={partner.id}>
      <body
        className="antialiased dark"
        style={getPartnerStyleVariables(partner.styles)}
      >
        <Providers
          partnerBrand={partner.brand}
          partnerStyles={partner.styles}
        >
          <Toaster />
          <div className="ef-app-shell flex min-h-screen flex-col font-sans text-foreground">
            <Navigation brand={partner.brand} />
            <div className="flex flex-1 justify-center px-4 pt-[112px] sm:pt-[72px]">
              {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
