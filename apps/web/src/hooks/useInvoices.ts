"use client";

import { useQuery } from "@tanstack/react-query";

import { listInvoices, type InvoiceListRow, type ListInvoicesParams } from "@/app/actions/invoices";

export type InvoiceRow = InvoiceListRow;
export type InvoicesPageResult = { rows: InvoiceRow[]; total: number };

export const INVOICES_QUERY_KEY = ["invoices"];

export function useInvoices(params: ListInvoicesParams) {
  return useQuery<InvoicesPageResult>({
    queryKey: [...INVOICES_QUERY_KEY, params],
    queryFn: async () => {
      const result = await listInvoices(params);
      if (!result.success) throw new Error(result.error || "Failed to load invoices");
      return { rows: result.data ?? [], total: result.total ?? 0 };
    },
    refetchOnWindowFocus: true,
    refetchOnMount: "always"
  });
}
