"use client";

import type { ReceiveNote } from "@paintdist/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { deleteReceiveNote as deleteReceiveNoteAction } from "@/app/actions/receive-notes";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

const RECEIVE_NOTES_QUERY_KEY = ["receive-notes"] as const;

async function listReceiveNotes(supabase: ReturnType<typeof createClient>): Promise<ReceiveNote[]> {
  const { data, error } = await supabase
    .from("receive_notes")
    .select("id, rn_number, invoice_number, supplier_name, notes, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ReceiveNote[];
}

export function useReceiveNotes() {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  const receiveNotesQuery = useQuery({
    queryKey: RECEIVE_NOTES_QUERY_KEY,
    queryFn: () => listReceiveNotes(supabase)
  });

  const deleteReceiveNote = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteReceiveNoteAction(id);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete GRN");
      }
      return result;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RECEIVE_NOTES_QUERY_KEY })
  });

  useRealtimeInvalidate({
    channel: "receive-notes-realtime",
    table: "receive_notes",
    queryKeys: [RECEIVE_NOTES_QUERY_KEY]
  });

  return {
    ...receiveNotesQuery,
    deleteReceiveNote
  };
}
