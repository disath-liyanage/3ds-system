"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";

export type ProductMinAvailableByPrice = {
  price: number;
  stock: number;
};

const productMinAvailableByPriceKey = ["product-min-available-by-price"] as const;

function asInvoice(row: any): any {
  if (Array.isArray(row?.invoice)) return row.invoice[0] ?? null;
  return row?.invoice ?? null;
}

async function fetchProductMinAvailableByPrice(
  supabase: ReturnType<typeof createClient>
): Promise<Record<string, ProductMinAvailableByPrice>> {
  const [{ data: receivedRows, error: receivedError }, { data: invoicedRows, error: invoicedError }] = await Promise.all([
    supabase.from("receive_note_items").select("product_id, selling_price, qty, free_qty"),
    supabase.from("invoice_items").select("product_id, unit_price, qty, free_qty, invoice:invoices(status)")
  ]);

  if (receivedError) throw receivedError;
  if (invoicedError) throw invoicedError;

  const byProductAndPrice = new Map<string, number>();

  for (const row of receivedRows ?? []) {
    const productId = String((row as any).product_id || "");
    if (!productId) continue;
    const sellingPrice = Number((row as any).selling_price) || 0;
    const totalReceived = (Number((row as any).qty) || 0) + (Number((row as any).free_qty) || 0);
    const key = `${productId}::${sellingPrice.toFixed(2)}`;
    byProductAndPrice.set(key, (byProductAndPrice.get(key) || 0) + totalReceived);
  }

  for (const row of invoicedRows ?? []) {
    const invoice = asInvoice(row as any);
    const status = String(invoice?.status || "");
    if (status !== "approved" && status !== "issued" && status !== "paid") continue;

    const productId = String((row as any).product_id || "");
    if (!productId) continue;
    const unitPrice = Number((row as any).unit_price) || 0;
    const totalSold = (Number((row as any).qty) || 0) + (Number((row as any).free_qty) || 0);
    const key = `${productId}::${unitPrice.toFixed(2)}`;
    const current = byProductAndPrice.get(key);
    if (current === undefined) continue;
    byProductAndPrice.set(key, Math.max(0, current - totalSold));
  }

  const byProduct = new Map<string, Array<{ price: number; stock: number }>>();

  for (const [key, stock] of byProductAndPrice.entries()) {
    if (stock <= 0) continue;
    const [productId, priceKey] = key.split("::");
    const price = Number(priceKey);
    if (!Number.isFinite(price)) continue;

    const existing = byProduct.get(productId) ?? [];
    existing.push({ price, stock });
    byProduct.set(productId, existing);
  }

  const out: Record<string, ProductMinAvailableByPrice> = {};

  for (const [productId, buckets] of byProduct.entries()) {
    if (buckets.length === 0) continue;
    const minBucket = buckets.reduce((min, bucket) => (bucket.price < min.price ? bucket : min));
    out[productId] = minBucket;
  }

  return out;
}

export function useProductMinAvailableByPrice() {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: productMinAvailableByPriceKey,
    queryFn: () => fetchProductMinAvailableByPrice(supabase),
    refetchOnWindowFocus: true,
    refetchOnMount: "always"
  });
}
