"use client";

import type { Supplier } from "@paintdist/shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { createClient } from "@/lib/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

const SUPPLIERS_QUERY_KEY = ["suppliers"] as const;

async function listSuppliers(supabase: ReturnType<typeof createClient>): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, phone, address, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Supplier[];
}

export function useSuppliers() {
  const supabase = useMemo(() => createClient(), []);

  const suppliersQuery = useQuery({
    queryKey: SUPPLIERS_QUERY_KEY,
    queryFn: () => listSuppliers(supabase)
  });

  useRealtimeInvalidate({
    channel: "suppliers-realtime",
    table: "suppliers",
    queryKeys: [SUPPLIERS_QUERY_KEY]
  });

  return suppliersQuery;
}
