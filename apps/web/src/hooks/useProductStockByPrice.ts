"use client";

import { useQuery } from "@tanstack/react-query";

import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

export type ProductStockByPrice = {
  selling_price: number;
  unit_cost: number;
  total_qty: number;
  received_qty: number;
  free_qty: number;
  last_received_at: string | null;
};

const productStockByPriceKey = (productId: string) => ["product-stock-by-price", productId] as const;

async function fetchProductStockByPrice(productId: string): Promise<ProductStockByPrice[]> {
  const response = await fetch(`/api/product-stock/by-price?productId=${encodeURIComponent(productId)}`, {
    cache: "no-store",
    credentials: "same-origin"
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || "Failed to load product stock");
  }

  return payload.rows ?? [];
}

export function useProductStockByPrice(productId?: string) {
  const queryKey = productId ? productStockByPriceKey(productId) : ["product-stock-by-price", "missing"] as const;

  useRealtimeInvalidate({
    channel: `product-stock-by-price-receive-notes-${productId || "missing"}`,
    table: "receive_note_items",
    queryKeys: [queryKey]
  });

  useRealtimeInvalidate({
    channel: `product-stock-by-price-invoices-${productId || "missing"}`,
    table: "invoice_items",
    queryKeys: [queryKey]
  });

  return useQuery({
    queryKey,
    queryFn: () => fetchProductStockByPrice(productId || ""),
    enabled: Boolean(productId),
    refetchOnWindowFocus: true,
    refetchOnMount: "always"
  });
}
