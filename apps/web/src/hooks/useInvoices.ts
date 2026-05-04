"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

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
  status: string;
  created_at: string;
};

export function useInvoices() {
  const supabase = createClient();

  return useQuery<InvoiceRow[]>({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id, invoice_number, order_id, customer_id, issued_by, total_amount, payment_method, status, created_at, customer:customers(name), issuer:users_profile(full_name)"
        )
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      return (data ?? []).map((row: any) => ({
        id: row.id,
        invoice_number: row.invoice_number,
        order_id: row.order_id,
        customer_id: row.customer_id,
        customer_name: row.customer?.name ?? "Unknown Customer",
        issued_by: row.issued_by,
        issued_by_name: row.issuer?.full_name ?? "Unknown",
        total_amount: Number(row.total_amount),
        payment_method: row.payment_method,
        status: row.status,
        created_at: row.created_at
      }));
    }
  });
}
