import type { Metadata } from "next";
import { Suspense } from "react";
import { Toaster } from "sonner";

import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import Providers from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "CargoPilot",
    template: "%s | CargoPilot",
  },
  description: "CargoPilot logistics ERP software.",
  applicationName: "CargoPilot",
  icons: {
    icon: [
      { url: "/cargopilot-logo-transparent.png", type: "image/png" },
    ],
    shortcut: "/cargopilot-logo-transparent.png",
    apple: "/cargopilot-logo-transparent.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://api.mapbox.com" crossOrigin="" />
        <link rel="preconnect" href="https://events.mapbox.com" crossOrigin="" />
      </head>
      <body suppressHydrationWarning>
        <Suspense fallback={null}>
          <Providers>{children}</Providers>
        </Suspense>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
