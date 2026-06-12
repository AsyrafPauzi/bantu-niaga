import "./globals.css";
import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeScript } from "@/components/theme/theme-script";

export const metadata: Metadata = {
  title: {
    default: "Bantu Niaga",
    template: "%s · Bantu Niaga",
  },
  description:
    "The unified AI Business Operating System for Malaysian micro-SMEs.",
  applicationName: "Bantu Niaga",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Bantu Niaga",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1D4ED8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
