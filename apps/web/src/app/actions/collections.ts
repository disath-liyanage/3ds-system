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
  collected_total: number;
  remaining_amount: number;
  is_partially_settled: boolean;
  payment_status: "unpaid" | "partially_paid" | "paid";
  last_recorded_by_name: string | null;
  status: "approved" | "issued" | "paid";
  created_at: string;
  due_date: string;
  is_settled: boolean;
  settled_at: string | null;
  last_collection_at: string | null;
};

export type RecordCollectionInput = {
  invoice_id: string;
  amount: number;
  payment_type?: "cash" | "cheque";
  cheque_deposit_date?: string;
  notes?: string;
  incentive_recipient_id?: string;
};

export type CollectionExpenseStatus = "pending" | "approved" | "rejected";

export type CollectionExpenseRow = {
  id: string;
  sales_rep_id: string;
  title: string;
  category: string;
  amount: number;
  notes: string | null;
  status: CollectionExpenseStatus;
  created_at: string;
};

export type CollectionApprovalSummary = {
  sales_rep_id: string;
  sales_rep_name: string;
  pending_collections_total: number;
  pending_expenses_total: number;
  cash_in_hand: number;
};

export type PendingCollectionRow = {
  id: string;
  invoice_number: number | null;
  customer_name: string;
  amount: number;
  notes: string | null;
  created_at: string;
};

export type CollectionApprovalDetail = {
  sales_rep_id: string;
  sales_rep_name: string;
  collections: PendingCollectionRow[];
  expenses: CollectionExpenseRow[];
  totals: {
    collections_total: number;
    expenses_total: number;
    cash_in_hand: number;
  };
};

