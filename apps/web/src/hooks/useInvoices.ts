"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

export type InvoiceRow = {
  id: string;
  invoice_number: number;
  order_id: string | null;
  customer_id: string;
  customer_name: string;
  issued_by: string;
  issued_by_name: string;
  total_amount: number;
  payment_method: string;
  status: "draft" | "issued" | "paid";
  created_at: string;
};

export const INVOICES_QUERY_KEY = ["invoices"];

export function useInvoices() {
  const supabase = createClient();

  useRealtimeInvalidate({
    channel: "invoices-realtime",
    table: "invoices",
    queryKeys: [INVOICES_QUERY_KEY]
  });

  return useQuery<InvoiceRow[]>({
    queryKey: INVOICES_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id, invoice_number, order_id, customer_id, issued_by, total_amount, payment_method, status, created_at, customer:customers(name), issuer:users_profile(full_name)"
        )
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      return (data ?? []).map((row: any) => {
        const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
        const issuer = Array.isArray(row.issuer) ? row.issuer[0] : row.issuer;

        return {
          id: row.id,
          invoice_number: row.invoice_number,
          order_id: row.order_id,
          customer_id: row.customer_id,
          customer_name: customer?.name ?? "Unknown Customer",
          issued_by: row.issued_by,
          issued_by_name: issuer?.full_name ?? "Unknown",
          total_amount: Number(row.total_amount),
          payment_method: row.payment_method,
          status: row.status,
          created_at: row.created_at
        };
      });
    },
    refetchOnWindowFocus: true,
    refetchOnMount: "always"
  });
}
