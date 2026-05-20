import type { Metadata } from "next";

import { getReportItem } from "../../reports-data";

export function generateMetadata({
  params
}: {
  params: { section: string; report: string };
}): Metadata {
  const report = getReportItem(params.section, params.report);

  return {
    title: report?.title ?? "Reports"
  };
}

export default function ReportDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
