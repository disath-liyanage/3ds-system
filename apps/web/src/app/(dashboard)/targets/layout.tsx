import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Targets"
};

export default function TargetsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
