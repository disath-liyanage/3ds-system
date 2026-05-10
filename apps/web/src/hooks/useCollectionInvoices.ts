"use client";

import { useQuery } from "@tanstack/react-query";

import { listCollectionInvoices, type CollectionInvoiceRow } from "@/app/actions/collections";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

export const COLLECTION_INVOICES_QUERY_KEY = ["collection-invoices"] as const;

export function useCollectionInvoices() {
  const query = useQuery<CollectionInvoiceRow[]>({
    queryKey: COLLECTION_INVOICES_QUERY_KEY,
    queryFn: async () => {
      const result = await listCollectionInvoices();
      if (!result.success) throw new Error(result.error || "Failed to load collections");
      return result.data ?? [];
    },
    refetchOnWindowFocus: true,
    refetchOnMount: "always"
  });

  useRealtimeInvalidate({
    channel: "collection-invoices-collections-realtime",
    table: "collections",
    queryKeys: [COLLECTION_INVOICES_QUERY_KEY]
  });

  useRealtimeInvalidate({
    channel: "collection-invoices-invoices-realtime",
    table: "invoices",
    queryKeys: [COLLECTION_INVOICES_QUERY_KEY]
  });

  return query;
}
