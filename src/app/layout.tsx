import type { Metadata, Viewport } from "next";
import { Nunito, Sora } from "next/font/google";
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

const siteUrl = "https://roundacats.vercel.app";
const title = "Beans";
const description =
  "Draft four. Bank beans. Roll for more. A party game for 2–10 friends.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "Beans",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  appleWebApp: {
    capable: true,
    title: "Beans",
    statusBarStyle: "default",
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
        alt: "Beans — a cheeky coral bean. Draft four. Bank beans.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F5F0E7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${nunito.variable} ${sora.variable} h-full`}>
      <body className="min-h-full font-[family-name:var(--font-body)] antialiased">
        {children}
      </body>
    </html>
  );
}
