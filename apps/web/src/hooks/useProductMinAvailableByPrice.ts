"use client";

import { useQuery } from "@tanstack/react-query";

import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

export type ProductMinAvailableByPrice = {
  price: number;
  stock: number;
  hasGrnEntry: boolean;
};

const productMinAvailableByPriceKey = ["product-min-available-by-price"] as const;

async function fetchProductMinAvailableByPrice(): Promise<Record<string, ProductMinAvailableByPrice>> {
  const response = await fetch("/api/product-stock/min-available", {
    cache: "no-store",
    credentials: "same-origin"
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || "Failed to load product stock");
  }

  return payload.products ?? {};
}

export function useProductMinAvailableByPrice() {
  useRealtimeInvalidate({
    channel: "product-min-available-receive-notes",
    table: "receive_note_items",
    queryKeys: [productMinAvailableByPriceKey]
  });

  useRealtimeInvalidate({
    channel: "product-min-available-invoices",
    table: "invoice_items",
    queryKeys: [productMinAvailableByPriceKey]
  });

  return useQuery({
    queryKey: productMinAvailableByPriceKey,
    queryFn: fetchProductMinAvailableByPrice,
    refetchOnWindowFocus: true,
    refetchOnMount: "always"
  });
}
