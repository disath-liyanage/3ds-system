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

export type CollectionReportStatus = "draft" | "submitted" | "approved" | "rejected";

export type CollectionReportSummary = {
  report_id: string | null;
  sales_rep_id: string;
  sales_rep_name: string;
  report_date: string;
  status: CollectionReportStatus | "none";
  collected_total: number;
  expense_total: number;
  net_total: number;
};

export type CollectionReportExpenseRow = {
  id: string;
  report_id: string;
  expense_date: string;
  category: string;
  amount: number;
  note: string | null;
  created_at: string;
};

export type CollectionReportCollectionRow = {
  id: string;
  invoice_number: number | null;
  customer_name: string;
  amount: number;
  notes: string | null;
  created_at: string;
};

export type CollectionReportDetail = {
  report: {
    id: string;
    sales_rep_id: string;
    sales_rep_name: string;
    report_date: string;
    status: CollectionReportStatus;
    submitted_at: string | null;
    approved_at: string | null;
    rejected_at: string | null;
  };
  collections: CollectionReportCollectionRow[];
  expenses: CollectionReportExpenseRow[];
  totals: {
    collected_total: number;
    expense_total: number;
    net_total: number;
  };
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

type CollectionReportRow = {
  id: string;
  sales_rep_id: string;
  report_date: string;
  status: CollectionReportStatus;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
};

type CollectionReportExpenseAmountRow = {
  report_id: string;
  amount: number;
};

type CollectionReportSalesRepRow = {
  id: string;
  full_name: string;
};

type CollectionReportCollectionQueryRow = {
  id: string;
  amount: number;
  notes: string | null;
  created_at: string;
  invoice: { invoice_number: number | null } | null;
  customer: { name: string } | null;
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

function canManageCollectionReports(profile: ProfilePermissionRow): boolean {
  const roleRelation = profile.custom_role;
  const customRole = Array.isArray(roleRelation) ? roleRelation[0] || null : roleRelation;

  return (
    profile.role === "admin" ||
    profile.role === "manager" ||
    profile.role === "cashier" ||
    Boolean(customRole?.perm_validate_collections)
  );
}

function buildReportDateRange(reportDate: string): { start: string; end: string } {
  const start = new Date(`${reportDate}T00:00:00`);
  const end = new Date(`${reportDate}T23:59:59.999`);
  return { start: start.toISOString(), end: end.toISOString() };
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

async function fetchReportCollections(
  salesRepId: string,
  reportDate: string
): Promise<{ rows: CollectionReportCollectionRow[]; total: number }> {
  const { start, end } = buildReportDateRange(reportDate);
  const { data, error } = await adminClient
    .from("collections")
    .select("id, amount, notes, created_at, invoice:invoices(invoice_number), customer:customers(name)")
    .eq("collected_by", salesRepId)
    .gte("created_at", start)
    .lte("created_at", end)
    .order("created_at", { ascending: true })
    .returns<CollectionReportCollectionQueryRow[]>();

  if (error) throw error;

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    invoice_number: row.invoice?.invoice_number ?? null,
    customer_name: row.customer?.name ?? "Unknown",
    amount: Number(row.amount),
    notes: row.notes ?? null,
    created_at: row.created_at
  }));

  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return { rows, total };
}

async function fetchReportExpenses(
  reportId: string
): Promise<{ rows: CollectionReportExpenseRow[]; total: number }> {
  const { data, error } = await adminClient
    .from("collection_report_expenses")
    .select("id, report_id, expense_date, category, amount, note, created_at")
    .eq("report_id", reportId)
    .order("expense_date", { ascending: true })
    .returns<CollectionReportExpenseRow[]>();

  if (error) throw error;

  const rows = (data ?? []).map((row) => ({
    ...row,
    amount: Number(row.amount)
  }));
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return { rows, total };
}