export type InvoiceCollectionHistoryRow = {
  id: string;
  collection_number: number;
  amount: number;
  payment_type: "cash" | "cheque";
  cheque_deposit_date: string | null;
  status: "pending" | "validated" | "rejected";
  notes: string | null;
  created_at: string;
  collected_by_id: string;
  collected_by_name: string | null;
  sales_rep_name: string | null;
  validated_by_name: string | null;
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

type CollectionApprovalSalesRepRow = {
  id: string;
  full_name: string;
};

type PendingCollectionQueryRow = {
  id: string;
  amount: number;
  notes: string | null;
  created_at: string;
  invoice: { invoice_number: number | null } | null;
  customer: { name: string } | null;
};

type PendingCollectionApprovalRow = {
  id: string;
  amount: number;
  invoice_id: string | null;
  customer_id: string;
  invoice: {
    id: string;
    total_amount: number;
    customer_id: string;
    customer: { balance: number | null } | null;
  } | null;
};

type PendingExpenseAmountRow = {
  sales_rep_id: string;
  amount: number;
};

type InvoiceCollectionHistoryQueryRow = {
  id: string;
  collection_number: number;
  amount: number;
  payment_type: "cash" | "cheque" | null;
  cheque_deposit_date: string | null;
  status: "pending" | "validated" | "rejected";
  notes: string | null;
  created_at: string;
  collected_by: string;
  collected_by_user: { full_name: string | null } | { full_name: string | null }[] | null;
  sales_rep_user: { full_name: string | null } | { full_name: string | null }[] | null;
  validated_by_user: { full_name: string | null } | { full_name: string | null }[] | null;
};

type CollectionByIdQueryRow = {
  id: string;
  invoice_id: string | null;
  collection_number: number;
  collected_by: string;
  invoice: { invoice_number: number | null } | null;
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

function canManageCollectionApprovals(profile: ProfilePermissionRow): boolean {
  const roleRelation = profile.custom_role;
  const customRole = Array.isArray(roleRelation) ? roleRelation[0] || null : roleRelation;

  return (
    profile.role === "admin" ||
    profile.role === "manager" ||
    profile.role === "cashier" ||
    Boolean(customRole?.perm_validate_collections)
  );
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

  let rows: CollectionInvoiceRow[] = (data ?? []).map((row) => ({
    id: row.id,
    invoice_number: row.invoice_number,
    customer_id: row.customer_id,
    customer_name: row.customer?.name ?? "Unknown Customer",
    sales_rep_id: row.customer?.sales_rep_id ?? null,
    sales_rep_name: null,
    total_amount: Number(row.total_amount),
    collected_total: 0,
    remaining_amount: Number(row.total_amount),
    is_partially_settled: false,
    payment_status: row.is_settled ? "paid" : "unpaid",
    last_recorded_by_name: null,
    status: row.status,
    created_at: row.created_at,
    due_date: buildDueDate(row.created_at),
    is_settled: Boolean(row.is_settled),
    settled_at: row.settled_at ?? null
    ,
    last_collection_at: null
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

  const invoiceIds = rows.map((row) => row.id);
  if (invoiceIds.length > 0) {
    const { data: collectionRows, error: collectionError } = await adminClient
      .from("collections")
      .select("invoice_id, amount, status, collected_by, created_at")
      .in("invoice_id", invoiceIds)
      .in("status", ["pending", "validated"]);

    if (collectionError) return { success: false, error: collectionError.message };

    const recordedTotals = new Map<string, number>();
    const latestByInvoice = new Map<
      string,
      { collected_by: string | null; created_at: string }
    >();
    const collectorIds = new Set<string>();

    for (const row of collectionRows ?? []) {
      const typedRow = row as {
        invoice_id: string;
        amount: number;
        status: "pending" | "validated";
        collected_by: string | null;
        created_at: string;
      };
      const invoiceId = typedRow.invoice_id;

      const amount = Number(typedRow.amount);
      recordedTotals.set(invoiceId, (recordedTotals.get(invoiceId) ?? 0) + amount);

      const prevLatest = latestByInvoice.get(invoiceId);
      if (!prevLatest || new Date(typedRow.created_at).getTime() > new Date(prevLatest.created_at).getTime()) {
        latestByInvoice.set(invoiceId, {
          collected_by: typedRow.collected_by,
          created_at: typedRow.created_at
        });
      }

      if (typedRow.collected_by) collectorIds.add(typedRow.collected_by);
    }

    const collectorMap = new Map<string, string>();
    if (collectorIds.size > 0) {
      const { data: collectors } = await adminClient
        .from("users_profile")
        .select("id, full_name")
        .in("id", Array.from(collectorIds));

      for (const collector of collectors ?? []) {
        collectorMap.set(collector.id, collector.full_name);
      }
    }

    rows = rows.map((row) => {
      const collectedTotal = recordedTotals.get(row.id) ?? 0;
      const remainingAmount = Math.max(0, row.total_amount - collectedTotal);
      const isPartiallySettled = collectedTotal > 0 && remainingAmount > 0;
      const paymentStatus: CollectionInvoiceRow["payment_status"] =
        remainingAmount <= 0 ? "paid" : isPartiallySettled ? "partially_paid" : "unpaid";
      const latestEntry = latestByInvoice.get(row.id);
      const lastRecordedByName =
        latestEntry?.collected_by ? (collectorMap.get(latestEntry.collected_by) ?? "Unknown") : null;

      return {
        ...row,
        collected_total: collectedTotal,
        remaining_amount: remainingAmount,
        is_partially_settled: isPartiallySettled,
        payment_status: paymentStatus,
        last_recorded_by_name: lastRecordedByName,
        last_collection_at: latestEntry?.created_at ?? null
      };
    });
  }

  return { success: true, data: rows };
}

export async function getInvoiceCollectionHistory(
  invoiceId: string
): Promise<{ success: boolean; data?: InvoiceCollectionHistoryRow[]; error?: string }> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canRecordCollections(access.profile) && !canManageCollectionApprovals(access.profile)) {
    return { success: false, error: "You do not have permission to view collection history" };
  }

  if (!invoiceId) {
    return { success: false, error: "Invoice id is required" };
  }

  const { data, error } = await adminClient
    .from("collections")
    .select(
      "id, collection_number, amount, payment_type, cheque_deposit_date, status, notes, created_at, collected_by, collected_by_user:users_profile!collections_collected_by_fkey(full_name), sales_rep_user:users_profile!collections_sales_rep_id_fkey(full_name), validated_by_user:users_profile!collections_validated_by_fkey(full_name)"
    )
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false })
    .returns<InvoiceCollectionHistoryQueryRow[]>();

  if (error) return { success: false, error: error.message };

  const rows = (data ?? []).map((row) => {
    const collectedBy = Array.isArray(row.collected_by_user) ? row.collected_by_user[0] : row.collected_by_user;
    const salesRep = Array.isArray(row.sales_rep_user) ? row.sales_rep_user[0] : row.sales_rep_user;
    const validatedBy = Array.isArray(row.validated_by_user) ? row.validated_by_user[0] : row.validated_by_user;

    return {
      id: row.id,
      collection_number: Number(row.collection_number),
      amount: Number(row.amount),
      payment_type: row.payment_type === "cheque" ? "cheque" : "cash",
      cheque_deposit_date: row.cheque_deposit_date ?? null,
      status: row.status,
      notes: row.notes ?? null,
      created_at: row.created_at,
      collected_by_id: row.collected_by,
      collected_by_name: collectedBy?.full_name ?? null,
      sales_rep_name: salesRep?.full_name ?? null,
      validated_by_name: validatedBy?.full_name ?? null
    } satisfies InvoiceCollectionHistoryRow;
  });

  return { success: true, data: rows };
}

export async function getCollectionContextById(
  collectionId: string
): Promise<{ success: boolean; data?: { invoice_id: string; invoice_number: number | null; collection_id: string }; error?: string }> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canRecordCollections(access.profile) && !canManageCollectionApprovals(access.profile)) {
    return { success: false, error: "You do not have permission to view collection details" };
  }

  if (!collectionId) {
    return { success: false, error: "Collection id is required" };
  }

  const { data, error } = await adminClient
    .from("collections")
    .select("id, invoice_id, collection_number, collected_by, invoice:invoices(invoice_number)")
    .eq("id", collectionId)
    .maybeSingle<CollectionByIdQueryRow>();

  if (error || !data) {
    return { success: false, error: error?.message || "Collection not found" };
  }

  if (!canViewAllCollections(access.profile) && data.collected_by !== access.profile.id) {
    return { success: false, error: "You do not have permission to view this collection" };
  }

  if (!data.invoice_id) {
    return { success: false, error: "Collection is not linked to an invoice" };
  }

  return {
    success: true,
    data: {
      collection_id: data.id,
      invoice_id: data.invoice_id,
      invoice_number: data.invoice?.invoice_number ?? null
    }
  };
}

