import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { Navigation } from "@/components/navigation";
import "@rainbow-me/rainbowkit/styles.css";
import { Toaster } from "@/components/ui/sonner";
import { getDefaultTheme, getPartnerThemeCss, getThemeStyles } from "@/lib/partners/themes";
import type { PartnerBrand } from "@/lib/partners/types";
import { getAppConfig } from "@/lib/partners/config";
import { isSpotPartnerIdentifier } from "@/lib/partners/spot";
import { SPOT_CHAINS } from "@/lib/consts";

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
  const partner = getAppConfig();
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
  const partner = getAppConfig();

  return {
    themeColor: getThemeStyles(partner.styles, partner.defaultTheme ?? getDefaultTheme(partner.styles)).colors.background,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const partner = getAppConfig();
  const rpcChainIds = process.env.NEXT_PUBLIC_RPC_CHAIN_IDS;
  const missingSetup = [
    ...(!process.env.RPC_URL && !process.env.RPC_URLS ? ["RPC_URLS or RPC_URL"] : []),
    ...(rpcChainIds && !SPOT_CHAINS.some(chain => rpcChainIds.split(",").includes(String(chain.id)))
      ? ["a supported trading network in RPC_URLS"] : []),
    ...(process.env.NEXT_PARTNER && !isSpotPartnerIdentifier(process.env.NEXT_PARTNER)
      ? ["a valid NEXT_PARTNER"] : []),
  ];

  return (
    <html lang="en" data-partner={partner.id} data-layout="reference" data-custom-theme={process.env.APP_PRIMARY_COLOR || process.env.APP_THEME_LIGHT || process.env.APP_THEME_DARK ? "true" : undefined} className={partner.defaultTheme ?? getDefaultTheme(partner.styles)} suppressHydrationWarning>
      <head>
        {partner.styles.fontFamily.includes("Orbs Montserrat") && <link rel="preload" href="/fonts/orbs-montserrat-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />}
        <style dangerouslySetInnerHTML={{ __html: getPartnerThemeCss(partner.styles) }} />
        <script dangerouslySetInnerHTML={{ __html: `try{const t=localStorage.getItem("orbs-color-theme");if(t==="light"||t==="dark")document.documentElement.className=t;}catch{}` }} />
      </head>
      <body className="antialiased">
        {missingSetup.length > 0 ? (
          <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
            <section role="alert" className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm">
              <h1 className="text-xl font-semibold">Application setup incomplete</h1>
              <p className="mt-3 text-sm text-muted-foreground">The site operator needs to configure {missingSetup.join(" and ")} before this app can run.</p>
            </section>
          </main>
        ) : <Providers
          partnerBrand={partner.brand}
          partnerStyles={partner.styles}
        >
          <Toaster />
          <div className="app-shell flex min-h-screen flex-col font-sans text-foreground">
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
        </Providers>}
      </body>
    </html>
  );
}
