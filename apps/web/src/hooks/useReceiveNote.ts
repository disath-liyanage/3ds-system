"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { createClient } from "@/lib/supabase/client";

type ReceiveNoteItemRow = {
  id: string;
  product_id: string;
  qty: number;
  free_qty: number;
  unit_cost: number;
  selling_price: number;
  item_discount_percent: number;
  rep_sales_discount: number;
  rep_collection: number;
};

type ReceiveNoteRow = {
  id: string;
  rn_number: number;
  invoice_number: string;
  supplier_name: string;
  notes: string | null;
  created_at: string;
  receive_note_items: ReceiveNoteItemRow[] | null;
};

const receiveNoteQueryKey = (id: string) => ["receive-note", id] as const;

async function fetchReceiveNote(
  supabase: ReturnType<typeof createClient>,
  id: string
): Promise<ReceiveNoteRow | null> {
  const { data, error } = await supabase
    .from("receive_notes")
    .select(
      "id, rn_number, invoice_number, supplier_name, notes, created_at, receive_note_items(id, product_id, qty, free_qty, unit_cost, selling_price, item_discount_percent, rep_sales_discount, rep_collection)"
    )
    .eq("id", id)
    .maybeSingle<ReceiveNoteRow>();

  if (error) throw error;
  return data ?? null;
}

export function useReceiveNote(id?: string) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: id ? receiveNoteQueryKey(id) : ["receive-note", "missing"],
    queryFn: () => fetchReceiveNote(supabase, id || ""),
    enabled: Boolean(id)
  });
}
