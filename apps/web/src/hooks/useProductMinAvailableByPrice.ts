"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";

export type ProductMinAvailableByPrice = {
  price: number;
  stock: number;
};

const productMinAvailableByPriceKey = ["product-min-available-by-price"] as const;

function getSummedValue(row: any, primaryKey: string, fallbackKey: string): number {
  const primary = Number(row?.[primaryKey]);
  if (Number.isFinite(primary)) return primary;
  const fallback = Number(row?.[fallbackKey]);
  if (Number.isFinite(fallback)) return fallback;
  return 0;
}

function buildMinAvailableMap(receivedRows: any[] | null | undefined, invoicedRows: any[] | null | undefined) {
  const byProductAndPrice = new Map<string, number>();

  for (const row of receivedRows ?? []) {
    const productId = String((row as any).product_id || "");
    if (!productId) continue;
    const sellingPrice = Number((row as any).selling_price) || 0;
    const totalReceived =
      getSummedValue(row, "total_qty", "qty") + getSummedValue(row, "total_free_qty", "free_qty");
    const key = `${productId}::${sellingPrice.toFixed(2)}`;
    byProductAndPrice.set(key, (byProductAndPrice.get(key) || 0) + totalReceived);
  }

  for (const row of invoicedRows ?? []) {
    const productId = String((row as any).product_id || "");
    if (!productId) continue;
    const unitPrice = Number((row as any).unit_price) || 0;
    const totalSold =
      getSummedValue(row, "total_qty", "qty") + getSummedValue(row, "total_free_qty", "free_qty");
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

async function fetchProductMinAvailableByPrice(
  supabase: ReturnType<typeof createClient>
): Promise<Record<string, ProductMinAvailableByPrice>> {
  const aggregated = await Promise.all([
    supabase.from("receive_note_items").select("product_id, selling_price, total_qty:qty.sum(), total_free_qty:free_qty.sum()"),
    supabase
      .from("invoice_items")
      .select("product_id, unit_price, total_qty:qty.sum(), total_free_qty:free_qty.sum(), invoice:invoices!inner(status)")
      .in("invoice.status", ["approved", "issued", "paid"])
  ]);

  const [receivedAgg, invoicedAgg] = aggregated;
  if (!receivedAgg.error && !invoicedAgg.error) {
    return buildMinAvailableMap(receivedAgg.data as any[], invoicedAgg.data as any[]);
  }

  const [{ data: receivedRows, error: receivedError }, { data: invoicedRows, error: invoicedError }] = await Promise.all([
    supabase.from("receive_note_items").select("product_id, selling_price, qty, free_qty"),
    supabase
      .from("invoice_items")
      .select("product_id, unit_price, qty, free_qty, invoice:invoices!inner(status)")
      .in("invoice.status", ["approved", "issued", "paid"])
  ]);

  if (receivedError) throw receivedError;
  if (invoicedError) throw invoicedError;

  return buildMinAvailableMap(receivedRows as any[], invoicedRows as any[]);
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
