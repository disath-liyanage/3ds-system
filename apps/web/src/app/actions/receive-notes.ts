"use server";

import { revalidatePath } from "next/cache";

import type { UserRole } from "@paintdist/shared";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ActionResult = {
  success: boolean;
  error?: string;
  message?: string;
};

type CustomRolePermissionSummary = {
  perm_manage_receive_notes: boolean;
};

type ProfilePermissionRow = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  custom_role: CustomRolePermissionSummary | CustomRolePermissionSummary[] | null;
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

type NormalizedReceiveNoteItem = {
  product_id: string;
  qty: number;
  free_qty: number;
  product_cost: number;
  selling_price: number;
  item_discount_percent: number;
  rep_sales_discount: number;
  rep_collection: number;
};

type NormalizedReceiveNoteInput = {
  invoice_number: string;
  supplier_name: string;
  notes: string | null;
  items: NormalizedReceiveNoteItem[];
};

async function getCurrentUserProfile() {
  const supabase = createClient();

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Unauthorized" as const };
  }

  const { data: profile } = await adminClient
    .from("users_profile")
    .select("id, email, role, full_name, custom_role:custom_roles(perm_manage_receive_notes)")
    .eq("id", user.id)
    .maybeSingle<ProfilePermissionRow>();

  if (!profile) {
    return { error: "Profile not found" as const };
  }

  return { profile };
}

function canManageReceiveNotes(profile: ProfilePermissionRow): boolean {
  const roleRelation = profile.custom_role;
  const customRole = Array.isArray(roleRelation) ? roleRelation[0] || null : roleRelation;

  return profile.role === "admin" || profile.role === "manager" || Boolean(customRole?.perm_manage_receive_notes);
}

function normalizeReceiveNoteInput(
  input: ReceiveNoteInput
): { data?: NormalizedReceiveNoteInput; error?: string } {
  const invoiceNumber = input.invoice_number.trim();
  const supplierName = input.supplier_name.trim();
  const notes = input.notes?.trim() || null;

  if (!invoiceNumber || !supplierName) {
    return { error: "Invoice number and supplier are required" };
  }

  if (!input.items || input.items.length === 0) {
    return { error: "At least one item is required" };
  }

  const items: NormalizedReceiveNoteItem[] = [];

  for (const [index, item] of input.items.entries()) {
    if (!item.product_id) {
      return { error: `Item ${index + 1} is missing a product` };
    }

    const qty = Number(item.qty);
    const freeQty = Number(item.free_qty ?? 0);
    const productCost = Number(item.product_cost);
    const sellingPrice = Number(item.selling_price);
    const itemDiscountPercent = Number(item.item_discount_percent ?? 0);
    const repSalesDiscount = Number(item.rep_sales_discount ?? 0);
    const repCollection = Number(item.rep_collection ?? 0);

    if (!Number.isFinite(qty) || qty <= 0) {
      return { error: `Item ${index + 1} quantity must be greater than 0` };
    }

    if (
      !Number.isFinite(freeQty) ||
      freeQty < 0 ||
      !Number.isFinite(productCost) ||
      productCost < 0 ||
      !Number.isFinite(sellingPrice) ||
      sellingPrice < 0 ||
      !Number.isFinite(itemDiscountPercent) ||
      itemDiscountPercent < 0 ||
      !Number.isFinite(repSalesDiscount) ||
      repSalesDiscount < 0 ||
      !Number.isFinite(repCollection) ||
      repCollection < 0
    ) {
      return { error: `Item ${index + 1} has invalid numbers` };
    }

    items.push({
      product_id: item.product_id,
      qty,
      free_qty: freeQty,
      product_cost: productCost,
      selling_price: sellingPrice,
      item_discount_percent: itemDiscountPercent,
      rep_sales_discount: repSalesDiscount,
      rep_collection: repCollection
    });
  }

  return {
    data: {
      invoice_number: invoiceNumber,
      supplier_name: supplierName,
      notes,
      items
    }
  };
}

export async function createReceiveNote(input: ReceiveNoteInput): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canManageReceiveNotes(access.profile)) {
    return { success: false, error: "You do not have permission to add GRN" };
  }

  const normalized = normalizeReceiveNoteInput(input);
  if (!normalized.data) {
    return { success: false, error: normalized.error || "Invalid GRN data" };
  }

  const { data: receiveNote, error: receiveNoteError } = await adminClient
    .from("receive_notes")
    .insert({
      invoice_number: normalized.data.invoice_number,
      supplier_name: normalized.data.supplier_name,
      notes: normalized.data.notes,
      received_by: access.profile.id
    })
    .select("id")
    .single();

  if (receiveNoteError || !receiveNote) {
    return { success: false, error: receiveNoteError?.message || "Failed to create GRN" };
  }

  const itemsPayload = normalized.data.items.map((item) => ({
    receive_note_id: receiveNote.id,
    product_id: item.product_id,
    qty: item.qty,
    free_qty: item.free_qty,
    unit_cost: item.product_cost,
    selling_price: item.selling_price,
    item_discount_percent: item.item_discount_percent,
    rep_sales_discount: item.rep_sales_discount,
    rep_collection: item.rep_collection
  }));

  const { error: itemsError } = await adminClient.from("receive_note_items").insert(itemsPayload);

  if (itemsError) {
    await adminClient.from("receive_notes").delete().eq("id", receiveNote.id);
    return { success: false, error: itemsError.message };
  }

  revalidatePath("/receive-notes");
  return { success: true, message: "GRN created successfully" };
}

export async function updateReceiveNote(id: string, input: ReceiveNoteInput): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canManageReceiveNotes(access.profile)) {
    return { success: false, error: "You do not have permission to edit GRN" };
  }

  if (!id) {
    return { success: false, error: "GRN id is required" };
  }

  const normalized = normalizeReceiveNoteInput(input);
  if (!normalized.data) {
    return { success: false, error: normalized.error || "Invalid GRN data" };
  }

  const { data: updated, error: updateError } = await adminClient
    .from("receive_notes")
    .update({
      invoice_number: normalized.data.invoice_number,
      supplier_name: normalized.data.supplier_name,
      notes: normalized.data.notes
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  if (!updated) {
    return { success: false, error: "GRN not found" };
  }

  const { error: deleteError } = await adminClient.from("receive_note_items").delete().eq("receive_note_id", id);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  const itemsPayload = normalized.data.items.map((item) => ({
    receive_note_id: id,
    product_id: item.product_id,
    qty: item.qty,
    free_qty: item.free_qty,
    unit_cost: item.product_cost,
    selling_price: item.selling_price,
    item_discount_percent: item.item_discount_percent,
    rep_sales_discount: item.rep_sales_discount,
    rep_collection: item.rep_collection
  }));

  const { error: itemsError } = await adminClient.from("receive_note_items").insert(itemsPayload);

  if (itemsError) {
    return { success: false, error: itemsError.message };
  }

  revalidatePath("/receive-notes");
  revalidatePath(`/receive-notes/${id}`);
  return { success: true, message: "GRN updated successfully" };
}

export async function deleteReceiveNote(id: string): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canManageReceiveNotes(access.profile)) {
    return { success: false, error: "You do not have permission to delete GRN" };
  }

  if (!id) {
    return { success: false, error: "GRN id is required" };
  }

  const { error } = await adminClient.from("receive_notes").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/receive-notes");
  return { success: true, message: "GRN deleted successfully" };
}
