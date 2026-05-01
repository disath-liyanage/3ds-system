"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { createClient } from "@/lib/supabase/client";

type UseRealtimeInvalidateArgs = {
  channel: string;
  table: string;
  queryKeys: readonly (readonly unknown[])[];
};

export function useRealtimeInvalidate({ channel, table, queryKeys }: UseRealtimeInvalidateArgs) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  useEffect(() => {
    const realtimeChannel: RealtimeChannel = supabase
      .channel(channel)
      .on("postgres_changes", { event: "*", schema: "public", table }, async () => {
        await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(realtimeChannel);
    };
  }, [channel, queryClient, queryKeys, supabase, table]);
}
