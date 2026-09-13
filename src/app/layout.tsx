import type { Metadata, Viewport } from "next";
import { Nunito, Sora } from "next/font/google";
import { NoPullToRefresh } from "@/components/NoPullToRefresh";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

/** Canonical production host (`roundacats.vercel.app` still aliases). */
const siteUrl = "https://beans-game.vercel.app";
const title = "Beans";
const description =
  "Draft four. Bank beans. — Party game with snake draft and synchronized dice.";

/** Cream/ivory — must match `--bg` / status-bar theme so iOS clock area isn’t white. */
const CREAM = "#F5F0E7";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s · Beans",
  },
  description,
  applicationName: "Beans",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  appleWebApp: {
    capable: true,
    title: "Beans",
    // Draw under the status bar so cream html/body fill the clock/notch area.
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title,
    description,
    siteName: "Beans",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Beans — dog with Beans sunglasses",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-image.png"],
  },
  other: {
    "apple-mobile-web-app-title": "Beans",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: CREAM },
    { media: "(prefers-color-scheme: dark)", color: CREAM },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${nunito.variable} ${sora.variable} h-full`}>
      <body className="h-full font-[family-name:var(--font-body)] antialiased">
        <NoPullToRefresh />
        {children}
      </body>
    </html>
  );
}