export async function updateCollectionEntry(input: {
  collection_id: string;
  amount: number;
  payment_type: "cash" | "cheque";
  cheque_deposit_date?: string;
  notes?: string;
}): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!input.collection_id) return { success: false, error: "Collection id is required" };
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "Amount must be greater than 0" };

  const paymentType = input.payment_type === "cheque" ? "cheque" : "cash";
  const chequeDepositDate =
    paymentType === "cheque" ? (input.cheque_deposit_date ? new Date(input.cheque_deposit_date) : null) : null;
  if (paymentType === "cheque" && (!chequeDepositDate || Number.isNaN(chequeDepositDate.getTime()))) {
    return { success: false, error: "Cheque deposit date is required" };
  }

  const { data: collection, error: collectionError } = await adminClient
    .from("collections")
    .select("id, collected_by, status")
    .eq("id", input.collection_id)
    .maybeSingle<{ id: string; collected_by: string; status: "pending" | "validated" | "rejected" }>();

  if (collectionError || !collection) {
    return { success: false, error: collectionError?.message || "Collection not found" };
  }

  const isManagerOrAdmin = access.profile.role === "admin" || access.profile.role === "manager";
  const isOwnerPending =
    access.profile.role === "sales_rep" && collection.collected_by === access.profile.id && collection.status === "pending";
  if (!isManagerOrAdmin && !isOwnerPending) {
    return { success: false, error: "You do not have permission to edit this collection" };
  }

  const { error: updateError } = await adminClient
    .from("collections")
    .update({
      amount,
      payment_type: paymentType,
      cheque_deposit_date: chequeDepositDate ? chequeDepositDate.toISOString() : null,
      notes: input.notes?.trim() || null
    })
    .eq("id", input.collection_id);

  if (updateError) return { success: false, error: updateError.message };

  revalidatePath("/collections");
  revalidatePath("/collections/approvals");

  return { success: true, message: "Collection updated" };
}