export async function listDailyCollectionReports(
  reportDate: string
): Promise<{ success: boolean; data?: CollectionReportSummary[]; error?: string }> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canManageCollectionReports(access.profile)) {
    return { success: false, error: "You do not have permission to view collection reports" };
  }

  if (!reportDate) {
    return { success: false, error: "Report date is required" };
  }

  const { data: reps, error: repsError } = await adminClient
    .from("users_profile")
    .select("id, full_name")
    .eq("role", "sales_rep")
    .order("full_name", { ascending: true })
    .returns<CollectionReportSalesRepRow[]>();

  if (repsError) return { success: false, error: repsError.message };

  const repRows = reps ?? [];
  const repIds = repRows.map((rep) => rep.id);
  if (repIds.length === 0) return { success: true, data: [] };

  const { data: reports, error: reportsError } = await adminClient
    .from("collection_reports")
    .select("id, sales_rep_id, report_date, status, submitted_at, approved_at, rejected_at")
    .eq("report_date", reportDate)
    .in("sales_rep_id", repIds)
    .returns<CollectionReportRow[]>();

  if (reportsError) return { success: false, error: reportsError.message };

  const reportMap = new Map((reports ?? []).map((report) => [report.sales_rep_id, report]));

  const reportIds = (reports ?? []).map((report) => report.id);
  const expenseTotals = new Map<string, number>();
  if (reportIds.length > 0) {
    const { data: expenseRows, error: expenseError } = await adminClient
      .from("collection_report_expenses")
      .select("report_id, amount")
      .in("report_id", reportIds)
      .returns<CollectionReportExpenseAmountRow[]>();

    if (expenseError) return { success: false, error: expenseError.message };

    for (const row of expenseRows ?? []) {
      const current = expenseTotals.get(row.report_id) ?? 0;
      expenseTotals.set(row.report_id, current + Number(row.amount));
    }
  }

  const { start, end } = buildReportDateRange(reportDate);
  const { data: collectionRows, error: collectionsError } = await adminClient
    .from("collections")
    .select("collected_by, amount, created_at")
    .in("collected_by", repIds)
    .gte("created_at", start)
    .lte("created_at", end);

  if (collectionsError) return { success: false, error: collectionsError.message };

  const collectionTotals = new Map<string, number>();
  for (const row of collectionRows ?? []) {
    const repId = (row as { collected_by: string }).collected_by;
    const amount = Number((row as { amount: number }).amount);
    const current = collectionTotals.get(repId) ?? 0;
    collectionTotals.set(repId, current + amount);
  }

  const summaries: CollectionReportSummary[] = repRows.map((rep) => {
    const report = reportMap.get(rep.id) ?? null;
    const collectedTotal = collectionTotals.get(rep.id) ?? 0;
    const expenseTotal = report ? expenseTotals.get(report.id) ?? 0 : 0;
    const netTotal = collectedTotal - expenseTotal;

    return {
      report_id: report?.id ?? null,
      sales_rep_id: rep.id,
      sales_rep_name: rep.full_name,
      report_date: reportDate,
      status: report?.status ?? "none",
      collected_total: collectedTotal,
      expense_total: expenseTotal,
      net_total: netTotal
    };
  });

  return { success: true, data: summaries };
}

export async function getDailyCollectionReport(
  reportDate: string
): Promise<{ success: boolean; data?: CollectionReportDetail; error?: string }> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canRecordCollections(access.profile)) {
    return { success: false, error: "You do not have permission to view collection reports" };
  }

  if (!reportDate) {
    return { success: false, error: "Report date is required" };
  }

  let { data: report, error: reportError } = await adminClient
    .from("collection_reports")
    .select("id, sales_rep_id, report_date, status, submitted_at, approved_at, rejected_at")
    .eq("sales_rep_id", access.profile.id)
    .eq("report_date", reportDate)
    .maybeSingle<CollectionReportRow>();

  if (reportError) return { success: false, error: reportError.message };

  if (!report) {
    const { data: inserted, error: insertError } = await adminClient
      .from("collection_reports")
      .insert({
        sales_rep_id: access.profile.id,
        report_date: reportDate,
        status: "draft"
      })
      .select("id, sales_rep_id, report_date, status, submitted_at, approved_at, rejected_at")
      .single<CollectionReportRow>();

    if (insertError || !inserted) {
      return { success: false, error: insertError?.message || "Failed to create report" };
    }
    report = inserted;
  }

  const collections = await fetchReportCollections(report.sales_rep_id, report.report_date);
  const expenses = await fetchReportExpenses(report.id);

  return {
    success: true,
    data: {
      report: {
        id: report.id,
        sales_rep_id: report.sales_rep_id,
        sales_rep_name: access.profile.full_name,
        report_date: report.report_date,
        status: report.status,
        submitted_at: report.submitted_at,
        approved_at: report.approved_at,
        rejected_at: report.rejected_at
      },
      collections: collections.rows,
      expenses: expenses.rows,
      totals: {
        collected_total: collections.total,
        expense_total: expenses.total,
        net_total: collections.total - expenses.total
      }
    }
  };
}

