"use client";

import { useQuery } from "@tanstack/react-query";

import { listCollectionInvoices, type CollectionInvoiceRow } from "@/app/actions/collections";

export const COLLECTION_INVOICES_QUERY_KEY = ["collection-invoices"] as const;

export function useCollectionInvoices() {
  return useQuery<CollectionInvoiceRow[]>({
    queryKey: COLLECTION_INVOICES_QUERY_KEY,
    queryFn: async () => {
      const result = await listCollectionInvoices();
      if (!result.success) throw new Error(result.error || "Failed to load collections");
      return result.data ?? [];
    },
    refetchOnWindowFocus: true,
    refetchOnMount: "always"
  });
}
