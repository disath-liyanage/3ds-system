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

type CreateInvoiceActionResult = ActionResult & {
  invoice_id?: string;
};

type ReturnActionResult = ActionResult & {
  return_invoice_id?: string;
};

type CustomRolePermissionSummary = {
  perm_create_invoices: boolean;
};

type ProfilePermissionRow = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  custom_role_id?: string | null;
  custom_role: CustomRolePermissionSummary | CustomRolePermissionSummary[] | null;
};

type InvoicePaymentMethod = "cash" | "credit" | "on_account";

function isValidInvoicePaymentMethod(value: string): value is InvoicePaymentMethod {
  return value === "cash" || value === "credit" || value === "on_account";
}

function isOutstandingInvoicePaymentMethod(value: string | null | undefined): boolean {
  return value === "credit" || value === "on_account";
}

function formatCurrencyLKR(value: number) {
  return `LKR ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

async function validateCustomerCreditLimit(
  customerId: string,
  invoiceTotal: number,
  currentInvoiceCreditContribution = 0
): Promise<ActionResult> {
  const { data: customer, error: customerError } = await adminClient
    .from("customers")
    .select("credit_limit, balance")
    .eq("id", customerId)
    .single();

  if (customerError || !customer) {
    return { success: false, error: customerError?.message || "Customer not found" };
  }

  if (customer.credit_limit == null) {
    return { success: true };
  }

  const creditLimit = Number(customer.credit_limit);
  const currentBalance = Number(customer.balance) || 0;
  const existingContribution = Number(currentInvoiceCreditContribution) || 0;
  const availableCredit = Math.max(0, creditLimit - Math.max(0, currentBalance - existingContribution));

  if (invoiceTotal > availableCredit) {
    return {
      success: false,
      error: `Credit limit exceeded. Available credit: ${formatCurrencyLKR(availableCredit)}. Invoice total: ${formatCurrencyLKR(invoiceTotal)}.`
    };
  }

  return { success: true };
}

export type InvoiceListRow = {
  id: string;
  invoice_number: number;
  quotation_number?: number | null;
  order_id: string | null;
  customer_id: string;
  customer_name: string;
  issued_by: string;
  issued_by_name: string;
  total_amount: number;
  payment_method: string;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "issued" | "paid";
  created_at: string;
  is_settled?: boolean;
  settled_at?: string | null;
  collected_total?: number;
  remaining_amount?: number;
  payment_status?: "unpaid" | "partially_paid" | "paid";
};

export type InvoiceDetailRow = InvoiceListRow & {
  invoice_kind?: "invoice" | "quotation";
  customer_code?: string;
  customer_phone: string;
  customer_address: string;
  customer_route?: string;
  customer_balance?: number;
  sales_rep_name?: string;
  sales_rep_phone?: string | null;
  notes: string | null;
  outstanding_invoices?: Array<{
    id: string;
    invoice_number: number;
    created_at: string;
    net_amount: number;
    credit_amount: number;
    settled_amount: number;
    due_amount: number;
  }>;
  items: Array<{
    id: string;
    product_id: string;
    product_name: string;
    product_unit: string;
    qty: number;
    free_qty: number;
    unit_price: number;
    discount_type: "percent" | "amount";
    discount_value: number;
  }>;
};

export type ReturnableInvoiceRow = {
  id: string;
  invoice_number: number;
  customer_id: string;
  customer_name: string;
  payment_method: InvoicePaymentMethod;
  created_at: string;
  items: Array<{
    invoice_item_id: string;
    product_id: string;
    product_name: string;
    product_unit: string;
    qty: number;
    free_qty: number;
    unit_price: number;
    discount_type: "percent" | "amount";
    discount_value: number;
    already_returned_qty: number;
    returnable_qty: number;
  }>;
};

export type ReturnInvoiceDetailRow = {
  id: string;
  return_number: number;
  created_at: string;
  notes: string | null;
  total_return_amount: number;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  source_invoice_id: string;
  source_invoice_number: number;
  returned_by_name: string;
  items: Array<{
    id: string;
    product_name: string;
    product_unit: string;
    qty: number;
    unit_price: number;
    line_total: number;
  }>;
};

export type ReturnInvoiceListRow = {
  id: string;
  return_number: number;
  created_at: string;
  total_return_amount: number;
  customer_name: string;
  source_invoice_number: number;
  returned_by_name: string;
};

export type CancelledInvoiceReportRow = {
  invoice_id: string;
  invoice_number: number;
  cancelled_at: string;
  cancelled_by_name: string;
  items: Array<{
    audit_id: string;
    product_id: string;
    product_name: string;
    qty: number;
    free_qty: number;
    restored_qty: number;
    stock_before: number;
    stock_after: number;
  }>;
};

export type InvoiceInput = {
  customer_id: string;
  payment_method: string;
  invoice_kind?: "invoice" | "quotation";
  saveAsDraft?: boolean;
  notes?: string;
  items: Array<{
    product_id: string;
    qty: number;
    free_qty?: number;
    unit_price: number;
    unit_cost: number;
    discount_type?: "percent" | "amount";
    discount_value?: number;
  }>;
};

export type UpdateDraftInvoiceInput = {
  invoice_id: string;
  payment_method: string;
  finalize: boolean;
  notes?: string;
  items: Array<{
    product_id: string;
    qty: number;
    free_qty?: number;
    unit_price: number;
    unit_cost: number;
    discount_type?: "percent" | "amount";
    discount_value?: number;
  }>;
};

export type UpdateInvoiceInput = {
  invoice_id: string;
  payment_method: string;
  notes?: string;
  items: Array<{
    product_id: string;
    qty: number;
    free_qty?: number;
    unit_price: number;
    unit_cost: number;
    discount_type?: "percent" | "amount";
    discount_value?: number;
  }>;
};

export type CreateReturnInvoiceInput = {
  invoice_id: string;
  notes?: string;
  items: Array<{
    invoice_item_id: string;
    qty: number;
  }>;
};

type InvoiceStatus = InvoiceListRow["status"];

async function getNextQuotationNumber(): Promise<number> {
  const { data, error } = await adminClient
    .from("invoices")
    .select("quotation_number")
    .eq("invoice_kind", "quotation")
    .not("quotation_number", "is", null)
    .order("quotation_number", { ascending: false })
    .limit(1)
    .maybeSingle<{ quotation_number: number | null }>();

  if (error) {
    throw new Error(error.message);
  }

  const current = Number(data?.quotation_number) || 5999;
  return current + 1;
}

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
      .select("perm_create_invoices")
      .eq("id", profile.custom_role_id)
      .maybeSingle<CustomRolePermissionSummary>();
    custom_role = roleRow ?? null;
  }

  return { profile: { ...profile, custom_role } };
}

function canCreateInvoices(profile: ProfilePermissionRow): boolean {
  const roleRelation = profile.custom_role;
  const customRole = Array.isArray(roleRelation) ? roleRelation[0] || null : roleRelation;

  return (
    profile.role === "admin" ||
    profile.role === "manager" ||
    profile.role === "cashier" ||
    profile.role === "sales_rep" ||
    Boolean(customRole?.perm_create_invoices)
  );
}

function canViewAllInvoices(profile: ProfilePermissionRow): boolean {
  return profile.role === "admin" || profile.role === "manager";
}

function isAdminOrManager(profile: ProfilePermissionRow): boolean {
  return profile.role === "admin" || profile.role === "manager";
}

function getDiscountPerUnit(unitPrice: number, discountType: "percent" | "amount", discountValue: number): number {
  if (!discountValue) return 0;
  if (discountType === "percent") return (unitPrice * discountValue) / 100;
  return discountValue;
}

function toPriceKey(value: number | string | null | undefined): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return amount.toFixed(2);
}

async function notifyInvoiceApprovers(
  invoiceId: string,
  invoiceNumber: number,
  requestedBy: ProfilePermissionRow
): Promise<ActionResult> {
  const { data: approvers, error: approverError } = await adminClient
    .from("users_profile")
    .select("id")
    .in("role", ["admin", "manager"]);

  if (approverError) {
    return { success: false, error: approverError.message };
  }

  if (!approvers || approvers.length === 0) {
    return { success: true };
  }

  const notifications = approvers.map((approver) => ({
    recipient_id: approver.id,
    title: "Invoice approval request",
    message: `${requestedBy.full_name || requestedBy.email} requested approval for invoice #${invoiceNumber}.`,
    type: "invoice_approval_request",
    invoice_id: invoiceId,
    created_by: requestedBy.id
  }));

  const { error: notificationError } = await adminClient.from("notifications").insert(notifications);
  if (notificationError) {
    return { success: false, error: notificationError.message };
  }

  return { success: true };
}

