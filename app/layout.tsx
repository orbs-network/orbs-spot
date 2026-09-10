import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { Navigation } from "@/components/navigation";

import "@rainbow-me/rainbowkit/styles.css";
import { Toaster } from "@/components/ui/sonner";
import { getActivePartnerConfig } from "@/lib/partners/server";
import { getDefaultTheme, getPartnerThemeCss } from "@/lib/partners/themes";
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

export function generateViewport(): Viewport {
  const partner = getActivePartnerConfig();

  return {
    themeColor: partner.styles.colors.background,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const partner = getActivePartnerConfig();

  return (
    <html lang="en" data-partner={partner.id} className={getDefaultTheme(partner.styles)} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: getPartnerThemeCss(partner.styles) }} />
        <script dangerouslySetInnerHTML={{ __html: `try{const t=localStorage.getItem("orbs-color-theme");if(t==="light"||t==="dark")document.documentElement.className=t;}catch{}` }} />
      </head>
      <body className="antialiased">
        <Providers
          partnerBrand={partner.brand}
          partnerStyles={partner.styles}
        >
          <Toaster />
          <div className="ef-app-shell flex min-h-screen flex-col font-sans text-foreground">
            <a
              href="#main-content"
              className="fixed left-4 top-4 z-[100] -translate-y-20 rounded-lg bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-lg transition-transform focus-visible:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Skip to main content
            </a>
            <Navigation brand={partner.brand} />
            <main
              id="main-content"
              className="flex flex-1 justify-center px-4 pt-[60px] sm:pt-[72px]"
            >
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