export async function deleteCollectionEntry(collectionId: string): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!collectionId) return { success: false, error: "Collection id is required" };

  const { data: collection, error: collectionError } = await adminClient
    .from("collections")
    .select("id, collection_number, amount, created_at, status, collected_by, customer:customers(name)")
    .eq("id", collectionId)
    .maybeSingle<{
      id: string;
      collection_number: number;
      amount: number;
      created_at: string;
      collected_by: string;
      status: "pending" | "validated" | "rejected";
      customer: { name: string } | { name: string }[] | null;
    }>();

  if (collectionError || !collection) {
    return { success: false, error: collectionError?.message || "Collection not found" };
  }

  const isManagerOrAdmin = access.profile.role === "admin" || access.profile.role === "manager";
  const isOwnerPending =
    access.profile.role === "sales_rep" && collection.collected_by === access.profile.id && collection.status === "pending";
  if (!isManagerOrAdmin && !isOwnerPending) {
    return { success: false, error: "You do not have permission to delete this collection" };
  }

  const customerRelation = collection.customer;
  const customer = Array.isArray(customerRelation) ? customerRelation[0] : customerRelation;

  await adminClient.from("audit_log").insert({
    table_name: "collections",
    record_id: collectionId,
    action: "delete",
    performed_by: access.profile.id,
    old_data: {
      collection_number: collection.collection_number,
      amount: collection.amount,
      created_at: collection.created_at,
      status: collection.status,
      customer_name: customer?.name ?? "Unknown"
    }
  });

  const { error: deleteError } = await adminClient.from("collections").delete().eq("id", collectionId);
  if (deleteError) return { success: false, error: deleteError.message };

  revalidatePath("/collections");
  revalidatePath("/collections/approvals");

  return { success: true, message: "Collection deleted" };
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

  const paymentType = input.payment_type === "cheque" ? "cheque" : "cash";
  const chequeDepositDate =
    paymentType === "cheque" ? (input.cheque_deposit_date ? new Date(input.cheque_deposit_date) : null) : null;
  if (paymentType === "cheque") {
    if (!chequeDepositDate || Number.isNaN(chequeDepositDate.getTime())) {
      return { success: false, error: "Cheque deposit date is required" };
    }
  }

  const totalAmount = Number(invoice.total_amount);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return { success: false, error: "Invoice total is invalid" };
  }

  const customer = Array.isArray(invoice.customer) ? invoice.customer[0] : invoice.customer;
  const invoiceItems = (invoice.invoice_items ?? []) as InvoiceItemRow[];
  const isAutoValidated = access.profile.role === "admin" || access.profile.role === "manager";

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
      payment_type: paymentType,
      cheque_deposit_date: chequeDepositDate ? chequeDepositDate.toISOString() : null,
      status: isAutoValidated ? "validated" : "pending",
      validated_by: isAutoValidated ? access.profile.id : null,
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

  if (isAutoValidated) {
    const { data: validatedRows, error: validatedError } = await adminClient
      .from("collections")
      .select("amount")
      .eq("invoice_id", invoice.id)
      .eq("status", "validated");

    if (validatedError) {
      return { success: false, error: validatedError.message };
    }

    const validatedTotal = (validatedRows ?? []).reduce(
      (sum, row) => sum + Number((row as { amount: number }).amount),
      0
    );

    if (validatedTotal + 0.01 >= totalAmount) {
      const { error: invoiceUpdateError } = await adminClient
        .from("invoices")
        .update({
          is_settled: true,
          settled_at: new Date().toISOString(),
          settled_by: access.profile.id,
          status: "paid"
        })
        .eq("id", invoice.id);

      if (invoiceUpdateError) {
        return { success: false, error: invoiceUpdateError.message };
      }
    }

    if (customer?.balance != null) {
      const nextBalance = Math.max(0, Number(customer.balance) - amount);
      const { error: customerUpdateError } = await adminClient
        .from("customers")
        .update({ balance: nextBalance })
        .eq("id", invoice.customer_id);

      if (customerUpdateError) {
        return { success: false, error: customerUpdateError.message };
      }
    }
  }

  if (paymentType === "cheque" && chequeDepositDate) {
    const { data: managers, error: managerError } = await adminClient
      .from("users_profile")
      .select("id")
      .in("role", ["admin", "manager"]);

    if (managerError) {
      return { success: false, error: managerError.message };
    }

    const customerName = customer?.name ?? "Unknown customer";

    if (managers && managers.length > 0) {
      const depositDateLabel = chequeDepositDate.toLocaleDateString("en-CA");
      const notifications = managers.map((manager) => ({
        recipient_id: manager.id,
        title: "Cheque deposit reminder",
        message: `Cheque collection for invoice #${invoice.invoice_number} (${customerName ?? "Unknown customer"}) is due for deposit on ${depositDateLabel}.`,
        type: "cheque_deposit_reminder",
        invoice_id: invoice.id,
        created_by: access.profile.id,
        created_at: chequeDepositDate.toISOString()
      }));

      const { error: notificationError } = await adminClient.from("notifications").insert(notifications);
      if (notificationError) {
        return { success: false, error: notificationError.message };
      }
    }
  }

  revalidatePath("/collections");
  revalidatePath("/collections/approvals");
  revalidatePath("/notifications");

  return {
    success: true,
    message: isAutoValidated ? "Collection recorded and validated." : "Collection recorded and pending approval."
  };
}

