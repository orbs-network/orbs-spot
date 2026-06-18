import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { Navigation } from "@/components/navigation";

import "@rainbow-me/rainbowkit/styles.css";
import { Toaster } from "@/components/ui/sonner";
import { getActivePartnerConfig } from "@/lib/partners/server";
import { getPartnerStyleVariables } from "@/lib/partners/styles";

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
    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: "/icon.png", type: "image/png" },
      ],
      shortcut: "/favicon.ico",
      apple: "/icon.png",
    },
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
          partnerName={partner.brand.name}
          partnerStyles={partner.styles}
        >
          <Toaster />
          <div className="ef-app-shell flex min-h-screen flex-col font-sans text-foreground">
            <Navigation brand={partner.brand} />
            <div className="flex flex-1 justify-center px-4">
              {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
