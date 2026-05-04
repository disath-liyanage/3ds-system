"use client";

import { useQuery } from "@tanstack/react-query";

import { listInvoices, type InvoiceListRow } from "@/app/actions/invoices";

export type InvoiceRow = InvoiceListRow;

export const INVOICES_QUERY_KEY = ["invoices"];

export function useInvoices() {
  return useQuery<InvoiceRow[]>({
    queryKey: INVOICES_QUERY_KEY,
    queryFn: async () => {
      const result = await listInvoices();
      if (!result.success) throw new Error(result.error || "Failed to load invoices");
      return result.data ?? [];
    },
    refetchOnWindowFocus: true,
    refetchOnMount: "always"
  });
}
