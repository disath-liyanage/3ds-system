"use client";

import type { Product } from "@paintdist/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

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
    mutationFn: async (payload: Partial<Product>) => {
      const { data, error } = await supabase.from("products").insert(payload).select("*").single();
      if (error) throw error;
      return data as Product;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY })
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Product> }) => {
      const { data, error } = await supabase.from("products").update(payload).eq("id", id).select("*").single();
      if (error) throw error;
      return data as Product;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY })
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      return id;
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
    updateProduct,
    deleteProduct
  };
}