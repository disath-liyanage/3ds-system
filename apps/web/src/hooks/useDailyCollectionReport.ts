"use client";

import { useQuery } from "@tanstack/react-query";

import { getDailyCollectionReport, type CollectionReportDetail } from "@/app/actions/collections";

export const DAILY_COLLECTION_REPORT_QUERY_KEY = ["daily-collection-report"] as const;

export function useDailyCollectionReport(reportDate: string) {
  return useQuery<CollectionReportDetail>({
    queryKey: [...DAILY_COLLECTION_REPORT_QUERY_KEY, reportDate],
    queryFn: async () => {
      const result = await getDailyCollectionReport(reportDate);
      if (!result.success) throw new Error(result.error || "Failed to load report");
      if (!result.data) throw new Error("Report not found");
      return result.data;
    },
    enabled: Boolean(reportDate),
    refetchOnWindowFocus: true,
    refetchOnMount: "always"
  });
}