async function fetchPendingCollections(salesRepId: string): Promise<PendingCollectionRow[]> {
  const { data, error } = await adminClient
    .from("collections")
    .select("id, amount, notes, created_at, invoice:invoices(invoice_number), customer:customers(name)")
    .eq("collected_by", salesRepId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .returns<PendingCollectionQueryRow[]>();

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    invoice_number: row.invoice?.invoice_number ?? null,
    customer_name: row.customer?.name ?? "Unknown",
    amount: Number(row.amount),
    notes: row.notes ?? null,
    created_at: row.created_at
  }));
}

async function fetchPendingExpenses(salesRepId: string): Promise<CollectionExpenseRow[]> {
  const { data, error } = await adminClient
    .from("collection_expenses")
    .select("id, sales_rep_id, title, category, amount, notes, status, created_at")
    .eq("sales_rep_id", salesRepId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .returns<CollectionExpenseRow[]>();

  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    amount: Number(row.amount)
  }));
}

export async function listMyCollectionExpenses(): Promise<{
  success: boolean;
  data?: CollectionExpenseRow[];
  error?: string;
}> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canRecordCollections(access.profile)) {
    return { success: false, error: "You do not have permission to view expenses" };
  }

  const { data, error } = await adminClient
    .from("collection_expenses")
    .select("id, sales_rep_id, title, category, amount, notes, status, created_at")
    .eq("sales_rep_id", access.profile.id)
    .order("created_at", { ascending: false })
    .returns<CollectionExpenseRow[]>();

  if (error) return { success: false, error: error.message };

  const rows = (data ?? []).map((row) => ({
    ...row,
    amount: Number(row.amount)
  }));

  return { success: true, data: rows };
}

