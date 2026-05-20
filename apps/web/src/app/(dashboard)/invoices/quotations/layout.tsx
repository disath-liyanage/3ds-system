import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quotations"
};

export default function QuotationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