async function notifyInvoiceRequester(
  invoiceId: string,
  invoiceNumber: number,
  requesterId: string | null,
  reviewer: ProfilePermissionRow,
  outcome: "approved" | "rejected"
): Promise<void> {
  if (!requesterId) return;

  await adminClient.from("notifications").insert({
    recipient_id: requesterId,
    title: `Invoice request ${outcome}`,
    message: `Your invoice request #${invoiceNumber} was ${outcome} by ${reviewer.full_name || reviewer.email}.`,
    type: "invoice_approval_result",
    invoice_id: invoiceId,
    created_by: reviewer.id
  });
}

export type ListInvoicesParams = {
  page?: number;
  pageSize?: number;
  customerSearch?: string;
  status?: string;
  minTotal?: number;
  maxTotal?: number;
  minInvoiceNo?: number;
  maxInvoiceNo?: number;
  fromDate?: string;
  toDate?: string;
};

export async function listInvoices(
  params: ListInvoicesParams = {}
): Promise<{ success: boolean; data?: InvoiceListRow[]; total?: number; error?: string }> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canCreateInvoices(access.profile)) {
    return { success: false, error: "You do not have permission to view invoices" };
  }

  const page = Math.max(1, Number(params.page ?? 1));
  const pageSize = Math.max(1, Number(params.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = adminClient
    .from("invoices")
    .select(
      "id, invoice_number, quotation_number, order_id, customer_id, issued_by, total_amount, payment_method, status, created_at, is_settled, settled_at, customer:customers(name), issuer:users_profile!invoices_issued_by_fkey(full_name)",
      { count: "exact" }
    )
    .eq("invoice_kind", "invoice")
    .order("created_at", { ascending: false });

  if (!canViewAllInvoices(access.profile)) {
    query = query.or(`issued_by.eq.${access.profile.id},status.in.(approved,issued,paid)`);
  }

  if (params.customerSearch) {
    const q = params.customerSearch.replace(/[%_]/g, "\\$&");
    query = query.or(
      `customer.name.ilike.%${q}%,invoice_number.ilike.%${q}%`
    );
  }
  if (params.status && params.status !== "all") {
    if (params.status === "approved") {
      query = query.in("status", ["approved", "issued"]);
    } else {
      query = query.eq("status", params.status);
    }
  }
  if (typeof params.minTotal === "number" && Number.isFinite(params.minTotal)) {
    query = query.gte("total_amount", params.minTotal);
  }
  if (typeof params.maxTotal === "number" && Number.isFinite(params.maxTotal)) {
    query = query.lte("total_amount", params.maxTotal);
  }
  if (typeof params.minInvoiceNo === "number" && Number.isFinite(params.minInvoiceNo)) {
    query = query.gte("invoice_number", params.minInvoiceNo);
  }
  if (typeof params.maxInvoiceNo === "number" && Number.isFinite(params.maxInvoiceNo)) {
    query = query.lte("invoice_number", params.maxInvoiceNo);
  }
  if (params.fromDate) {
    query = query.gte("created_at", params.fromDate);
  }
  if (params.toDate) {
    query = query.lte("created_at", params.toDate);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) return { success: false, error: error.message };

  const invoiceIds = (data ?? []).map((row: any) => String(row.id)).filter(Boolean);
  const collectionTotals = new Map<string, number>();
  if (invoiceIds.length > 0) {
    const { data: collections } = await adminClient
      .from("collections")
      .select("invoice_id, amount, status")
      .in("invoice_id", invoiceIds);

    for (const entry of collections ?? []) {
      if (entry.status === "rejected") continue;
      const invoiceId = String(entry.invoice_id || "");
      if (!invoiceId) continue;
      collectionTotals.set(invoiceId, (collectionTotals.get(invoiceId) ?? 0) + Number(entry.amount || 0));
    }
  }

  const rows = (data ?? []).map((row: any) => {
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    const issuer = Array.isArray(row.issuer) ? row.issuer[0] : row.issuer;
    const totalAmount = Number(row.total_amount) || 0;
    const collectedTotal = collectionTotals.get(String(row.id)) ?? 0;
    const remainingAmount = Math.max(0, totalAmount - collectedTotal);
    const isSettled = Boolean(row.is_settled) || remainingAmount <= 0 || row.status === "paid";
    const paymentStatus: InvoiceListRow["payment_status"] = isSettled
      ? "paid"
      : collectedTotal > 0
        ? "partially_paid"
        : "unpaid";

    return {
      id: row.id,
      invoice_number: row.invoice_number,
      quotation_number: row.quotation_number ?? null,
      order_id: row.order_id,
      customer_id: row.customer_id,
      customer_name: customer?.name ?? "Unknown Customer",
      issued_by: row.issued_by,
      issued_by_name: issuer?.full_name ?? "Unknown",
      total_amount: totalAmount,
      payment_method: row.payment_method,
      status: row.status,
      created_at: row.created_at,
      is_settled: isSettled,
      settled_at: row.settled_at ?? null,
      collected_total: collectedTotal,
      remaining_amount: remainingAmount,
      payment_status: paymentStatus
    } as InvoiceListRow;
  });

  return { success: true, data: rows, total: count ?? 0 };
}

export async function listQuotations(): Promise<{ success: boolean; data?: InvoiceListRow[]; error?: string }> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!isAdminOrManager(access.profile)) {
    return { success: false, error: "You do not have permission to view quotations" };
  }

  const { data, error } = await adminClient
    .from("invoices")
    .select(
      "id, invoice_number, quotation_number, order_id, customer_id, issued_by, total_amount, payment_method, status, created_at, customer:customers(name), issuer:users_profile!invoices_issued_by_fkey(full_name)"
    )
    .eq("invoice_kind", "quotation")
    .order("quotation_number", { ascending: false });

  if (error) return { success: false, error: error.message };

  const rows = (data ?? []).map((row: any) => {
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    const issuer = Array.isArray(row.issuer) ? row.issuer[0] : row.issuer;

    return {
      id: row.id,
      invoice_number: row.invoice_number,
      quotation_number: row.quotation_number ?? null,
      order_id: row.order_id,
      customer_id: row.customer_id,
      customer_name: customer?.name ?? "Unknown Customer",
      issued_by: row.issued_by,
      issued_by_name: issuer?.full_name ?? "Unknown",
      total_amount: Number(row.total_amount),
      payment_method: row.payment_method,
      status: row.status,
      created_at: row.created_at
    } as InvoiceListRow;
  });

  return { success: true, data: rows };
}

