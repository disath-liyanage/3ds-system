"use client";

import { useQuery } from "@tanstack/react-query";

import { listDailyCollectionReports, type CollectionReportSummary } from "@/app/actions/collections";

export const DAILY_COLLECTION_REPORTS_QUERY_KEY = ["daily-collection-reports"] as const;

export function useDailyCollectionReports(reportDate: string) {
  return useQuery<CollectionReportSummary[]>({
    queryKey: [...DAILY_COLLECTION_REPORTS_QUERY_KEY, reportDate],
    queryFn: async () => {
      const result = await listDailyCollectionReports(reportDate);
      if (!result.success) throw new Error(result.error || "Failed to load reports");
      return result.data ?? [];
    },
    enabled: Boolean(reportDate),
    refetchOnWindowFocus: true,
    refetchOnMount: "always"
  });
}