export async function addCollectionExpense(input: {
  category: string;
  amount: number;
  notes?: string;
}): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canRecordCollections(access.profile)) {
    return { success: false, error: "You do not have permission to add expenses" };
  }

  const allowedCategories = ["Fuel", "Food", "Parking", "Other"] as const;
  if (!allowedCategories.includes(input.category as (typeof allowedCategories)[number])) {
    return { success: false, error: "Category must be Fuel, Food, Parking, or Other" };
  }

  const notes = input.notes?.trim() || "";
  if (input.category === "Other" && !notes) {
    return { success: false, error: "Notes are required for Other category" };
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Amount must be greater than 0" };
  }

  const { error } = await adminClient.from("collection_expenses").insert({
    sales_rep_id: access.profile.id,
    title: input.category,
    category: input.category,
    amount,
    notes: notes || null
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/collections/expenses");
  revalidatePath("/collections/approvals");

  return { success: true, message: "Expense added" };
}

export async function listCollectionApprovalSummaries(): Promise<{
  success: boolean;
  data?: CollectionApprovalSummary[];
  error?: string;
}> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canManageCollectionApprovals(access.profile)) {
    return { success: false, error: "You do not have permission to view approvals" };
  }

  const { data: reps, error: repsError } = await adminClient
    .from("users_profile")
    .select("id, full_name")
    .eq("role", "sales_rep")
    .order("full_name", { ascending: true })
    .returns<CollectionApprovalSalesRepRow[]>();

  if (repsError) return { success: false, error: repsError.message };

  const repRows = reps ?? [];
  if (repRows.length === 0) return { success: true, data: [] };

  const repIds = repRows.map((rep) => rep.id);

  const { data: collectionRows, error: collectionsError } = await adminClient
    .from("collections")
    .select("collected_by, amount")
    .in("collected_by", repIds)
    .eq("status", "pending");

  if (collectionsError) return { success: false, error: collectionsError.message };

  const { data: expenseRows, error: expenseError } = await adminClient
    .from("collection_expenses")
    .select("sales_rep_id, amount")
    .in("sales_rep_id", repIds)
    .eq("status", "pending")
    .returns<PendingExpenseAmountRow[]>();

  if (expenseError) return { success: false, error: expenseError.message };

  const collectionTotals = new Map<string, number>();
  for (const row of collectionRows ?? []) {
    const repId = (row as { collected_by: string }).collected_by;
    const amount = Number((row as { amount: number }).amount);
    collectionTotals.set(repId, (collectionTotals.get(repId) ?? 0) + amount);
  }

  const expenseTotals = new Map<string, number>();
  for (const row of expenseRows ?? []) {
    expenseTotals.set(row.sales_rep_id, (expenseTotals.get(row.sales_rep_id) ?? 0) + Number(row.amount));
  }

  const summaries = repRows.map((rep) => {
    const collectionsTotal = collectionTotals.get(rep.id) ?? 0;
    const expensesTotal = expenseTotals.get(rep.id) ?? 0;
    return {
      sales_rep_id: rep.id,
      sales_rep_name: rep.full_name,
      pending_collections_total: collectionsTotal,
      pending_expenses_total: expensesTotal,
      cash_in_hand: collectionsTotal - expensesTotal
    };
  });

  return { success: true, data: summaries };
}

