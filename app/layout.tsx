import type { Metadata } from "next";
import { Suspense } from "react";
import { Toaster } from "sonner";

import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Cargopilot",
  description: "A cargo management system.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon-32x32.png",
    apple: "/apple-icon.png",
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
