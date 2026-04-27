"use client";

import type { Product } from "@paintdist/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import {
  createProduct as createProductAction,
  type ProductInput,
  updateProduct as updateProductAction
} from "@/app/actions/products";
import { createClient } from "@/lib/supabase/client";

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

  useEffect(() => {
    const channel = supabase
      .channel("products-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, supabase]);

  return {
    ...productsQuery,
    createProduct,
    updateProduct
  };
}