export async function getCollectionReportDetail(
  reportId: string
): Promise<{ success: boolean; data?: CollectionReportDetail; error?: string }> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!reportId) return { success: false, error: "Report id is required" };

  const { data: reportRow, error: reportError } = await adminClient
    .from("collection_reports")
    .select(
      "id, sales_rep_id, report_date, status, submitted_at, approved_at, rejected_at, sales_rep:users_profile(full_name)"
    )
    .eq("id", reportId)
    .maybeSingle<CollectionReportRow & { sales_rep: { full_name: string } | null }>();

  if (reportError || !reportRow) {
    return { success: false, error: reportError?.message || "Report not found" };
  }

  const isOwner = reportRow.sales_rep_id === access.profile.id;
  if (!isOwner && !canManageCollectionReports(access.profile)) {
    return { success: false, error: "You do not have permission to view this report" };
  }

  const collections = await fetchReportCollections(reportRow.sales_rep_id, reportRow.report_date);
  const expenses = await fetchReportExpenses(reportRow.id);

  return {
    success: true,
    data: {
      report: {
        id: reportRow.id,
        sales_rep_id: reportRow.sales_rep_id,
        sales_rep_name: reportRow.sales_rep?.full_name ?? "Unknown",
        report_date: reportRow.report_date,
        status: reportRow.status,
        submitted_at: reportRow.submitted_at,
        approved_at: reportRow.approved_at,
        rejected_at: reportRow.rejected_at
      },
      collections: collections.rows,
      expenses: expenses.rows,
      totals: {
        collected_total: collections.total,
        expense_total: expenses.total,
        net_total: collections.total - expenses.total
      }
    }
  };
}

export async function addCollectionReportExpense(input: {
  report_id: string;
  expense_date: string;
  category: string;
  amount: number;
  note?: string;
}): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!input.report_id) return { success: false, error: "Report id is required" };
  if (!input.expense_date) return { success: false, error: "Expense date is required" };
  if (!input.category.trim()) return { success: false, error: "Category is required" };

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Amount must be greater than 0" };
  }

  const { data: report, error: reportError } = await adminClient
    .from("collection_reports")
    .select("id, sales_rep_id, status")
    .eq("id", input.report_id)
    .maybeSingle<CollectionReportRow>();

  if (reportError || !report) {
    return { success: false, error: reportError?.message || "Report not found" };
  }

  if (report.sales_rep_id !== access.profile.id) {
    return { success: false, error: "You do not have permission to edit this report" };
  }

  if (!["draft", "rejected"].includes(report.status)) {
    return { success: false, error: "This report can no longer be edited" };
  }

  const { error: insertError } = await adminClient
    .from("collection_report_expenses")
    .insert({
      report_id: input.report_id,
      expense_date: input.expense_date,
      category: input.category.trim(),
      amount,
      note: input.note?.trim() || null
    });

  if (insertError) return { success: false, error: insertError.message };

  revalidatePath("/collections/reports");
  revalidatePath("/collections/reports/my");

  return { success: true, message: "Expense added" };
}

