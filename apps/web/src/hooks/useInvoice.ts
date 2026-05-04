"use client";

import { useQuery } from "@tanstack/react-query";

import { getInvoiceDetail, type InvoiceDetailRow } from "@/app/actions/invoices";

export function useInvoice(id: string) {
  return useQuery<InvoiceDetailRow | null>({
    queryKey: ["invoice", id],
    queryFn: async () => {
      if (!id) return null;
      const result = await getInvoiceDetail(id);
      if (!result.success) throw new Error(result.error || "Failed to load invoice");
      return result.data ?? null;
    },
    enabled: Boolean(id)
  });
}
