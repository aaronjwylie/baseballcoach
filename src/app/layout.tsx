import type { Metadata } from "next";
import { Geist_Mono, Jost } from "next/font/google";
import "./globals.css";
import { env } from "@/shared/config/env";
import { site } from "@/shared/config/site";
import { SiteHeader } from "@/shared/layout/SiteHeader";
import { SiteFooter } from "@/shared/layout/SiteFooter";
import { SiteChrome } from "@/shared/layout/SiteChrome";

/**
 * The wireframe sets its type in a geometric sans — single-storey `a`, tall
 * ascenders, wedge apostrophe. Jost is the closest freely-licensed match.
 * TODO(2026-07-30, Ben): confirm the exact face with Audrey before launch.
 */
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.subhead,
  openGraph: {
    title: `${site.name} — ${site.tagline}`,
    description: site.subhead,
    siteName: site.name,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jost.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <SiteChrome header={<SiteHeader />} footer={<SiteFooter />}>
          <main className="flex-1">{children}</main>
        </SiteChrome>
      </body>
    </html>
  );
}