export async function deleteCollectionReportExpense(reportId: string, expenseId: string): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!reportId || !expenseId) return { success: false, error: "Expense id is required" };

  const { data: report, error: reportError } = await adminClient
    .from("collection_reports")
    .select("id, sales_rep_id, status")
    .eq("id", reportId)
    .maybeSingle<CollectionReportRow>();

  if (reportError || !report) {
    return { success: false, error: reportError?.message || "Report not found" };
  }

  if (report.sales_rep_id !== access.profile.id) {
    return { success: false, error: "You do not have permission to edit this report" };
  }

  if (!["draft", "rejected"].includes(report.status)) {
    return { success: false, error: "This report can no longer be edited" };
  }

  const { error: deleteError } = await adminClient
    .from("collection_report_expenses")
    .delete()
    .eq("id", expenseId)
    .eq("report_id", reportId);

  if (deleteError) return { success: false, error: deleteError.message };

  revalidatePath("/collections/reports");
  revalidatePath("/collections/reports/my");

  return { success: true, message: "Expense removed" };
}

export async function submitCollectionReport(reportId: string): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!reportId) return { success: false, error: "Report id is required" };

  const { data: report, error: reportError } = await adminClient
    .from("collection_reports")
    .select("id, sales_rep_id, status")
    .eq("id", reportId)
    .maybeSingle<CollectionReportRow>();

  if (reportError || !report) {
    return { success: false, error: reportError?.message || "Report not found" };
  }

  if (report.sales_rep_id !== access.profile.id) {
    return { success: false, error: "You do not have permission to submit this report" };
  }

  if (!["draft", "rejected"].includes(report.status)) {
    return { success: false, error: "This report is already submitted" };
  }

  const { error: updateError } = await adminClient
    .from("collection_reports")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      approved_by: null,
      approved_at: null,
      rejected_by: null,
      rejected_at: null
    })
    .eq("id", reportId);

  if (updateError) return { success: false, error: updateError.message };

  revalidatePath("/collections/reports");
  revalidatePath("/collections/reports/my");

  return { success: true, message: "Report submitted" };
}

export async function approveCollectionReport(reportId: string): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canManageCollectionReports(access.profile)) {
    return { success: false, error: "You do not have permission to approve reports" };
  }

  if (!reportId) return { success: false, error: "Report id is required" };

  const { data: report, error: reportError } = await adminClient
    .from("collection_reports")
    .select("id, status")
    .eq("id", reportId)
    .maybeSingle<CollectionReportRow>();

  if (reportError || !report) {
    return { success: false, error: reportError?.message || "Report not found" };
  }

  if (report.status !== "submitted") {
    return { success: false, error: "Only submitted reports can be approved" };
  }

  const { error: updateError } = await adminClient
    .from("collection_reports")
    .update({
      status: "approved",
      approved_by: access.profile.id,
      approved_at: new Date().toISOString(),
      rejected_by: null,
      rejected_at: null
    })
    .eq("id", reportId);

  if (updateError) return { success: false, error: updateError.message };

  revalidatePath("/collections/reports");
  revalidatePath("/collections/reports/my");

  return { success: true, message: "Report approved" };
}

export async function rejectCollectionReport(reportId: string): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canManageCollectionReports(access.profile)) {
    return { success: false, error: "You do not have permission to reject reports" };
  }

  if (!reportId) return { success: false, error: "Report id is required" };

  const { data: report, error: reportError } = await adminClient
    .from("collection_reports")
    .select("id, status")
    .eq("id", reportId)
    .maybeSingle<CollectionReportRow>();

  if (reportError || !report) {
    return { success: false, error: reportError?.message || "Report not found" };
  }

  if (report.status !== "submitted") {
    return { success: false, error: "Only submitted reports can be rejected" };
  }

  const { error: updateError } = await adminClient
    .from("collection_reports")
    .update({
      status: "rejected",
      rejected_by: access.profile.id,
      rejected_at: new Date().toISOString()
    })
    .eq("id", reportId);

  if (updateError) return { success: false, error: updateError.message };

  revalidatePath("/collections/reports");
  revalidatePath("/collections/reports/my");

  return { success: true, message: "Report rejected" };
}
