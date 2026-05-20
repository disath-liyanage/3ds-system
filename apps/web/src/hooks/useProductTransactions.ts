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
  quotation_number?: number | null;
  invoice_kind?: "invoice" | "quotation";
  qty: number;
  free_qty: number;
  unit_price: number;
  created_at: string;
  source_type?: "cancelled" | "returned";
  return_number?: number;
  return_invoice_id?: string;
};

export type ProductTransactions = {
  received: ProductReceivedEntry[];
  invoiced: ProductInvoicedEntry[];
  cancelled: ProductInvoicedEntry[];
  stockAdjustments: Array<{
    id: string;
    created_at: string;
    stock_before: number;
    stock_after: number;
    changed_by: string;
  }>;
};

const productTransactionsKey = (productId: string, monthKey: string) =>
  ["product-transactions", productId, monthKey] as const;

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthRange(monthKey?: string) {
  const now = new Date();
  const fallbackKey = toMonthKey(now);
  const [yearText, monthText] = (monthKey || fallbackKey).split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    return { monthKey: fallbackKey, start, end };
  }
  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);
  return { monthKey: `${yearText}-${monthText.padStart(2, "0")}`, start, end };
}

async function fetchProductTransactions(
  supabase: ReturnType<typeof createClient>,
  productId: string,
  range: { start: Date; end: Date }
): Promise<ProductTransactions> {
  const rangeStart = range.start.toISOString();
  const rangeEnd = range.end.toISOString();
  const [
    { data: receivedRows, error: receivedError },
    { data: invoicedRows, error: invoicedError },
    { data: cancelledRows, error: cancelledError },
    { data: returnedRows, error: returnedError },
    { data: stockAdjustmentRows, error: stockAdjustmentError }
  ] =
    await Promise.all([
      supabase
        .from("receive_note_items")
        .select(
          "id, receive_note_id, qty, free_qty, unit_cost, selling_price, created_at, receive_note:receive_notes(id, rn_number, supplier_name, invoice_number, created_at)"
        )
        .eq("product_id", productId)
        .gte("created_at", rangeStart)
        .lt("created_at", rangeEnd)
        .order("created_at", { ascending: false }),
      supabase
        .from("invoice_items")
        .select(
          "id, invoice_id, qty, free_qty, unit_price, created_at, invoice:invoices(id, invoice_number, quotation_number, invoice_kind, created_at)"
        )
        .eq("product_id", productId)
        .gte("created_at", rangeStart)
        .lt("created_at", rangeEnd)
        .order("created_at", { ascending: false }),
      supabase
        .from("audit_log")
        .select("id, created_at, old_data, new_data")
        .eq("table_name", "invoice_cancellations")
        .eq("record_id", productId)
        .gte("created_at", rangeStart)
        .lt("created_at", rangeEnd)
        .order("created_at", { ascending: false }),
      supabase
        .from("return_invoice_items")
        .select(
          "id, qty, unit_price, created_at, return_invoice:return_invoices(id, return_number, invoice_id, created_at, source_invoice:invoices!return_invoices_invoice_id_fkey(invoice_number))"
        )
        .eq("product_id", productId)
        .gte("created_at", rangeStart)
        .lt("created_at", rangeEnd)
        .order("created_at", { ascending: false }),
      supabase
        .from("audit_log")
        .select("id, created_at, old_data, new_data")
        .eq("table_name", "product_stock_adjustments")
        .eq("record_id", productId)
        .gte("created_at", rangeStart)
        .lt("created_at", rangeEnd)
        .order("created_at", { ascending: false })
    ]);

  if (receivedError) throw receivedError;
  if (invoicedError) throw invoicedError;
  if (cancelledError) throw cancelledError;
  if (returnedError) throw returnedError;
  if (stockAdjustmentError) throw stockAdjustmentError;

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
      quotation_number: invoice?.quotation_number ?? null,
      invoice_kind: invoice?.invoice_kind === "quotation" ? "quotation" : "invoice",
      qty: Number(row.qty) || 0,
      free_qty: Number(row.free_qty) || 0,
      unit_price: Number(row.unit_price) || 0,
      created_at: row.created_at ?? invoice?.created_at ?? ""
    };
  });

  const cancelledFromInvoiceCancellation: ProductInvoicedEntry[] = (cancelledRows ?? []).map((row: any) => ({
    id: row.id,
    invoice_id: String(row.old_data?.invoice_id || ""),
    invoice_number: Number(row.old_data?.invoice_number) || 0,
    qty: Number(row.old_data?.qty) || 0,
    free_qty: Number(row.old_data?.free_qty) || 0,
    unit_price: 0,
    created_at: row.created_at ?? "",
    source_type: "cancelled"
  }));

  const returned: ProductInvoicedEntry[] = (returnedRows ?? []).map((row: any) => {
    const returnInvoice = Array.isArray(row.return_invoice) ? row.return_invoice[0] : row.return_invoice;
    const sourceInvoice = Array.isArray(returnInvoice?.source_invoice)
      ? returnInvoice?.source_invoice?.[0]
      : returnInvoice?.source_invoice;

    return {
      id: row.id,
      invoice_id: String(returnInvoice?.invoice_id || ""),
      invoice_number: Number(sourceInvoice?.invoice_number) || 0,
      qty: Number(row.qty) || 0,
      free_qty: 0,
      unit_price: Number(row.unit_price) || 0,
      created_at: row.created_at ?? returnInvoice?.created_at ?? "",
      source_type: "returned",
      return_number: Number(returnInvoice?.return_number) || 0,
      return_invoice_id: String(returnInvoice?.id || "")
    };
  });

  const cancelled: ProductInvoicedEntry[] = [...cancelledFromInvoiceCancellation, ...returned];

  const stockAdjustments = (stockAdjustmentRows ?? []).map((row: any) => ({
    id: row.id,
    created_at: row.created_at ?? "",
    stock_before: Number(row.old_data?.stock_qty) || 0,
    stock_after: Number(row.new_data?.stock_qty) || 0,
    changed_by: row.new_data?.changed_by || "Manual edit"
  }));

  received.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  invoiced.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  cancelled.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  stockAdjustments.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return { received, invoiced, cancelled, stockAdjustments };
}

export function useProductTransactions(productId?: string, monthKey?: string) {
  const supabase = useMemo(() => createClient(), []);
  const { monthKey: resolvedMonthKey, start, end } = useMemo(() => getMonthRange(monthKey), [monthKey]);

  return useQuery({
    queryKey: productId ? productTransactionsKey(productId, resolvedMonthKey) : ["product-transactions", "missing"],
    queryFn: () => fetchProductTransactions(supabase, productId || "", { start, end }),
    enabled: Boolean(productId)
  });
}
