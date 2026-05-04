"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { InvoiceRow } from "./useInvoices";

export type InvoiceDetailRow = InvoiceRow & {
  customer_phone: string;
  customer_address: string;
  items: Array<{
    id: string;
    product_id: string;
    product_name: string;
    product_unit: string;
    qty: number;
    unit_price: number;
  }>;
};

export function useInvoice(id: string) {
  const supabase = createClient();

  return useQuery<InvoiceDetailRow | null>({
    queryKey: ["invoice", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("invoices")
        .select(`
          id, invoice_number, order_id, customer_id, issued_by, total_amount, payment_method, status, created_at,
          customer:customers(name, phone, address),
          issuer:users_profile(full_name),
          invoice_items (
            id, product_id, qty, unit_price,
            product:products(name, unit)
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw new Error(error.message);
      if (!data) return null;

      return {
        id: data.id,
        invoice_number: data.invoice_number,
        order_id: data.order_id,
        customer_id: data.customer_id,
        customer_name: data.customer?.name ?? "Unknown Customer",
        customer_phone: data.customer?.phone ?? "",
        customer_address: data.customer?.address ?? "",
        issued_by: data.issued_by,
        issued_by_name: data.issuer?.full_name ?? "Unknown",
        total_amount: Number(data.total_amount),
        payment_method: data.payment_method,
        status: data.status,
        created_at: data.created_at,
        items: (data.invoice_items ?? []).map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          qty: Number(item.qty),
          unit_price: Number(item.unit_price),
          product_name: item.product?.name ?? "Unknown Product",
          product_unit: item.product?.unit ?? ""
        }))
      };
    },
    enabled: Boolean(id)
  });
}
