"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";

export type ProductReceivedEntry = {
  id: string;
  receive_note_id: string;
  rn_number: number;
  supplier_name: string;
  supplier_invoice_number: string;
  qty: number;
  free_qty: number;
  unit_cost: number;
  selling_price: number;
  created_at: string;
};

export type ProductInvoicedEntry = {
  id: string;
  invoice_id: string;
  invoice_number: number;
  qty: number;
  free_qty: number;
  unit_price: number;
  created_at: string;
};

export type ProductTransactions = {
  received: ProductReceivedEntry[];
  invoiced: ProductInvoicedEntry[];
};

const productTransactionsKey = (productId: string) => ["product-transactions", productId] as const;

async function fetchProductTransactions(
  supabase: ReturnType<typeof createClient>,
  productId: string
): Promise<ProductTransactions> {
  const [{ data: receivedRows, error: receivedError }, { data: invoicedRows, error: invoicedError }] =
    await Promise.all([
      supabase
        .from("receive_note_items")
        .select(
          "id, receive_note_id, qty, free_qty, unit_cost, selling_price, created_at, receive_note:receive_notes(id, rn_number, supplier_name, invoice_number, created_at)"
        )
        .eq("product_id", productId)
        .order("created_at", { ascending: false }),
      supabase
        .from("invoice_items")
        .select("id, invoice_id, qty, free_qty, unit_price, created_at, invoice:invoices(id, invoice_number, created_at)")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
    ]);

  if (receivedError) throw receivedError;
  if (invoicedError) throw invoicedError;

  const received: ProductReceivedEntry[] = (receivedRows ?? []).map((row: any) => {
    const note = Array.isArray(row.receive_note) ? row.receive_note[0] : row.receive_note;
    return {
      id: row.id,
      receive_note_id: row.receive_note_id,
      rn_number: note?.rn_number ?? 0,
      supplier_name: note?.supplier_name ?? "Unknown Supplier",
      supplier_invoice_number: note?.invoice_number ?? "-",
      qty: Number(row.qty) || 0,
      free_qty: Number(row.free_qty) || 0,
      unit_cost: Number(row.unit_cost) || 0,
      selling_price: Number(row.selling_price) || 0,
      created_at: row.created_at ?? note?.created_at ?? ""
    };
  });

  const invoiced: ProductInvoicedEntry[] = (invoicedRows ?? []).map((row: any) => {
    const invoice = Array.isArray(row.invoice) ? row.invoice[0] : row.invoice;
    return {
      id: row.id,
      invoice_id: row.invoice_id,
      invoice_number: invoice?.invoice_number ?? 0,
      qty: Number(row.qty) || 0,
      free_qty: Number(row.free_qty) || 0,
      unit_price: Number(row.unit_price) || 0,
      created_at: row.created_at ?? invoice?.created_at ?? ""
    };
  });

  received.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  invoiced.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return { received, invoiced };
}

export function useProductTransactions(productId?: string) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: productId ? productTransactionsKey(productId) : ["product-transactions", "missing"],
    queryFn: () => fetchProductTransactions(supabase, productId || ""),
    enabled: Boolean(productId)
  });
}

