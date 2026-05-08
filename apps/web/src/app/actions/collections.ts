"use server";

import { revalidatePath } from "next/cache";

import type { UserRole } from "@paintdist/shared";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CollectionInvoiceRow = {
  id: string;
  invoice_number: number;
  customer_id: string;
  customer_name: string;
  sales_rep_id: string | null;
  sales_rep_name: string | null;
  total_amount: number;
  status: "approved" | "issued" | "paid";
  created_at: string;
  due_date: string;
  is_settled: boolean;
  settled_at: string | null;
};

export type RecordCollectionInput = {
  invoice_id: string;
  amount: number;
  notes?: string;
  incentive_recipient_id?: string;
};

type ActionResult = {
  success: boolean;
  error?: string;
  message?: string;
};

type CustomRolePermissionSummary = {
  perm_record_collections: boolean;
  perm_validate_collections: boolean;
};

type ProfilePermissionRow = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  custom_role_id?: string | null;
  custom_role: CustomRolePermissionSummary | CustomRolePermissionSummary[] | null;
};

type InvoiceCollectionRow = {
  id: string;
  invoice_number: number;
  customer_id: string;
  total_amount: number;
  status: "approved" | "issued" | "paid";
  created_at: string;
  is_settled: boolean;
  settled_at: string | null;
  customer: {
    name: string;
    sales_rep_id: string | null;
  } | null;
};

type InvoiceItemRow = {
  id: string;
  product_id: string;
  qty: number;
};

type ReceiveNoteRateRow = {
  product_id: string;
  rep_collection: number;
  created_at: string;
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

  const { data: profile, error: profileError } = await adminClient
    .from("users_profile")
    .select("id, email, role, full_name, custom_role_id")
    .eq("id", user.id)
    .maybeSingle<ProfilePermissionRow>();

  if (profileError || !profile) {
    return { error: profileError?.message || "Profile not found" as const };
  }

  let custom_role: CustomRolePermissionSummary | null = null;
  if (profile.custom_role_id) {
    const { data: roleRow } = await adminClient
      .from("custom_roles")
      .select("perm_record_collections, perm_validate_collections")
      .eq("id", profile.custom_role_id)
      .maybeSingle<CustomRolePermissionSummary>();
    custom_role = roleRow ?? null;
  }

  return { profile: { ...profile, custom_role } };
}

function canRecordCollections(profile: ProfilePermissionRow): boolean {
  const roleRelation = profile.custom_role;
  const customRole = Array.isArray(roleRelation) ? roleRelation[0] || null : roleRelation;

  return (
    profile.role === "admin" ||
    profile.role === "manager" ||
    profile.role === "sales_rep" ||
    Boolean(customRole?.perm_record_collections)
  );
}

function canViewAllCollections(profile: ProfilePermissionRow): boolean {
  return profile.role === "admin" || profile.role === "manager" || profile.role === "cashier";
}

function buildDueDate(issuedAt: string): string {
  const issued = new Date(issuedAt);
  const due = new Date(issued);
  due.setDate(due.getDate() + 45);
  return due.toISOString();
}

export async function listCollectionInvoices(): Promise<{ success: boolean; data?: CollectionInvoiceRow[]; error?: string }> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canRecordCollections(access.profile)) {
    return { success: false, error: "You do not have permission to view collections" };
  }

  const { data, error } = await adminClient
    .from("invoices")
    .select(
      "id, invoice_number, customer_id, total_amount, status, created_at, is_settled, settled_at, customer:customers(name, sales_rep_id)"
    )
    .in("status", ["approved", "issued", "paid"])
    .order("created_at", { ascending: false })
    .returns<InvoiceCollectionRow[]>();

  if (error) return { success: false, error: error.message };

  let rows = (data ?? []).map((row) => ({
    id: row.id,
    invoice_number: row.invoice_number,
    customer_id: row.customer_id,
    customer_name: row.customer?.name ?? "Unknown Customer",
    sales_rep_id: row.customer?.sales_rep_id ?? null,
    sales_rep_name: null,
    total_amount: Number(row.total_amount),
    status: row.status,
    created_at: row.created_at,
    due_date: buildDueDate(row.created_at),
    is_settled: Boolean(row.is_settled),
    settled_at: row.settled_at ?? null
  }));

  if (!canViewAllCollections(access.profile)) {
    rows = rows.filter((row) => {
      if (row.sales_rep_id === access.profile.id) return true;
      return !row.is_settled && !row.sales_rep_id;
    });
  }

  const repIds = Array.from(new Set(rows.map((row) => row.sales_rep_id).filter(Boolean))) as string[];
  if (repIds.length > 0) {
    const { data: reps } = await adminClient
      .from("users_profile")
      .select("id, full_name")
      .in("id", repIds);

    const repMap = new Map((reps ?? []).map((rep) => [rep.id, rep.full_name]));
    rows = rows.map((row) => ({
      ...row,
      sales_rep_name: row.sales_rep_id ? repMap.get(row.sales_rep_id) ?? "Unknown" : null
    }));
  }

  return { success: true, data: rows };
}