export async function getCollectionApprovalDetail(
  salesRepId: string
): Promise<{ success: boolean; data?: CollectionApprovalDetail; error?: string }> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canManageCollectionApprovals(access.profile)) {
    return { success: false, error: "You do not have permission to view approvals" };
  }

  if (!salesRepId) return { success: false, error: "Sales rep is required" };

  const { data: rep, error: repError } = await adminClient
    .from("users_profile")
    .select("id, full_name")
    .eq("id", salesRepId)
    .maybeSingle<CollectionApprovalSalesRepRow>();

  if (repError || !rep) {
    return { success: false, error: repError?.message || "Sales rep not found" };
  }

  const collections = await fetchPendingCollections(salesRepId);
  const expenses = await fetchPendingExpenses(salesRepId);

  const collectionsTotal = collections.reduce((sum, row) => sum + row.amount, 0);
  const expensesTotal = expenses.reduce((sum, row) => sum + row.amount, 0);

  return {
    success: true,
    data: {
      sales_rep_id: rep.id,
      sales_rep_name: rep.full_name,
      collections,
      expenses,
      totals: {
        collections_total: collectionsTotal,
        expenses_total: expensesTotal,
        cash_in_hand: collectionsTotal - expensesTotal
      }
    }
  };
}

export async function approveCollectionRep(salesRepId: string): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canManageCollectionApprovals(access.profile)) {
    return { success: false, error: "You do not have permission to approve collections" };
  }

  if (!salesRepId) return { success: false, error: "Sales rep is required" };

  const { data: pendingCollections, error: collectionsError } = await adminClient
    .from("collections")
    .select(
      "id, amount, invoice_id, customer_id, invoice:invoices(id, total_amount, customer_id, customer:customers(balance))"
    )
    .eq("collected_by", salesRepId)
    .eq("status", "pending")
    .returns<PendingCollectionApprovalRow[]>();

  if (collectionsError) return { success: false, error: collectionsError.message };

  const { error: collectionsUpdateError } = await adminClient
    .from("collections")
    .update({
      status: "validated",
      validated_by: access.profile.id
    })
    .eq("collected_by", salesRepId)
    .eq("status", "pending");

  if (collectionsUpdateError) return { success: false, error: collectionsUpdateError.message };

  const invoiceIds = Array.from(
    new Set((pendingCollections ?? []).map((row) => row.invoice_id).filter(Boolean))
  ) as string[];

  const validatedTotals = new Map<string, number>();
  if (invoiceIds.length > 0) {
    const { data: validatedRows, error: validatedError } = await adminClient
      .from("collections")
      .select("invoice_id, amount")
      .in("invoice_id", invoiceIds)
      .eq("status", "validated");

    if (validatedError) return { success: false, error: validatedError.message };

    for (const row of validatedRows ?? []) {
      const invoiceId = (row as { invoice_id: string }).invoice_id;
      const amount = Number((row as { amount: number }).amount);
      validatedTotals.set(invoiceId, (validatedTotals.get(invoiceId) ?? 0) + amount);
    }
  }

  for (const row of pendingCollections ?? []) {
    if (!row.invoice_id || !row.invoice) continue;

    const totalAmount = Number(row.invoice.total_amount);
    const totalCollected = validatedTotals.get(row.invoice_id) ?? 0;
    if (totalCollected + 0.01 >= totalAmount) {
      await adminClient
        .from("invoices")
        .update({
          is_settled: true,
          settled_at: new Date().toISOString(),
          settled_by: access.profile.id,
          status: "paid"
        })
        .eq("id", row.invoice_id);
    }

    const customerBalance = row.invoice.customer?.balance;
    if (customerBalance != null) {
      const nextBalance = Math.max(0, Number(customerBalance) - Number(row.amount));
      await adminClient.from("customers").update({ balance: nextBalance }).eq("id", row.invoice.customer_id);
    }
  }

  const { error: expenseUpdateError } = await adminClient
    .from("collection_expenses")
    .update({
      status: "approved",
      approved_by: access.profile.id,
      approved_at: new Date().toISOString()
    })
    .eq("sales_rep_id", salesRepId)
    .eq("status", "pending");

  if (expenseUpdateError) return { success: false, error: expenseUpdateError.message };

  revalidatePath("/collections/approvals");
  revalidatePath("/collections");

  return { success: true, message: "Collections approved" };
}