export async function getInvoiceDetail(
  invoiceId: string
): Promise<{ success: boolean; data?: InvoiceDetailRow | null; error?: string }> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!invoiceId) {
    return { success: false, error: "Invoice id is required" };
  }

  if (!canCreateInvoices(access.profile)) {
    return { success: false, error: "You do not have permission to view invoices" };
  }

  const supabase = createClient();

  let query = adminClient
    .from("invoices")
    .select(
      `
        id, invoice_number, quotation_number, invoice_kind, order_id, customer_id, issued_by, total_amount, payment_method, status, created_at, notes,
        customer:customers(id, name, phone, address, area, balance, sales_rep_id),
        issuer:users_profile!invoices_issued_by_fkey(full_name),
        invoice_items (
          id, product_id, qty, free_qty, unit_price, discount_type, discount_value,
          product:products(name, unit)
        )
      `
    )
    .eq("id", invoiceId);

  if (!canViewAllInvoices(access.profile)) {
    query = query.or(`issued_by.eq.${access.profile.id},status.in.(approved,issued,paid)`);
  }

  const { data, error } = await query.single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: true, data: null };

  if (!canViewAllInvoices(access.profile)) {
    const canSeeOwn = data.issued_by === access.profile.id;
    const canSeeApproved = ["approved", "issued", "paid"].includes(data.status);
    if (!canSeeOwn && !canSeeApproved) {
      return { success: false, error: "You do not have permission to view this invoice" };
    }
  }

  const invoiceData = data as any;
  const customer = invoiceData.customer ?? null;

  const salesRepId = customer?.sales_rep_id ? String(customer.sales_rep_id) : null;
  let salesRep: { full_name: string | null; phone: string | null } | null = null;
  if (salesRepId) {
    const { data: salesRepData } = await adminClient
      .from("users_profile")
      .select("full_name, phone")
      .eq("id", salesRepId)
      .maybeSingle<{ full_name: string | null; phone: string | null }>();
    salesRep = salesRepData ?? null;
  }

  const { data: customerInvoices } = await adminClient
    .from("invoices")
    .select("id, invoice_number, created_at, total_amount, payment_method, status")
    .eq("customer_id", invoiceData.customer_id)
    .eq("invoice_kind", "invoice")
    .in("payment_method", ["credit", "on_account"])
    .in("status", ["approved", "issued", "paid"])
    .order("created_at", { ascending: false });

  const invoiceIds = (customerInvoices ?? []).map((row) => row.id);
  const collectionTotals = new Map<string, number>();
  if (invoiceIds.length > 0) {
    const { data: collections } = await adminClient
      .from("collections")
      .select("invoice_id, amount, status")
      .in("invoice_id", invoiceIds);
    for (const entry of collections ?? []) {
      if (entry.status === "rejected") continue;
      const invoiceKey = String(entry.invoice_id || "");
      if (!invoiceKey) continue;
      collectionTotals.set(invoiceKey, (collectionTotals.get(invoiceKey) ?? 0) + Number(entry.amount || 0));
    }
  }

  const outstandingInvoices = (customerInvoices ?? [])
    .map((row) => {
      const netAmount = Number(row.total_amount) || 0;
      const settledAmount = collectionTotals.get(String(row.id)) ?? 0;
      const dueAmount = Math.max(0, netAmount - settledAmount);
      return {
        id: String(row.id),
        invoice_number: Number(row.invoice_number) || 0,
        created_at: String(row.created_at),
        net_amount: netAmount,
        credit_amount: isOutstandingInvoicePaymentMethod(row.payment_method) ? netAmount : 0,
        settled_amount: settledAmount,
        due_amount: dueAmount
      };
    })
    .filter((row) => row.id !== String(invoiceData.id))
    .filter((row) => row.due_amount > 0);

  const result: InvoiceDetailRow = {
    id: invoiceData.id,
    invoice_number: invoiceData.invoice_number,
    quotation_number: invoiceData.quotation_number ?? null,
    invoice_kind: invoiceData.invoice_kind === "quotation" ? "quotation" : "invoice",
    order_id: invoiceData.order_id,
    customer_id: invoiceData.customer_id,
    customer_code: customer?.id ?? invoiceData.customer_id,
    customer_name: customer?.name ?? "Unknown Customer",
    customer_phone: customer?.phone ?? "",
    customer_address: customer?.address ?? "",
    customer_route: customer?.area ?? "",
    customer_balance: Number(customer?.balance) || 0,
    sales_rep_name: salesRep?.full_name ?? undefined,
    sales_rep_phone: salesRep?.phone ?? null,
    issued_by: invoiceData.issued_by,
    issued_by_name: invoiceData.issuer?.full_name ?? "Unknown",
    total_amount: Number(invoiceData.total_amount),
    payment_method: invoiceData.payment_method,
    status: invoiceData.status,
    notes: invoiceData.notes ?? null,
    created_at: invoiceData.created_at,
    outstanding_invoices: outstandingInvoices,
    items: (invoiceData.invoice_items ?? []).map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      qty: Number(item.qty),
      free_qty: Number(item.free_qty) || 0,
      unit_price: Number(item.unit_price),
      discount_type: item.discount_type === "percent" ? "percent" : "amount",
      discount_value: Number(item.discount_value) || 0,
      product_name: item.product?.name ?? "Unknown Product",
      product_unit: item.product?.unit ?? ""
    }))
  };

  return { success: true, data: result };
}

export async function createInvoice(input: InvoiceInput): Promise<CreateInvoiceActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canCreateInvoices(access.profile)) {
    return { success: false, error: "You do not have permission to create invoices" };
  }

  const { customer_id, payment_method, items, notes, saveAsDraft } = input;
  const invoiceKind = input.invoice_kind === "quotation" ? "quotation" : "invoice";

  if (!customer_id) {
    return { success: false, error: "Customer is required" };
  }

  if (!isValidInvoicePaymentMethod(payment_method)) {
    return { success: false, error: "Valid payment method is required (cash, credit, or on account)" };
  }

  if (!items || items.length === 0) {
    return { success: false, error: "At least one item is required" };
  }

  let total_amount = 0;
  for (const [index, item] of items.entries()) {
    if (!item.product_id) {
      return { success: false, error: `Item ${index + 1} is missing a product` };
    }
    const qty = Number(item.qty);
    const unitPrice = Number(item.unit_price);
    const unitCost = Number(item.unit_cost) || 0;
    const freeQty = Number(item.free_qty) || 0;
    const discountType = item.discount_type === "percent" ? "percent" : "amount";
    const discountValue = Number(item.discount_value) || 0;
    const discountPerUnit = discountType === "percent" ? (unitPrice * discountValue) / 100 : discountValue;
    const effectiveUnitPrice = unitPrice - discountPerUnit;
    
    if (!Number.isFinite(qty) || qty <= 0) {
      return { success: false, error: `Item ${index + 1} quantity must be greater than 0` };
    }
    if (!Number.isFinite(freeQty) || freeQty < 0) {
      return { success: false, error: `Item ${index + 1} free quantity must be 0 or more` };
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { success: false, error: `Item ${index + 1} unit price cannot be negative` };
    }
    if (!Number.isFinite(discountValue) || discountValue < 0) {
      return { success: false, error: `Item ${index + 1} discount cannot be negative` };
    }
    if (discountType === "percent" && discountValue > 100) {
      return { success: false, error: `Item ${index + 1} discount percent cannot exceed 100` };
    }
    if (discountPerUnit > unitPrice) {
      return { success: false, error: `Item ${index + 1} discount cannot exceed unit price` };
    }
    if (effectiveUnitPrice < unitCost) {
      return { success: false, error: `Cannot bill undercost. Item ${index + 1} price is below the required cost.` };
    }

    total_amount += qty * Math.max(0, effectiveUnitPrice);
  }

  const isSalesRep = access.profile.role === "sales_rep";
  const status: InvoiceStatus = saveAsDraft
    ? "draft"
    : isSalesRep
      ? "pending_approval"
      : payment_method === "cash"
        ? "paid"
        : "approved";

  if (invoiceKind === "invoice" && status !== "draft" && isOutstandingInvoicePaymentMethod(payment_method)) {
    const creditValidation = await validateCustomerCreditLimit(customer_id, total_amount);
    if (!creditValidation.success) return creditValidation;
  }

  const isQuotationNumberConflict = (error: { code?: string; message?: string } | null | undefined) => {
    if (!error) return false;
    if (error.code === "23505") return true;
    return Boolean(error.message && error.message.includes("quotation_number"));
  };

  let invoice: { id: string; invoice_number: number } | null = null;
  let invoiceError: { code?: string; message?: string } | null = null;
  const maxAttempts = invoiceKind === "quotation" ? 3 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let quotationNumber: number | null = null;
    if (invoiceKind === "quotation") {
      try {
        quotationNumber = await getNextQuotationNumber();
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to generate quotation number" };
      }
    }

    const { data, error } = await adminClient
      .from("invoices")
      .insert({
        invoice_kind: invoiceKind,
        quotation_number: quotationNumber,
        customer_id,
        issued_by: access.profile.id,
        total_amount,
        payment_method,
        status,
        notes: notes || null
      })
      .select("id, invoice_number")
      .single();

    if (!error && data) {
      invoice = data as { id: string; invoice_number: number };
      invoiceError = null;
      break;
    }

    invoiceError = error as { code?: string; message?: string } | null;
    if (!(invoiceKind === "quotation" && isQuotationNumberConflict(invoiceError) && attempt < maxAttempts - 1)) {
      break;
    }
  }

  if (!invoice) {
    return { success: false, error: invoiceError?.message || "Failed to create invoice" };
  }

  const itemsPayload = items.map((item) => ({
    invoice_id: invoice.id,
    product_id: item.product_id,
    qty: item.qty,
    free_qty: item.free_qty || 0,
    unit_price: item.unit_price,
    discount_type: item.discount_type === "percent" ? "percent" : "amount",
    discount_value: item.discount_value || 0
  }));

  const { error: itemsError } = await adminClient.from("invoice_items").insert(itemsPayload);

  if (itemsError) {
    await adminClient.from("invoices").delete().eq("id", invoice.id);
    return { success: false, error: itemsError.message };
  }

  if (status === "pending_approval") {
    const notificationResult = await notifyInvoiceApprovers(
      invoice.id,
      Number(invoice.invoice_number),
      access.profile
    );

    if (!notificationResult.success) {
      return notificationResult;
    }
  }

  if (status === "approved" || status === "paid") {
    // Reduce product stock
    try {
      for (const item of items) {
        const qty = Number(item.qty);
        const { data: product, error: productError } = await adminClient
          .from("products")
          .select("stock_qty")
          .eq("id", item.product_id)
          .single();
          
        if (product && !productError) {
          const newStock = Math.max(0, Number(product.stock_qty) - qty);
          await adminClient.from("products").update({ stock_qty: newStock }).eq("id", item.product_id);
        }
      }
    } catch (err) {
      console.error("Failed to update stock after invoice creation", err);
    }

    // Outstanding invoices increase the customer's collection balance.
    if (isOutstandingInvoicePaymentMethod(payment_method)) {
      try {
        const { data: customer, error: customerError } = await adminClient
          .from("customers")
          .select("balance")
          .eq("id", customer_id)
          .single();

        if (customer && !customerError) {
          const newBalance = Number(customer.balance) + total_amount;
          await adminClient.from("customers").update({ balance: newBalance }).eq("id", customer_id);
        }
      } catch (err) {
        console.error("Failed to update customer balance", err);
      }
    }
  }

  revalidatePath("/invoices");
  revalidatePath("/products");
  revalidatePath("/customers");
  revalidatePath("/notifications");

  return {
    success: true,
    invoice_id: invoice.id,
    message:
      status === "pending_approval"
        ? "Invoice request submitted. Admins and managers were notified for approval."
        : saveAsDraft
          ? "Invoice draft saved"
          : "Invoice created successfully"
  };
}

