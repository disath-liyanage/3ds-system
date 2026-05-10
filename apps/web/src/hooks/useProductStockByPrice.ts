"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";

export type ProductStockByPrice = {
  selling_price: number;
  unit_cost: number;
  total_qty: number;
  received_qty: number;
  free_qty: number;
  last_received_at: string | null;
};

const productStockByPriceKey = (productId: string) => ["product-stock-by-price", productId] as const;

async function fetchProductStockByPrice(
  supabase: ReturnType<typeof createClient>,
  productId: string
): Promise<ProductStockByPrice[]> {
  const [{ data, error }, { data: invoicedRows, error: invoicedError }] = await Promise.all([
    supabase
      .from("receive_note_items")
      .select("selling_price, unit_cost, qty, free_qty, created_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoice_items")
      .select("unit_price, qty, free_qty, invoice:invoices(status)")
      .eq("product_id", productId)
  ]);

  if (error) throw error;
  if (invoicedError) throw invoicedError;

  const totals = new Map<number, ProductStockByPrice>();

  for (const row of data ?? []) {
    const sellingPrice = Number(row.selling_price) || 0;
    const unitCost = Number(row.unit_cost) || 0;
    const qty = Number(row.qty) || 0;
    const freeQty = Number(row.free_qty) || 0;
    const totalQty = qty + freeQty;
    const existing = totals.get(sellingPrice);

    if (existing) {
      existing.received_qty += qty;
      existing.free_qty += freeQty;
      existing.total_qty += totalQty;
      // keep the highest unit_cost just to be safe
      if (unitCost > existing.unit_cost) {
        existing.unit_cost = unitCost;
      }
      if (!existing.last_received_at || (row.created_at && row.created_at > existing.last_received_at)) {
        existing.last_received_at = row.created_at ?? null;
      }
    } else {
      totals.set(sellingPrice, {
        selling_price: sellingPrice,
        unit_cost: unitCost,
        received_qty: qty,
        free_qty: freeQty,
        total_qty: totalQty,
        last_received_at: row.created_at ?? null
      });
    }
  }

  for (const row of invoicedRows ?? []) {
    const invoice = Array.isArray((row as any).invoice) ? (row as any).invoice[0] : (row as any).invoice;
    const status = String(invoice?.status || "");
    if (status !== "approved" && status !== "issued" && status !== "paid") continue;

    const sellingPrice = Number((row as any).unit_price) || 0;
    const qty = Number((row as any).qty) || 0;
    const freeQty = Number((row as any).free_qty) || 0;
    const soldQty = qty + freeQty;
    const existing = totals.get(sellingPrice);
    if (!existing) continue;
    existing.total_qty = Math.max(0, existing.total_qty - soldQty);
  }

  return Array.from(totals.values()).sort((a, b) => a.selling_price - b.selling_price);
}

export function useProductStockByPrice(productId?: string) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: productId ? productStockByPriceKey(productId) : ["product-stock-by-price", "missing"],
    queryFn: () => fetchProductStockByPrice(supabase, productId || ""),
    enabled: Boolean(productId)
  });
}
