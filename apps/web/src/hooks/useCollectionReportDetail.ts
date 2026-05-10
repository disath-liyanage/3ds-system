"use client";

import { useQuery } from "@tanstack/react-query";

import { getCollectionReportDetail, type CollectionReportDetail } from "@/app/actions/collections";

export const COLLECTION_REPORT_DETAIL_QUERY_KEY = ["collection-report-detail"] as const;

export function useCollectionReportDetail(reportId: string) {
  return useQuery<CollectionReportDetail>({
    queryKey: [...COLLECTION_REPORT_DETAIL_QUERY_KEY, reportId],
    queryFn: async () => {
      const result = await getCollectionReportDetail(reportId);
      if (!result.success) throw new Error(result.error || "Failed to load report");
      if (!result.data) throw new Error("Report not found");
      return result.data;
    },
    enabled: Boolean(reportId),
    refetchOnWindowFocus: true,
    refetchOnMount: "always"
  });
}