export async function updateDraftInvoice(input: UpdateDraftInvoiceInput): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canCreateInvoices(access.profile)) {
    return { success: false, error: "You do not have permission to update invoices" };
  }

  const { invoice_id, payment_method, items, notes, finalize } = input;

  if (!invoice_id) {
    return { success: false, error: "Invoice id is required" };
  }

  if (!isValidInvoicePaymentMethod(payment_method)) {
    return { success: false, error: "Valid payment method is required (cash, credit, or on account)" };
  }

  if (!items || items.length === 0) {
    return { success: false, error: "At least one item is required" };
  }

  const { data: invoice, error: invoiceError } = await adminClient
    .from("invoices")
    .select("id, invoice_number, issued_by, status, customer_id, invoice_kind")
    .eq("id", invoice_id)
    .single();

  if (invoiceError || !invoice) {
    return { success: false, error: invoiceError?.message || "Invoice not found" };
  }

  if (!canViewAllInvoices(access.profile) && invoice.issued_by !== access.profile.id) {
    return { success: false, error: "You do not have permission to update this invoice" };
  }

  if (invoice.status !== "draft") {
    return { success: false, error: "Only draft invoices can be updated" };
  }

  let total_amount = 0;
  for (const [index, item] of items.entries()) {
    if (!item.product_id) {
      return { success: false, error: `Item ${index + 1} is missing a product` };
    }
    const qty = Number(item.qty);
    const unitPrice = Number(item.unit_price);
    const unitCost = Number(item.unit_cost) || 0;
    const freeQty = Number(item.free_qty) || 0;
    const discountType = item.discount_type === "percent" ? "percent" : "amount";
    const discountValue = Number(item.discount_value) || 0;
    const discountPerUnit = discountType === "percent" ? (unitPrice * discountValue) / 100 : discountValue;
    const effectiveUnitPrice = unitPrice - discountPerUnit;

    if (!Number.isFinite(qty) || qty <= 0) {
      return { success: false, error: `Item ${index + 1} quantity must be greater than 0` };
    }
    if (!Number.isFinite(freeQty) || freeQty < 0) {
      return { success: false, error: `Item ${index + 1} free quantity must be 0 or more` };
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { success: false, error: `Item ${index + 1} unit price cannot be negative` };
    }
    if (!Number.isFinite(discountValue) || discountValue < 0) {
      return { success: false, error: `Item ${index + 1} discount cannot be negative` };
    }
    if (discountType === "percent" && discountValue > 100) {
      return { success: false, error: `Item ${index + 1} discount percent cannot exceed 100` };
    }
    if (discountPerUnit > unitPrice) {
      return { success: false, error: `Item ${index + 1} discount cannot exceed unit price` };
    }
    if (effectiveUnitPrice < unitCost) {
      return { success: false, error: `Cannot bill undercost. Item ${index + 1} price is below the required cost.` };
    }

    total_amount += qty * Math.max(0, effectiveUnitPrice);
  }

  const isSalesRep = access.profile.role === "sales_rep";
  const status: InvoiceStatus = finalize
    ? isSalesRep
      ? "pending_approval"
      : payment_method === "cash"
        ? "paid"
        : "approved"
    : "draft";

  if (
    invoice.invoice_kind === "invoice" &&
    finalize &&
    status !== "draft" &&
    isOutstandingInvoicePaymentMethod(payment_method)
  ) {
    const creditValidation = await validateCustomerCreditLimit(invoice.customer_id, total_amount);
    if (!creditValidation.success) return creditValidation;
  }

  const { error: updateError } = await adminClient
    .from("invoices")
    .update({
      total_amount,
      payment_method,
      status,
      notes: notes || null
    })
    .eq("id", invoice_id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  const { error: deleteItemsError } = await adminClient
    .from("invoice_items")
    .delete()
    .eq("invoice_id", invoice_id);

  if (deleteItemsError) {
    return { success: false, error: deleteItemsError.message };
  }

  const itemsPayload = items.map((item) => ({
    invoice_id,
    product_id: item.product_id,
    qty: item.qty,
    free_qty: item.free_qty || 0,
    unit_price: item.unit_price,
    discount_type: item.discount_type === "percent" ? "percent" : "amount",
    discount_value: item.discount_value || 0
  }));

  const { error: itemsError } = await adminClient.from("invoice_items").insert(itemsPayload);

  if (itemsError) {
    return { success: false, error: itemsError.message };
  }

  if (finalize && status === "pending_approval") {
    const notificationResult = await notifyInvoiceApprovers(
      invoice_id,
      Number(invoice.invoice_number),
      access.profile
    );

    if (!notificationResult.success) {
      return notificationResult;
    }
  }

  if (finalize && (status === "approved" || status === "paid")) {
    // Reduce product stock
    try {
      for (const item of items) {
        const qty = Number(item.qty);
        const { data: product, error: productError } = await adminClient
          .from("products")
          .select("stock_qty")
          .eq("id", item.product_id)
          .single();

        if (product && !productError) {
          const newStock = Math.max(0, Number(product.stock_qty) - qty);
          await adminClient.from("products").update({ stock_qty: newStock }).eq("id", item.product_id);
        }
      }
    } catch (err) {
      console.error("Failed to update stock after draft finalize", err);
    }

    if (isOutstandingInvoicePaymentMethod(payment_method)) {
      try {
        const { data: customer, error: customerError } = await adminClient
          .from("customers")
          .select("balance")
          .eq("id", invoice.customer_id)
          .single();

        if (customer && !customerError) {
          const newBalance = Number(customer.balance) + total_amount;
          await adminClient.from("customers").update({ balance: newBalance }).eq("id", invoice.customer_id);
        }
      } catch (err) {
        console.error("Failed to update customer balance after draft finalize", err);
      }
    }
  }

  revalidatePath("/invoices");
  revalidatePath("/products");
  revalidatePath("/customers");
  revalidatePath("/notifications");

  return {
    success: true,
    message:
      finalize && status === "pending_approval"
        ? "Invoice request submitted. Admins and managers were notified for approval."
        : finalize
          ? "Invoice updated"
          : "Draft updated"
  };
}

