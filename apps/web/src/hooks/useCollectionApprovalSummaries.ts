"use client";

import { useQuery } from "@tanstack/react-query";

import {
  listCollectionApprovalSummaries,
  type CollectionApprovalSummary
} from "@/app/actions/collections";

export const COLLECTION_APPROVAL_SUMMARIES_QUERY_KEY = ["collection-approval-summaries"] as const;

export function useCollectionApprovalSummaries() {
  return useQuery<CollectionApprovalSummary[]>({
    queryKey: COLLECTION_APPROVAL_SUMMARIES_QUERY_KEY,
    queryFn: async () => {
      const result = await listCollectionApprovalSummaries();
      if (!result.success) throw new Error(result.error || "Failed to load approvals");
      return result.data ?? [];
    },
    refetchOnWindowFocus: true,
    refetchOnMount: "always"
  });
}
