import type { Metadata } from "next";

import "./globals.css";

import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "3D's Distributors (PVT) Ltd.",
  description: "3D's Distributors POS System",
  icons: {
    icon: "/logo.svg"
  }
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