export async function updateInvoice(input: UpdateInvoiceInput): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canCreateInvoices(access.profile)) {
    return { success: false, error: "You do not have permission to update invoices" };
  }

  const { invoice_id, payment_method, items, notes } = input;

  if (!invoice_id) {
    return { success: false, error: "Invoice id is required" };
  }

  if (!isValidInvoicePaymentMethod(payment_method)) {
    return { success: false, error: "Valid payment method is required (cash, credit, or on account)" };
  }

  if (!items || items.length === 0) {
    return { success: false, error: "At least one item is required" };
  }

  const { data: invoice, error: invoiceError } = await adminClient
    .from("invoices")
    .select("id, issued_by, status, customer_id, total_amount, payment_method, invoice_kind")
    .eq("id", invoice_id)
    .single();

  if (invoiceError || !invoice) {
    return { success: false, error: invoiceError?.message || "Invoice not found" };
  }

  if (!canViewAllInvoices(access.profile) && invoice.issued_by !== access.profile.id) {
    return { success: false, error: "You do not have permission to update this invoice" };
  }

  if (invoice.status === "paid") {
    return { success: false, error: "Paid invoices cannot be edited" };
  }

  let total_amount = 0;
  for (const [index, item] of items.entries()) {
    if (!item.product_id) {
      return { success: false, error: `Item ${index + 1} is missing a product` };
    }
    const qty = Number(item.qty);
    const unitPrice = Number(item.unit_price);
    const unitCost = Number(item.unit_cost) || 0;
    const freeQty = Number(item.free_qty) || 0;
    const discountType = item.discount_type === "percent" ? "percent" : "amount";
    const discountValue = Number(item.discount_value) || 0;
    const discountPerUnit = discountType === "percent" ? (unitPrice * discountValue) / 100 : discountValue;
    const effectiveUnitPrice = unitPrice - discountPerUnit;

    if (!Number.isFinite(qty) || qty <= 0) {
      return { success: false, error: `Item ${index + 1} quantity must be greater than 0` };
    }
    if (!Number.isFinite(freeQty) || freeQty < 0) {
      return { success: false, error: `Item ${index + 1} free quantity must be 0 or more` };
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { success: false, error: `Item ${index + 1} unit price cannot be negative` };
    }
    if (!Number.isFinite(discountValue) || discountValue < 0) {
      return { success: false, error: `Item ${index + 1} discount cannot be negative` };
    }
    if (discountType === "percent" && discountValue > 100) {
      return { success: false, error: `Item ${index + 1} discount percent cannot exceed 100` };
    }
    if (discountPerUnit > unitPrice) {
      return { success: false, error: `Item ${index + 1} discount cannot exceed unit price` };
    }
    if (effectiveUnitPrice < unitCost) {
      return { success: false, error: `Cannot bill undercost. Item ${index + 1} price is below the required cost.` };
    }

    total_amount += qty * Math.max(0, effectiveUnitPrice);
  }

  const shouldUpdateStock = invoice.status === "approved" || invoice.status === "paid" || invoice.status === "issued";

  if (shouldUpdateStock) {
    const oldContribution = isOutstandingInvoicePaymentMethod(invoice.payment_method) ? Number(invoice.total_amount) : 0;
    if (invoice.invoice_kind === "invoice" && isOutstandingInvoicePaymentMethod(payment_method)) {
      const creditValidation = await validateCustomerCreditLimit(invoice.customer_id, total_amount, oldContribution);
      if (!creditValidation.success) return creditValidation;
    }

    const { data: existingItems, error: existingItemsError } = await adminClient
      .from("invoice_items")
      .select("product_id, qty")
      .eq("invoice_id", invoice_id);

    if (existingItemsError) {
      return { success: false, error: existingItemsError.message };
    }

    const oldQtyByProduct = new Map<string, number>();
    for (const item of existingItems ?? []) {
      const current = oldQtyByProduct.get(item.product_id) ?? 0;
      oldQtyByProduct.set(item.product_id, current + Number(item.qty));
    }

    const newQtyByProduct = new Map<string, number>();
    for (const item of items) {
      const current = newQtyByProduct.get(item.product_id) ?? 0;
      newQtyByProduct.set(item.product_id, current + Number(item.qty));
    }

    const allProductIds = new Set([...oldQtyByProduct.keys(), ...newQtyByProduct.keys()]);

    try {
      for (const productId of allProductIds) {
        const oldQty = oldQtyByProduct.get(productId) ?? 0;
        const newQty = newQtyByProduct.get(productId) ?? 0;
        const delta = newQty - oldQty;

        if (delta === 0) continue;

        const { data: product, error: productError } = await adminClient
          .from("products")
          .select("stock_qty")
          .eq("id", productId)
          .single();

        if (!product || productError) continue;

        const nextStock = Math.max(0, Number(product.stock_qty) - delta);
        await adminClient.from("products").update({ stock_qty: nextStock }).eq("id", productId);
      }
    } catch (err) {
      console.error("Failed to update stock after invoice edit", err);
    }

    const newContribution = isOutstandingInvoicePaymentMethod(payment_method) ? total_amount : 0;
    const balanceDelta = newContribution - oldContribution;

    if (balanceDelta !== 0) {
      try {
        const { data: customer, error: customerError } = await adminClient
          .from("customers")
          .select("balance")
          .eq("id", invoice.customer_id)
          .single();

        if (customer && !customerError) {
          const newBalance = Number(customer.balance) + balanceDelta;
          await adminClient.from("customers").update({ balance: newBalance }).eq("id", invoice.customer_id);
        }
      } catch (err) {
        console.error("Failed to update customer balance after invoice edit", err);
      }
    }
  }

  const { error: updateError } = await adminClient
    .from("invoices")
    .update({
      total_amount,
      payment_method,
      notes: notes || null
    })
    .eq("id", invoice_id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  const { error: deleteItemsError } = await adminClient
    .from("invoice_items")
    .delete()
    .eq("invoice_id", invoice_id);

  if (deleteItemsError) {
    return { success: false, error: deleteItemsError.message };
  }

  const itemsPayload = items.map((item) => ({
    invoice_id,
    product_id: item.product_id,
    qty: item.qty,
    free_qty: item.free_qty || 0,
    unit_price: item.unit_price,
    discount_type: item.discount_type === "percent" ? "percent" : "amount",
    discount_value: item.discount_value || 0
  }));

  const { error: itemsError } = await adminClient.from("invoice_items").insert(itemsPayload);

  if (itemsError) {
    return { success: false, error: itemsError.message };
  }

  revalidatePath("/invoices");
  revalidatePath("/products");
  revalidatePath("/customers");

  return { success: true, message: "Invoice updated" };
}

