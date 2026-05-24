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

export type ProductsParams = {
  page?: number;
  pageSize?: number;
  query?: string;
  statusFilter?: string;
  departmentFilter?: string;
  categoryFilter?: string;
  minPrice?: number;
  maxPrice?: number;
};

export type ProductsPageResult = {
  rows: Product[];
  total: number;
};

async function listProducts(supabase: ReturnType<typeof createClient>): Promise<Product[]> {
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Product[];
}

async function listProductsPage(supabase: ReturnType<typeof createClient>, params: ProductsParams): Promise<ProductsPageResult> {
  const page = Math.max(1, Number(params.page ?? 1));
  const pageSize = Math.max(1, Number(params.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("products")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (params.query) {
    const q = params.query.replace(/[%_]/g, "\\$&");
    query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%,unit.ilike.%${q}%`);
  }
  if (params.departmentFilter && params.departmentFilter !== "all") query = query.ilike("category", `${params.departmentFilter} / %`);
  if (params.categoryFilter && params.categoryFilter !== "all") query = query.ilike("category", `% / ${params.categoryFilter}%`);
  if (typeof params.minPrice === "number" && Number.isFinite(params.minPrice)) query = query.gte("price", params.minPrice);
  if (typeof params.maxPrice === "number" && Number.isFinite(params.maxPrice)) query = query.lte("price", params.maxPrice);

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  let rows = (data ?? []) as Product[];
  if (params.statusFilter && params.statusFilter !== "all") {
    rows = rows.filter((product) => {
      const stock = Number(product.stock_qty ?? 0);
      const threshold = Number(product.low_stock_threshold ?? 0);
      if (params.statusFilter === "in_stock") return stock > threshold;
      if (params.statusFilter === "out_of_stock") return stock <= 0;
      if (params.statusFilter === "low_stock") return stock > 0 && stock <= threshold;
      return true;
    });
  }

  return { rows, total: count ?? 0 };
}

export function useProducts() {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  const productsQuery = useQuery({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: () => listProducts(supabase),
    refetchOnWindowFocus: true,
    refetchOnMount: "always"
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

export function usePaginatedProducts(params: ProductsParams) {
  const supabase = useMemo(() => createClient(), []);
  return useQuery({
    queryKey: [...PRODUCTS_QUERY_KEY, params],
    queryFn: () => listProductsPage(supabase, params),
    refetchOnWindowFocus: true,
    refetchOnMount: "always"
  });
}
