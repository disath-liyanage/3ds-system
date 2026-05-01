"use client";

import type { Product } from "@paintdist/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  createProduct as createProductAction,
  deleteProduct as deleteProductAction,
  type ProductInput,
  updateProduct as updateProductAction
} from "@/app/actions/products";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

const PRODUCTS_QUERY_KEY = ["products"] as const;

async function listProducts(supabase: ReturnType<typeof createClient>): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Product[];
}

export function useProducts() {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  const productsQuery = useQuery({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: () => listProducts(supabase)
  });

  const createProduct = useMutation({
    mutationFn: async (payload: ProductInput) => {
      const result = await createProductAction(payload);

      if (!result.success) {
        throw new Error(result.error || "Failed to create product");
      }

      return result;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY })
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ProductInput }) => {
      const result = await updateProductAction(id, payload);

      if (!result.success) {
        throw new Error(result.error || "Failed to update product");
      }

      return result;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY })
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteProductAction(id);

      if (!result.success) {
        throw new Error(result.error || "Failed to delete product");
      }

      return result;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY })
  });

  useRealtimeInvalidate({
    channel: "products-realtime",
    table: "products",
    queryKeys: [PRODUCTS_QUERY_KEY]
  });

  return {
    ...productsQuery,
    createProduct,
    updateProduct,
    deleteProduct
  };
}