export async function approveInvoice(invoiceId: string, notificationId?: string): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!isAdminOrManager(access.profile)) {
    return { success: false, error: "Only admins and managers can approve invoices" };
  }

  if (!invoiceId) {
    return { success: false, error: "Invoice id is required" };
  }

  const { data: invoice, error: invoiceError } = await adminClient
    .from("invoices")
    .select("id, invoice_number, invoice_kind, issued_by, status, customer_id, payment_method, total_amount")
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    return { success: false, error: invoiceError?.message || "Invoice not found" };
  }

  if (invoice.status !== "pending_approval") {
    return { success: false, error: "Invoice is already reviewed" };
  }

  const { data: invoiceItems, error: itemsError } = await adminClient
    .from("invoice_items")
    .select("product_id, qty, free_qty, unit_price")
    .eq("invoice_id", invoiceId);

  if (itemsError) {
    return { success: false, error: itemsError.message };
  }

  const qtyByProduct = new Map<string, number>();
  const qtyByProductAndPrice = new Map<string, { productId: string; priceKey: string; requestedQty: number }>();
  for (const item of invoiceItems ?? []) {
    const current = qtyByProduct.get(item.product_id) ?? 0;
    const requestedQty = (Number(item.qty) || 0) + (Number(item.free_qty) || 0);
    qtyByProduct.set(item.product_id, current + requestedQty);

    const priceKey = toPriceKey(item.unit_price);
    const bucketKey = `${item.product_id}::${priceKey}`;
    const bucket = qtyByProductAndPrice.get(bucketKey) ?? {
      productId: item.product_id,
      priceKey,
      requestedQty: 0
    };
    bucket.requestedQty += requestedQty;
    qtyByProductAndPrice.set(bucketKey, bucket);
  }

  const productIds = Array.from(qtyByProduct.keys());
  if (productIds.length === 0) {
    return { success: false, error: "Invoice has no items to approve" };
  }

  const { data: products, error: productError } = await adminClient
    .from("products")
    .select("id, name, stock_qty")
    .in("id", productIds);

  if (productError) {
    return { success: false, error: productError.message };
  }

  if (!products || products.length !== productIds.length) {
    return { success: false, error: "One or more products are missing for this invoice." };
  }

  const { data: receivedRows, error: receivedError } = await adminClient
    .from("receive_note_items")
    .select("product_id, selling_price, qty, free_qty")
    .in("product_id", productIds);

  if (receivedError) {
    return { success: false, error: receivedError.message };
  }

  const { data: soldRows, error: soldError } = await adminClient
    .from("invoice_items")
    .select("product_id, unit_price, qty, free_qty, invoice:invoices!inner(status)")
    .in("product_id", productIds)
    .in("invoice.status", ["approved", "issued", "paid"]);

  if (soldError) {
    return { success: false, error: soldError.message };
  }

  const availableByProductAndPrice = new Map<string, number>();
  for (const row of receivedRows ?? []) {
    const productId = String((row as any).product_id || "");
    const priceKey = toPriceKey((row as any).selling_price);
    if (!productId || !priceKey) continue;
    const key = `${productId}::${priceKey}`;
    const receivedQty = (Number((row as any).qty) || 0) + (Number((row as any).free_qty) || 0);
    availableByProductAndPrice.set(key, (availableByProductAndPrice.get(key) ?? 0) + receivedQty);
  }

  for (const row of soldRows ?? []) {
    const productId = String((row as any).product_id || "");
    const priceKey = toPriceKey((row as any).unit_price);
    if (!productId || !priceKey) continue;
    const key = `${productId}::${priceKey}`;
    const soldQty = (Number((row as any).qty) || 0) + (Number((row as any).free_qty) || 0);
    availableByProductAndPrice.set(key, Math.max(0, (availableByProductAndPrice.get(key) ?? 0) - soldQty));
  }

  const productNameById = new Map((products ?? []).map((product) => [String(product.id), String(product.name)]));
  const stockErrors: string[] = [];
  for (const bucket of qtyByProductAndPrice.values()) {
    const bucketKey = `${bucket.productId}::${bucket.priceKey}`;
    const availableQty = availableByProductAndPrice.get(bucketKey) ?? 0;
    if (bucket.requestedQty > availableQty) {
      const productName = productNameById.get(bucket.productId) ?? "Unknown Product";
      stockErrors.push(
        `${productName} at LKR ${Number(bucket.priceKey).toLocaleString(undefined, { minimumFractionDigits: 2 })}: requested ${bucket.requestedQty}, available ${availableQty}`
      );
    }
  }

  if (stockErrors.length > 0) {
    return {
      success: false,
      error: `Approval blocked. Reduce these item quantities to available stock before approving: ${stockErrors.join("; ")}.`
    };
  }

  if (invoice.invoice_kind === "invoice" && isOutstandingInvoicePaymentMethod(invoice.payment_method)) {
    const creditValidation = await validateCustomerCreditLimit(invoice.customer_id, Number(invoice.total_amount));
    if (!creditValidation.success) return creditValidation;
  }

  const { error: updateError } = await adminClient
    .from("invoices")
    .update({
      status: "approved",
      approved_by: access.profile.id,
      approved_at: new Date().toISOString(),
      rejected_by: null,
      rejected_at: null
    })
    .eq("id", invoiceId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  try {
    for (const product of products ?? []) {
      const requestedQty = qtyByProduct.get(product.id) ?? 0;
      const nextStock = Math.max(0, Number(product.stock_qty) - requestedQty);
      await adminClient.from("products").update({ stock_qty: nextStock }).eq("id", product.id);
    }
  } catch (err) {
    console.error("Failed to update stock after invoice approval", err);
  }

  if (isOutstandingInvoicePaymentMethod(invoice.payment_method)) {
    try {
      const { data: customer, error: customerError } = await adminClient
        .from("customers")
        .select("balance")
        .eq("id", invoice.customer_id)
        .single();

      if (customer && !customerError) {
        const newBalance = Number(customer.balance) + Number(invoice.total_amount);
        await adminClient.from("customers").update({ balance: newBalance }).eq("id", invoice.customer_id);
      }
    } catch (err) {
      console.error("Failed to update customer balance after invoice approval", err);
    }
  }

  if (notificationId) {
    await adminClient
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq("id", notificationId)
      .eq("recipient_id", access.profile.id);
  }

  await adminClient
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString()
    })
    .eq("invoice_id", invoiceId)
    .eq("type", "invoice_approval_request");

  await notifyInvoiceRequester(
    invoiceId,
    Number(invoice.invoice_number),
    invoice.issued_by,
    access.profile,
    "approved"
  );

  revalidatePath("/invoices");
  revalidatePath("/products");
  revalidatePath("/customers");
  revalidatePath("/notifications");

  return { success: true, message: "Invoice approved" };
}

export async function rejectInvoice(invoiceId: string, notificationId?: string): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!isAdminOrManager(access.profile)) {
    return { success: false, error: "Only admins and managers can reject invoices" };
  }

  if (!invoiceId) {
    return { success: false, error: "Invoice id is required" };
  }

  const { data: invoice, error: invoiceError } = await adminClient
    .from("invoices")
    .select("id, invoice_number, issued_by, status")
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    return { success: false, error: invoiceError?.message || "Invoice not found" };
  }

  if (invoice.status !== "pending_approval") {
    return { success: false, error: "Invoice is already reviewed" };
  }

  const { error: updateError } = await adminClient
    .from("invoices")
    .update({
      status: "rejected",
      rejected_by: access.profile.id,
      rejected_at: new Date().toISOString(),
      approved_by: null,
      approved_at: null
    })
    .eq("id", invoiceId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  if (notificationId) {
    await adminClient
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq("id", notificationId)
      .eq("recipient_id", access.profile.id);
  }

  await adminClient
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString()
    })
    .eq("invoice_id", invoiceId)
    .eq("type", "invoice_approval_request");

  await notifyInvoiceRequester(
    invoiceId,
    Number(invoice.invoice_number),
    invoice.issued_by,
    access.profile,
    "rejected"
  );

  revalidatePath("/invoices");
  revalidatePath("/notifications");

  return { success: true, message: "Invoice rejected" };
}