function pickLatestRates(rows: ReceiveNoteRateRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!map.has(row.product_id)) {
      map.set(row.product_id, Number(row.rep_collection) || 0);
    }
  }
  return map;
}

export async function recordCollection(input: RecordCollectionInput): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canRecordCollections(access.profile)) {
    return { success: false, error: "You do not have permission to record collections" };
  }

  if (!input.invoice_id) {
    return { success: false, error: "Invoice is required" };
  }

  const { data: invoice, error: invoiceError } = await adminClient
    .from("invoices")
    .select(
      "id, invoice_number, customer_id, total_amount, status, is_settled, customer:customers(name, balance, sales_rep_id), invoice_items(id, product_id, qty)"
    )
    .eq("id", input.invoice_id)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return { success: false, error: invoiceError?.message || "Invoice not found" };
  }

  if (invoice.is_settled) {
    return { success: false, error: "Invoice is already settled" };
  }

  if (!["approved", "issued", "paid"].includes(invoice.status)) {
    return { success: false, error: "Only approved or issued invoices can be settled" };
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Amount must be greater than 0" };
  }

  const totalAmount = Number(invoice.total_amount);
  if (Math.abs(amount - totalAmount) > 0.01) {
    return { success: false, error: "Amount must match the invoice total" };
  }

  const customer = Array.isArray(invoice.customer) ? invoice.customer[0] : invoice.customer;
  const invoiceItems = (invoice.invoice_items ?? []) as InvoiceItemRow[];

  const defaultRecipientId = customer?.sales_rep_id ?? null;
  const incentiveRecipientId =
    access.profile.role === "sales_rep"
      ? access.profile.id
      : input.incentive_recipient_id || defaultRecipientId;

  if (!incentiveRecipientId) {
    return { success: false, error: "Please select a sales rep for the incentive" };
  }

  const { data: collection, error: collectionError } = await adminClient
    .from("collections")
    .insert({
      invoice_id: invoice.id,
      customer_id: invoice.customer_id,
      collected_by: access.profile.id,
      sales_rep_id: incentiveRecipientId,
      amount,
      notes: input.notes?.trim() || null
    })
    .select("id")
    .single();

  if (collectionError || !collection) {
    return { success: false, error: collectionError?.message || "Failed to record collection" };
  }

  let incentiveTotal = 0;
  if (invoiceItems.length > 0) {
    const productIds = Array.from(new Set(invoiceItems.map((item) => item.product_id)));
    const { data: rateRows, error: rateError } = await adminClient
      .from("receive_note_items")
      .select("product_id, rep_collection, created_at")
      .in("product_id", productIds)
      .order("created_at", { ascending: false })
      .returns<ReceiveNoteRateRow[]>();

    if (rateError) {
      return { success: false, error: rateError.message };
    }

    const rateMap = pickLatestRates(rateRows ?? []);
    const incentives = invoiceItems.map((item) => {
      const rate = rateMap.get(item.product_id) ?? 0;
      const qty = Number(item.qty) || 0;
      const amount = qty * rate;
      incentiveTotal += amount;

      return {
        collection_id: collection.id,
        sales_rep_id: incentiveRecipientId,
        invoice_id: invoice.id,
        invoice_item_id: item.id,
        product_id: item.product_id,
        qty,
        rate,
        amount
      };
    });

    if (incentives.length > 0) {
      const { error: incentivesError } = await adminClient.from("collection_incentives").insert(incentives);
      if (incentivesError) {
        return { success: false, error: incentivesError.message };
      }
    }
  }

  await adminClient
    .from("collections")
    .update({ incentive_total: incentiveTotal })
    .eq("id", collection.id);

  await adminClient
    .from("invoices")
    .update({
      is_settled: true,
      settled_at: new Date().toISOString(),
      settled_by: access.profile.id,
      status: "paid"
    })
    .eq("id", invoice.id);

  if (customer?.balance != null) {
    const nextBalance = Math.max(0, Number(customer.balance) - amount);
    await adminClient.from("customers").update({ balance: nextBalance }).eq("id", invoice.customer_id);
  }

  revalidatePath("/collections");
  revalidatePath("/invoices");
  revalidatePath("/customers");

  return { success: true, message: "Collection recorded and invoice settled." };
}
