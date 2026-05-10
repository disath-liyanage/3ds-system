"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getCollectionApprovalDetail,
  type CollectionApprovalDetail
} from "@/app/actions/collections";

export const COLLECTION_APPROVAL_DETAIL_QUERY_KEY = ["collection-approval-detail"] as const;

export function useCollectionApprovalDetail(salesRepId: string) {
  return useQuery<CollectionApprovalDetail>({
    queryKey: [...COLLECTION_APPROVAL_DETAIL_QUERY_KEY, salesRepId],
    queryFn: async () => {
      const result = await getCollectionApprovalDetail(salesRepId);
      if (!result.success) throw new Error(result.error || "Failed to load approval detail");
      if (!result.data) throw new Error("Approval detail not found");
      return result.data;
    },
    enabled: Boolean(salesRepId),
    refetchOnWindowFocus: true,
    refetchOnMount: "always"
  });
}
