"use client";

import { useQuery } from "@tanstack/react-query";

import { listQuotations, type InvoiceListRow } from "@/app/actions/invoices";

export type QuotationRow = InvoiceListRow;

export const QUOTATIONS_QUERY_KEY = ["quotations"];

export function useQuotations(enabled = true) {
  return useQuery<QuotationRow[]>({
    queryKey: QUOTATIONS_QUERY_KEY,
    queryFn: async () => {
      const result = await listQuotations();
      if (!result.success) throw new Error(result.error || "Failed to load quotations");
      return result.data ?? [];
    },
    enabled,
    refetchOnWindowFocus: true,
    refetchOnMount: "always"
  });
}
