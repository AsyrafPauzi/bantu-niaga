import "./globals.css";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeScript } from "@/components/theme/theme-script";

export const metadata: Metadata = {
  title: {
    default: "NiagaX",
    template: "%s · NiagaX",
  },
  description:
    "The unified AI Business Operating System for Malaysian micro-SMEs.",
  applicationName: "NiagaX",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "NiagaX",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0E7490",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the nonce injected by middleware so inline <script> tags carry the
  // correct nonce for the nonce-based Content-Security-Policy.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Funnel+Sans:wght@400..800&display=swap"
        />
        <ThemeScript nonce={nonce} />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
