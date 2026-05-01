"use client";

import type { Order } from "@paintdist/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { createClient } from "@/lib/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

const ORDERS_QUERY_KEY = ["orders"] as const;

async function listOrders(supabase: ReturnType<typeof createClient>): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Order[];
}

export function useOrders() {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  const ordersQuery = useQuery({
    queryKey: ORDERS_QUERY_KEY,
    queryFn: () => listOrders(supabase)
  });

  const createOrder = useMutation({
    mutationFn: async (payload: Partial<Order>) => {
      const { data, error } = await supabase.from("orders").insert(payload).select("*").single();
      if (error) throw error;
      return data as Order;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY })
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Order> }) => {
      const { data, error } = await supabase.from("orders").update(payload).eq("id", id).select("*").single();
      if (error) throw error;
      return data as Order;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY })
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY })
  });

  useRealtimeInvalidate({
    channel: "orders-realtime",
    table: "orders",
    queryKeys: [ORDERS_QUERY_KEY]
  });

  return {
    ...ordersQuery,
    createOrder,
    updateOrder,
    deleteOrder
  };
}