export async function deleteInvoice(invoiceId: string): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  const isAdminOrManager = access.profile.role === "admin" || access.profile.role === "manager";
  if (!isAdminOrManager) {
    return { success: false, error: "You do not have permission to delete invoices" };
  }

  if (!invoiceId) {
    return { success: false, error: "Invoice id is required" };
  }

  const { data: invoice, error: invoiceError } = await adminClient
    .from("invoices")
    .select("id, invoice_number, invoice_kind, status, total_amount, payment_method, customer_id, invoice_items(product_id, qty, free_qty)")
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    return { success: false, error: invoiceError?.message || "Invoice not found" };
  }

  const { error } = await adminClient.from("invoices").delete().eq("id", invoiceId);

  if (error) {
    return { success: false, error: error.message };
  }

  if (invoice.status === "approved" || invoice.status === "paid" || invoice.status === "issued") {
    // Restore stock
    try {
      for (const item of invoice.invoice_items || []) {
        const qty = Number(item.qty) || 0;
        const freeQty = Number(item.free_qty) || 0;
        const restoreQty = qty + freeQty;
        const { data: product, error: productError } = await adminClient
          .from("products")
          .select("stock_qty")
          .eq("id", item.product_id)
          .single();

        if (product && !productError) {
          const stockBefore = Number(product.stock_qty) || 0;
          const newStock = stockBefore + restoreQty;
          await adminClient.from("products").update({ stock_qty: newStock }).eq("id", item.product_id);
          await adminClient.from("audit_log").insert({
            table_name: "invoice_cancellations",
            record_id: item.product_id,
            action: "stock_restored",
            performed_by: access.profile.id,
            old_data: {
              invoice_id: invoice.id,
              invoice_number: Number(invoice.invoice_number),
              qty,
              free_qty: freeQty,
              stock_before: stockBefore
            },
            new_data: {
              stock_after: newStock,
              restored_qty: restoreQty
            }
          });
        }
      }
    } catch (err) {
      console.error("Failed to restore stock after invoice deletion", err);
    }

    // Restore customer balance for invoices tracked through collections.
    if (isOutstandingInvoicePaymentMethod(invoice.payment_method)) {
      try {
        const { data: customer, error: customerError } = await adminClient
          .from("customers")
          .select("balance")
          .eq("id", invoice.customer_id)
          .single();

        if (customer && !customerError) {
          const newBalance = Math.max(0, Number(customer.balance) - Number(invoice.total_amount));
          await adminClient.from("customers").update({ balance: newBalance }).eq("id", invoice.customer_id);
        }
      } catch (err) {
        console.error("Failed to restore customer balance", err);
      }
    }
  }

  revalidatePath("/invoices");
  revalidatePath("/products");
  revalidatePath("/customers");

  return { success: true, message: "Invoice deleted successfully" };
}

export async function listReturnableInvoices(): Promise<{ success: boolean; data?: ReturnableInvoiceRow[]; error?: string }> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!isAdminOrManager(access.profile)) {
    return { success: false, error: "Only admins and managers can create return invoices" };
  }

  const { data: invoices, error } = await adminClient
    .from("invoices")
    .select(`
      id, invoice_number, customer_id, payment_method, created_at,
      customer:customers(name),
      invoice_items(
        id, product_id, qty, free_qty, unit_price, discount_type, discount_value,
        product:products(name, unit)
      )
    `)
    .in("status", ["approved", "issued", "paid"])
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) return { success: false, error: error.message };

  const invoiceRows = (invoices ?? []) as any[];
  const allInvoiceItemIds = invoiceRows.flatMap((inv) => (inv.invoice_items ?? []).map((item: any) => item.id));

  let returnedByItem: Record<string, number> = {};
  if (allInvoiceItemIds.length > 0) {
    const { data: returnedRows, error: returnedError } = await adminClient
      .from("return_invoice_items")
      .select("invoice_item_id, qty")
      .in("invoice_item_id", allInvoiceItemIds);

    if (returnedError) return { success: false, error: returnedError.message };

    returnedByItem = (returnedRows ?? []).reduce<Record<string, number>>((acc, row: any) => {
      const key = String(row.invoice_item_id);
      acc[key] = (acc[key] ?? 0) + (Number(row.qty) || 0);
      return acc;
    }, {});
  }

  const rows: ReturnableInvoiceRow[] = invoiceRows
    .map((invoice): ReturnableInvoiceRow => {
      const customer = Array.isArray(invoice.customer) ? invoice.customer[0] : invoice.customer;
      const items = (invoice.invoice_items ?? []).map((item: any) => {
        const soldQty = Number(item.qty) || 0;
        const alreadyReturned = returnedByItem[item.id] ?? 0;
        const returnableQty = Math.max(0, soldQty - alreadyReturned);
        return {
          invoice_item_id: item.id,
          product_id: item.product_id,
          product_name: item.product?.name ?? "Unknown Product",
          product_unit: item.product?.unit ?? "",
          qty: soldQty,
          free_qty: Number(item.free_qty) || 0,
          unit_price: Number(item.unit_price) || 0,
          discount_type: item.discount_type === "percent" ? "percent" : "amount",
          discount_value: Number(item.discount_value) || 0,
          already_returned_qty: alreadyReturned,
          returnable_qty: returnableQty
        };
      });

      return {
        id: invoice.id,
        invoice_number: Number(invoice.invoice_number),
        customer_id: invoice.customer_id,
        customer_name: customer?.name ?? "Unknown Customer",
        payment_method: isValidInvoicePaymentMethod(invoice.payment_method) ? invoice.payment_method : "credit",
        created_at: invoice.created_at,
        items
      };
    })
    .filter((row) => row.items.some((item: ReturnableInvoiceRow["items"][number]) => item.returnable_qty > 0));

  return { success: true, data: rows };
}

export async function createReturnInvoice(input: CreateReturnInvoiceInput): Promise<ReturnActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!isAdminOrManager(access.profile)) {
    return { success: false, error: "Only admins and managers can create return invoices" };
  }

  if (!input.invoice_id) {
    return { success: false, error: "Source invoice is required" };
  }

  const normalizedItems = (input.items ?? [])
    .map((item) => ({ invoice_item_id: item.invoice_item_id, qty: Number(item.qty) }))
    .filter((item) => item.invoice_item_id && Number.isFinite(item.qty) && item.qty > 0);

  if (normalizedItems.length === 0) {
    return { success: false, error: "Select at least one item quantity to return" };
  }

  const { data: sourceInvoice, error: sourceInvoiceError } = await adminClient
    .from("invoices")
    .select(`
      id, invoice_number, customer_id, payment_method, status,
      invoice_items(id, product_id, qty, unit_price, discount_type, discount_value)
    `)
    .eq("id", input.invoice_id)
    .single();

  if (sourceInvoiceError || !sourceInvoice) {
    return { success: false, error: sourceInvoiceError?.message || "Source invoice not found" };
  }

  if (!["approved", "issued", "paid"].includes(sourceInvoice.status)) {
    return { success: false, error: "Only approved/paid invoices can be returned" };
  }

  const sourceItems = ((sourceInvoice as any).invoice_items ?? []) as any[];
  const sourceItemMap = new Map<string, any>(sourceItems.map((item: any) => [String(item.id), item]));
  const requestedItemIds = normalizedItems.map((item) => item.invoice_item_id);

  const { data: returnedRows, error: returnedError } = await adminClient
    .from("return_invoice_items")
    .select("invoice_item_id, qty")
    .in("invoice_item_id", requestedItemIds);

  if (returnedError) {
    return { success: false, error: returnedError.message };
  }

  const returnedByItem = (returnedRows ?? []).reduce<Record<string, number>>((acc, row: any) => {
    const key = String(row.invoice_item_id);
    acc[key] = (acc[key] ?? 0) + (Number(row.qty) || 0);
    return acc;
  }, {});

  let totalReturnAmount = 0;
  const validatedItems = normalizedItems.map((item) => {
    const sourceItem = sourceItemMap.get(item.invoice_item_id);
    if (!sourceItem) {
      throw new Error("One or more selected items are invalid");
    }

    const soldQty = Number(sourceItem.qty) || 0;
    const alreadyReturned = returnedByItem[item.invoice_item_id] ?? 0;
    const returnableQty = Math.max(0, soldQty - alreadyReturned);

    if (item.qty > returnableQty) {
      throw new Error("Return quantity exceeds available sold quantity");
    }

    const unitPrice = Number(sourceItem.unit_price) || 0;
    const discountType = sourceItem.discount_type === "percent" ? "percent" : "amount";
    const discountValue = Number(sourceItem.discount_value) || 0;
    const effectiveUnitPrice = Math.max(0, unitPrice - getDiscountPerUnit(unitPrice, discountType, discountValue));
    const lineTotal = item.qty * effectiveUnitPrice;
    totalReturnAmount += lineTotal;

    return {
      invoice_item_id: item.invoice_item_id,
      product_id: sourceItem.product_id,
      qty: item.qty,
      unit_price: effectiveUnitPrice
    };
  });

  let insertedReturnInvoiceId = "";
  try {
    const { data: returnInvoice, error: insertReturnError } = await adminClient
      .from("return_invoices")
      .insert({
        invoice_id: sourceInvoice.id,
        customer_id: sourceInvoice.customer_id,
        returned_by: access.profile.id,
        total_return_amount: totalReturnAmount,
        notes: input.notes?.trim() || null
      })
      .select("id")
      .single();

    if (insertReturnError || !returnInvoice) {
      return { success: false, error: insertReturnError?.message || "Failed to create return invoice" };
    }

    insertedReturnInvoiceId = returnInvoice.id;

    const returnItemsPayload = validatedItems.map((item) => ({
      return_invoice_id: returnInvoice.id,
      invoice_item_id: item.invoice_item_id,
      product_id: item.product_id,
      qty: item.qty,
      unit_price: item.unit_price
    }));

    const { error: insertItemsError } = await adminClient.from("return_invoice_items").insert(returnItemsPayload);
    if (insertItemsError) {
      return { success: false, error: insertItemsError.message };
    }

    for (const item of validatedItems) {
      const { data: product, error: productError } = await adminClient
        .from("products")
        .select("stock_qty")
        .eq("id", item.product_id)
        .single();

      if (productError || !product) continue;
      const newStock = (Number(product.stock_qty) || 0) + item.qty;
      await adminClient.from("products").update({ stock_qty: newStock }).eq("id", item.product_id);
    }

    if (isOutstandingInvoicePaymentMethod(sourceInvoice.payment_method)) {
      const { data: customer, error: customerError } = await adminClient
        .from("customers")
        .select("balance")
        .eq("id", sourceInvoice.customer_id)
        .single();
      if (!customerError && customer) {
        const newBalance = Math.max(0, (Number(customer.balance) || 0) - totalReturnAmount);
        await adminClient.from("customers").update({ balance: newBalance }).eq("id", sourceInvoice.customer_id);
      }
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create return invoice" };
  }

  revalidatePath("/invoices");
  revalidatePath("/invoices/return");
  revalidatePath("/products");
  revalidatePath("/customers");

  return {
    success: true,
    message: "Return invoice saved successfully",
    return_invoice_id: insertedReturnInvoiceId
  };
}

