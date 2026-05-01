"use client";

import type { Collection } from "@paintdist/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { createClient } from "@/lib/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

const COLLECTIONS_QUERY_KEY = ["collections"] as const;

async function listCollections(supabase: ReturnType<typeof createClient>): Promise<Collection[]> {
  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Collection[];
}

export function useCollections() {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  const collectionsQuery = useQuery({
    queryKey: COLLECTIONS_QUERY_KEY,
    queryFn: () => listCollections(supabase)
  });

  const createCollection = useMutation({
    mutationFn: async (payload: Partial<Collection>) => {
      const { data, error } = await supabase.from("collections").insert(payload).select("*").single();
      if (error) throw error;
      return data as Collection;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY })
  });

  const updateCollection = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Collection> }) => {
      const { data, error } = await supabase
        .from("collections")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as Collection;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY })
  });

  const deleteCollection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collections").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY })
  });

  useRealtimeInvalidate({
    channel: "collections-realtime",
    table: "collections",
    queryKeys: [COLLECTIONS_QUERY_KEY]
  });

  return {
    ...collectionsQuery,
    createCollection,
    updateCollection,
    deleteCollection
  };
}
