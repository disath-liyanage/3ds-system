"use client";

import { useQuery } from "@tanstack/react-query";

import { listMyCollectionExpenses, type CollectionExpenseRow } from "@/app/actions/collections";

export const COLLECTION_EXPENSES_QUERY_KEY = ["collection-expenses"] as const;

export function useCollectionExpenses() {
  return useQuery<CollectionExpenseRow[]>({
    queryKey: COLLECTION_EXPENSES_QUERY_KEY,
    queryFn: async () => {
      const result = await listMyCollectionExpenses();
      if (!result.success) throw new Error(result.error || "Failed to load expenses");
      return result.data ?? [];
    },
    refetchOnWindowFocus: true,
    refetchOnMount: "always"
  });
}