export async function getReturnInvoiceDetail(
  returnInvoiceId: string
): Promise<{ success: boolean; data?: ReturnInvoiceDetailRow | null; error?: string }> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!isAdminOrManager(access.profile)) {
    return { success: false, error: "Only admins and managers can view return invoices" };
  }

  const { data, error } = await adminClient
    .from("return_invoices")
    .select(`
      id, return_number, created_at, notes, total_return_amount, invoice_id,
      source_invoice:invoices!return_invoices_invoice_id_fkey(invoice_number),
      customer:customers(name, phone, address),
      returned_by_user:users_profile!return_invoices_returned_by_fkey(full_name),
      return_invoice_items(
        id, qty, unit_price,
        product:products(name, unit)
      )
    `)
    .eq("id", returnInvoiceId)
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: true, data: null };

  const sourceInvoice = Array.isArray((data as any).source_invoice)
    ? (data as any).source_invoice[0]
    : (data as any).source_invoice;
  const customer = Array.isArray((data as any).customer) ? (data as any).customer[0] : (data as any).customer;
  const returnedBy = Array.isArray((data as any).returned_by_user)
    ? (data as any).returned_by_user[0]
    : (data as any).returned_by_user;

  const result: ReturnInvoiceDetailRow = {
    id: (data as any).id,
    return_number: Number((data as any).return_number),
    created_at: (data as any).created_at,
    notes: (data as any).notes ?? null,
    total_return_amount: Number((data as any).total_return_amount) || 0,
    customer_name: customer?.name ?? "Unknown Customer",
    customer_phone: customer?.phone ?? "",
    customer_address: customer?.address ?? "",
    source_invoice_id: (data as any).invoice_id,
    source_invoice_number: Number(sourceInvoice?.invoice_number) || 0,
    returned_by_name: returnedBy?.full_name ?? "Unknown",
    items: ((data as any).return_invoice_items ?? []).map((item: any) => {
      const qty = Number(item.qty) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      return {
        id: item.id,
        product_name: item.product?.name ?? "Unknown Product",
        product_unit: item.product?.unit ?? "",
        qty,
        unit_price: unitPrice,
        line_total: qty * unitPrice
      };
    })
  };

  return { success: true, data: result };
}

export async function listReturnInvoices(): Promise<{ success: boolean; data?: ReturnInvoiceListRow[]; error?: string }> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!isAdminOrManager(access.profile)) {
    return { success: false, error: "Only admins and managers can view return invoices" };
  }

  const { data, error } = await adminClient
    .from("return_invoices")
    .select(`
      id, return_number, created_at, total_return_amount,
      source_invoice:invoices!return_invoices_invoice_id_fkey(invoice_number),
      customer:customers(name),
      returned_by_user:users_profile!return_invoices_returned_by_fkey(full_name)
    `)
    .order("return_number", { ascending: false });

  if (error) return { success: false, error: error.message };

  const rows: ReturnInvoiceListRow[] = (data ?? []).map((row: any) => {
    const sourceInvoice = Array.isArray(row.source_invoice) ? row.source_invoice[0] : row.source_invoice;
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    const returnedBy = Array.isArray(row.returned_by_user) ? row.returned_by_user[0] : row.returned_by_user;
    return {
      id: String(row.id),
      return_number: Number(row.return_number) || 0,
      created_at: String(row.created_at),
      total_return_amount: Number(row.total_return_amount) || 0,
      customer_name: customer?.name ?? "Unknown Customer",
      source_invoice_number: Number(sourceInvoice?.invoice_number) || 0,
      returned_by_name: returnedBy?.full_name ?? "Unknown"
    };
  });

  return { success: true, data: rows };
}

export async function getCancelledInvoiceReport(
  invoiceId: string
): Promise<{ success: boolean; data?: CancelledInvoiceReportRow | null; error?: string }> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canCreateInvoices(access.profile)) {
    return { success: false, error: "You do not have permission to view invoices" };
  }

  if (!invoiceId) {
    return { success: false, error: "Invoice id is required" };
  }

  const { data: rows, error } = await adminClient
    .from("audit_log")
    .select(
      "id, record_id, performed_by, created_at, old_data, new_data, performer:users_profile!audit_log_performed_by_fkey(full_name)"
    )
    .eq("table_name", "invoice_cancellations")
    .contains("old_data", { invoice_id: invoiceId })
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  if (!rows || rows.length === 0) return { success: true, data: null };

  const productIds = Array.from(new Set(rows.map((row: any) => String(row.record_id)).filter(Boolean)));
  let productNamesById: Record<string, string> = {};
  if (productIds.length > 0) {
    const { data: products } = await adminClient.from("products").select("id, name").in("id", productIds);
    productNamesById = (products ?? []).reduce<Record<string, string>>((acc, row: any) => {
      acc[String(row.id)] = row.name ?? "Unknown Product";
      return acc;
    }, {});
  }

  const first = rows[0] as any;
  const invoiceNumber = Number(first.old_data?.invoice_number) || 0;
  const cancelledAt = String(first.created_at || "");
  const performer = Array.isArray(first.performer) ? first.performer[0] : first.performer;

  const items = (rows as any[]).map((row) => {
    const qty = Number(row.old_data?.qty) || 0;
    const freeQty = Number(row.old_data?.free_qty) || 0;
    const stockBefore = Number(row.old_data?.stock_before) || 0;
    const stockAfter = Number(row.new_data?.stock_after) || 0;
    return {
      audit_id: row.id,
      product_id: String(row.record_id),
      product_name: productNamesById[String(row.record_id)] ?? "Unknown Product",
      qty,
      free_qty: freeQty,
      restored_qty: qty + freeQty,
      stock_before: stockBefore,
      stock_after: stockAfter
    };
  });

  return {
    success: true,
    data: {
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      cancelled_at: cancelledAt,
      cancelled_by_name: performer?.full_name ?? "Unknown",
      items
    }
  };
}
