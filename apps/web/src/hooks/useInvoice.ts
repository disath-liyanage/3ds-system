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

      const invoiceData = data as any;

      return {
        id: invoiceData.id,
        invoice_number: invoiceData.invoice_number,
        order_id: invoiceData.order_id,
        customer_id: invoiceData.customer_id,
        customer_name: invoiceData.customer?.name ?? "Unknown Customer",
        customer_phone: invoiceData.customer?.phone ?? "",
        customer_address: invoiceData.customer?.address ?? "",
        issued_by: invoiceData.issued_by,
        issued_by_name: invoiceData.issuer?.full_name ?? "Unknown",
        total_amount: Number(invoiceData.total_amount),
        payment_method: invoiceData.payment_method,
        status: invoiceData.status,
        created_at: invoiceData.created_at,
        items: (invoiceData.invoice_items ?? []).map((item: any) => ({
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
