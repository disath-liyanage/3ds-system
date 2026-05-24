"use client";

import type { ReceiveNote } from "@paintdist/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { deleteReceiveNote as deleteReceiveNoteAction } from "@/app/actions/receive-notes";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

const RECEIVE_NOTES_QUERY_KEY = ["receive-notes"] as const;
const DEFAULT_PAGE_SIZE = 50;

type ListReceiveNotesParams = {
  page?: number;
  pageSize?: number;
  query?: string;
  grnFrom?: number;
  grnTo?: number;
  amountFrom?: number;
  amountTo?: number;
  fromDate?: string;
  toDate?: string;
};

type ReceiveNotesPageResult = {
  rows: ReceiveNote[];
  total: number;
};

async function listReceiveNotes(
  supabase: ReturnType<typeof createClient>,
  params: ListReceiveNotesParams
): Promise<ReceiveNotesPageResult> {
  const page = Math.max(1, Number(params.page ?? 1));
  const pageSize = Math.max(1, Number(params.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("receive_notes")
    .select("id, rn_number, invoice_number, supplier_name, notes, created_at, receive_note_items(qty, unit_cost)", {
      count: "exact"
    })
    .order("created_at", { ascending: false });

  if (params.query) {
    const q = params.query.replace(/[%_]/g, "\\$&");
    query = query.or(`supplier_name.ilike.%${q}%,invoice_number.ilike.%${q}%,rn_number.ilike.%${q}%`);
  }
  if (typeof params.grnFrom === "number" && Number.isFinite(params.grnFrom)) query = query.gte("rn_number", params.grnFrom);
  if (typeof params.grnTo === "number" && Number.isFinite(params.grnTo)) query = query.lte("rn_number", params.grnTo);
  if (params.fromDate) query = query.gte("created_at", params.fromDate);
  if (params.toDate) query = query.lte("created_at", params.toDate);

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  let rows = (data ?? []) as ReceiveNote[];
  if (typeof params.amountFrom === "number" || typeof params.amountTo === "number") {
    rows = rows.filter((row) => {
      const total = (row.receive_note_items ?? []).reduce(
        (sum, item) => sum + Number(item.qty ?? 0) * Number(item.unit_cost ?? 0),
        0
      );
      if (typeof params.amountFrom === "number" && total < params.amountFrom) return false;
      if (typeof params.amountTo === "number" && total > params.amountTo) return false;
      return true;
    });
  }

  return { rows, total: count ?? 0 };
}

export function useReceiveNotes(params: ListReceiveNotesParams) {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  const receiveNotesQuery = useQuery({
    queryKey: [...RECEIVE_NOTES_QUERY_KEY, params],
    queryFn: () => listReceiveNotes(supabase, params)
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
