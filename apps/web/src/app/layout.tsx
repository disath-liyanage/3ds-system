import type { Metadata } from "next";

import "./globals.css";

import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "PaintDist",
  description: "Paint distribution management platform"
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}