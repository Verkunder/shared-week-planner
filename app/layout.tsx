import type { Metadata, Viewport } from "next";

import { ServiceWorkerUpdater } from "@/components/service-worker-updater";
import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Планер",
  title: {
    default: "Общий планер недели",
    template: "%s — Общий планер недели",
  },
  description: "Совместный недельный планировщик команды.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Планер",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/pwa-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning className="font-mono">
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <ServiceWorkerUpdater />
        </ThemeProvider>
      </body>
    </html>
  );
}
