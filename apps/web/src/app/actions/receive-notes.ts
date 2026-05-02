"use server";

import { revalidatePath } from "next/cache";

type ActionResult = {
  success: boolean;
  error?: string;
};

export type ReceiveNoteInput = {
  invoice_number: string;
  supplier_name: string;
  notes: string;
  items: Array<{
    product_id: string;
    qty: number;
    free_qty: number;
    product_cost: number;
    selling_price: number;
    item_discount_percent: number;
    rep_sales_discount: number;
    rep_collection: number;
  }>;
};

export async function createReceiveNote(input: ReceiveNoteInput): Promise<ActionResult> {
  if (!input.invoice_number.trim() || !input.supplier_name.trim()) {
    return { success: false, error: "Invoice number and supplier are required" };
  }

  if (!input.items || input.items.length === 0) {
    return { success: false, error: "At least one item is required" };
  }

  revalidatePath("/receive-notes");
  return { success: true };
}
