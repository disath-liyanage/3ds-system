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
  perm_manage_customers: boolean;
};

type ProfilePermissionRow = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  custom_role: CustomRolePermissionSummary | CustomRolePermissionSummary[] | null;
};

export type CreateCustomerInput = {
  name: string;
  phone: string;
  address: string;
  area?: string | null;
  credit_limit?: number;
  sales_rep_id?: string;
};

export type UpdateCustomerInput = CreateCustomerInput;

export type CustomerDetailRow = {
  id: string;
  name: string;
  phone: string;
  address: string;
  area: string | null;
  credit_limit: number;
  balance: number;
  status: "pending_approval" | "active" | "rejected";
  created_by: string | null;
  created_by_name: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  sales_rep_id: string | null;
  sales_rep_name: string | null;
  created_at: string;
};

export type CustomerInvoiceRow = {
  id: string;
  invoice_number: number;
  total_amount: number;
  payment_method: string;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "issued" | "paid";
  created_at: string;
  collected_total: number;
  remaining_amount: number;
  payment_status: "unpaid" | "partially_paid" | "paid";
};

export type CustomerDetailData = {
  customer: CustomerDetailRow;
  outstanding_invoices: CustomerInvoiceRow[];
  current_month_invoices: CustomerInvoiceRow[];
};

function isOutstandingInvoicePaymentMethod(value: string | null | undefined): boolean {
  return value === "credit" || value === "on_account";
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

  const { data: profile } = await adminClient
    .from("users_profile")
    .select("id, email, role, full_name, custom_role:custom_roles(perm_manage_customers)")
    .eq("id", user.id)
    .maybeSingle<ProfilePermissionRow>();

  if (!profile) {
    return { error: "Profile not found" as const };
  }

  return { profile };
}

function canAddCustomers(profile: ProfilePermissionRow): boolean {
  const roleRelation = profile.custom_role;
  const customRole = Array.isArray(roleRelation) ? roleRelation[0] || null : roleRelation;

  return (
    profile.role === "admin" ||
    profile.role === "manager" ||
    profile.role === "sales_rep" ||
    Boolean(customRole?.perm_manage_customers)
  );
}

export async function getSalesReps(): Promise<{ id: string; full_name: string }[]> {
  const { data, error } = await adminClient
    .from("users_profile")
    .select("id, full_name")
    .eq("role", "sales_rep")
    .order("full_name");

  if (error) {
    console.error("Failed to fetch sales reps:", error);
    return [];
  }
  return data || [];
}

export async function getAreas(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await adminClient.from("areas").select("id, name").order("name");

  if (error) {
    console.error("Failed to fetch areas:", error);
    return [];
  }
  return data || [];
}

export async function getCustomerDetail(customerId: string): Promise<{
  success: boolean;
  data?: CustomerDetailData | null;
  error?: string;
}> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!customerId) {
    return { success: false, error: "Customer id is required" };
  }

  const { data: customerRow, error: customerError } = await adminClient
    .from("customers")
    .select("id, name, phone, address, area, credit_limit, balance, status, created_by, approved_by, approved_at, sales_rep_id, created_at")
    .eq("id", customerId)
    .maybeSingle();

  if (customerError) return { success: false, error: customerError.message };
  if (!customerRow) return { success: true, data: null };

  const profileIds = [
    customerRow.sales_rep_id,
    customerRow.created_by,
    customerRow.approved_by
  ].filter(Boolean) as string[];
  const profileNames = new Map<string, string | null>();
  if (profileIds.length > 0) {
    const { data: profiles } = await adminClient
      .from("users_profile")
      .select("id, full_name")
      .in("id", Array.from(new Set(profileIds)));
    for (const profile of profiles ?? []) {
      profileNames.set(String(profile.id), profile.full_name ?? null);
    }
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const { data: invoiceRows, error: invoicesError } = await adminClient
    .from("invoices")
    .select("id, invoice_number, total_amount, payment_method, status, created_at, is_settled")
    .eq("customer_id", customerId)
    .eq("invoice_kind", "invoice")
    .order("created_at", { ascending: false });

  if (invoicesError) return { success: false, error: invoicesError.message };

  const invoiceIds = (invoiceRows ?? []).map((row: any) => String(row.id)).filter(Boolean);
  const collectionTotals = new Map<string, number>();
  if (invoiceIds.length > 0) {
    const { data: collections, error: collectionsError } = await adminClient
      .from("collections")
      .select("invoice_id, amount, status")
      .in("invoice_id", invoiceIds);
    if (collectionsError) return { success: false, error: collectionsError.message };

    for (const entry of collections ?? []) {
      if (entry.status === "rejected") continue;
      const invoiceKey = String(entry.invoice_id || "");
      if (!invoiceKey) continue;
      collectionTotals.set(invoiceKey, (collectionTotals.get(invoiceKey) ?? 0) + Number(entry.amount || 0));
    }
  }

  const invoices: CustomerInvoiceRow[] = (invoiceRows ?? []).map((row: any) => {
    const totalAmount = Number(row.total_amount) || 0;
    const collectedTotal = collectionTotals.get(String(row.id)) ?? 0;
    const remainingAmount = Math.max(0, totalAmount - collectedTotal);
    const isSettled = Boolean(row.is_settled) || remainingAmount <= 0 || row.status === "paid";
    const paymentStatus: CustomerInvoiceRow["payment_status"] = isSettled
      ? "paid"
      : collectedTotal > 0
        ? "partially_paid"
        : "unpaid";

    return {
      id: String(row.id),
      invoice_number: Number(row.invoice_number) || 0,
      total_amount: totalAmount,
      payment_method: String(row.payment_method || ""),
      status: row.status,
      created_at: String(row.created_at || ""),
      collected_total: collectedTotal,
      remaining_amount: remainingAmount,
      payment_status: paymentStatus
    };
  });

  const outstandingInvoices = invoices.filter(
    (invoice) =>
      isOutstandingInvoicePaymentMethod(invoice.payment_method) &&
      ["approved", "issued", "paid"].includes(invoice.status) &&
      invoice.remaining_amount > 0
  );

  const currentMonthInvoices = invoices.filter((invoice) => {
    const issuedAt = new Date(invoice.created_at);
    return issuedAt >= monthStart && issuedAt < nextMonthStart;
  });

  return {
    success: true,
    data: {
      customer: {
        id: String(customerRow.id),
        name: String(customerRow.name || ""),
        phone: String(customerRow.phone || ""),
        address: String(customerRow.address || ""),
        area: customerRow.area ?? null,
        credit_limit: Number(customerRow.credit_limit) || 0,
        balance: Number(customerRow.balance) || 0,
        status: customerRow.status,
        created_by: customerRow.created_by ?? null,
        created_by_name: customerRow.created_by ? profileNames.get(customerRow.created_by) ?? null : null,
        approved_by: customerRow.approved_by ?? null,
        approved_by_name: customerRow.approved_by ? profileNames.get(customerRow.approved_by) ?? null : null,
        approved_at: customerRow.approved_at ?? null,
        sales_rep_id: customerRow.sales_rep_id ?? null,
        sales_rep_name: customerRow.sales_rep_id ? profileNames.get(customerRow.sales_rep_id) ?? null : null,
        created_at: String(customerRow.created_at || "")
      },
      outstanding_invoices: outstandingInvoices,
      current_month_invoices: currentMonthInvoices
    }
  };
}

export async function createArea(name: string): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (access.profile.role !== "admin" && access.profile.role !== "manager") {
    return { success: false, error: "Only admins and managers can add areas" };
  }

  const areaName = name.trim();
  if (!areaName) {
    return { success: false, error: "Area name is required" };
  }

  const { error } = await adminClient.from("areas").insert({ name: areaName });
  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Area already exists." };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/customers");
  return { success: true, message: "Area added successfully." };
}

export async function getCollectionRecipients(): Promise<{ id: string; full_name: string; role: UserRole }[]> {
  const { data: salesReps, error: salesError } = await adminClient
    .from("users_profile")
    .select("id, full_name, role")
    .eq("role", "sales_rep")
    .order("full_name");

  if (salesError) {
    console.error("Failed to fetch sales reps:", salesError);
  }

  let drivers: { id: string; full_name: string; role: UserRole }[] = [];
  const { data: driverRows, error: driverError } = await adminClient
    .from("users_profile")
    .select("id, full_name, role")
    .eq("role", "driver")
    .order("full_name");

  if (driverError) {
    console.error("Failed to fetch drivers:", driverError);
  } else {
    drivers = (driverRows || []) as { id: string; full_name: string; role: UserRole }[];
  }

  const recipients = [...(salesReps || []), ...drivers] as { id: string; full_name: string; role: UserRole }[];
  return recipients;
}

export async function createCustomer(input: CreateCustomerInput): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canAddCustomers(access.profile)) {
    return { success: false, error: "You do not have permission to add customers" };
  }

  const name = input.name.trim();
  const phone = input.phone.trim();
  const address = input.address.trim();
  const area = input.area?.trim() || null;
  const creditLimit = Number(input.credit_limit ?? 0);

  if (!name || !phone || !address) {
    return { success: false, error: "Name, phone, and address are required" };
  }

  if (!Number.isFinite(creditLimit) || creditLimit < 0) {
    return { success: false, error: "Credit limit must be a valid non-negative number" };
  }

  const isSalesRep = access.profile.role === "sales_rep";
  const status = isSalesRep ? "pending_approval" : "active";
  
  const sales_rep_id = isSalesRep ? access.profile.id : input.sales_rep_id;
  if (!isSalesRep && !sales_rep_id) {
    return { success: false, error: "Sales rep selection is required" };
  }

  const { data: insertedCustomer, error: customerError } = await adminClient
    .from("customers")
    .insert({
      name,
      phone,
      address,
      area,
      credit_limit: creditLimit,
      balance: 0,
      status,
      created_by: access.profile.id,
      sales_rep_id
    })
    .select("id, name")
    .single();

  if (customerError || !insertedCustomer) {
    return { success: false, error: customerError?.message || "Failed to create customer" };
  }

  if (status === "pending_approval") {
    const { data: approvers, error: approverError } = await adminClient
      .from("users_profile")
      .select("id")
      .in("role", ["admin", "manager"]);

    if (approverError) {
      return { success: false, error: approverError.message };
    }

    if (approvers && approvers.length > 0) {
      const notifications = approvers.map((approver) => ({
        recipient_id: approver.id,
        title: "Customer approval request",
        message: `${access.profile.full_name || access.profile.email} requested approval for customer "${insertedCustomer.name}".`,
        type: "customer_approval_request",
        customer_id: insertedCustomer.id,
        created_by: access.profile.id
      }));

      const { error: notificationError } = await adminClient.from("notifications").insert(notifications);
      if (notificationError) {
        return { success: false, error: notificationError.message };
      }
    }
  }

  revalidatePath("/customers");
  revalidatePath("/notifications");

  return {
    success: true,
    message:
      status === "pending_approval"
        ? "Customer request submitted. Admins and managers were notified for approval."
        : "Customer created successfully."
  };
}

export async function approvePendingCustomer(customerId: string, notificationId?: string): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (access.profile.role !== "admin" && access.profile.role !== "manager") {
    return { success: false, error: "Only admins and managers can approve customers" };
  }

  if (!customerId) {
    return { success: false, error: "Missing customer id" };
  }

  const { data: customer, error: customerError } = await adminClient
    .from("customers")
    .select("id, name, status, created_by")
    .eq("id", customerId)
    .maybeSingle();

  if (customerError || !customer) {
    return { success: false, error: customerError?.message || "Customer not found" };
  }

  if (customer.status !== "pending_approval") {
    return { success: false, error: "Customer is already reviewed" };
  }

  const { error: updateCustomerError } = await adminClient
    .from("customers")
    .update({
      status: "active",
      approved_by: access.profile.id,
      approved_at: new Date().toISOString()
    })
    .eq("id", customerId);

  if (updateCustomerError) {
    return { success: false, error: updateCustomerError.message };
  }

  if (notificationId) {
    const { error: markCurrentError } = await adminClient
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq("id", notificationId)
      .eq("recipient_id", access.profile.id);

    if (markCurrentError) {
      return { success: false, error: markCurrentError.message };
    }
  }

  await adminClient
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString()
    })
    .eq("customer_id", customerId)
    .eq("type", "customer_approval_request");

  if (customer.created_by) {
    await adminClient.from("notifications").insert({
      recipient_id: customer.created_by,
      title: "Customer request approved",
      message: `Your customer request "${customer.name}" has been approved.`,
      type: "customer_approval_result",
      customer_id: customer.id,
      created_by: access.profile.id
    });
  }

  revalidatePath("/customers");
  revalidatePath("/notifications");

  return { success: true, message: "Customer approved successfully." };
}

export async function removePendingCustomer(customerId: string, notificationId?: string): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (access.profile.role !== "admin" && access.profile.role !== "manager") {
    return { success: false, error: "Only admins and managers can remove pending customers" };
  }

  if (!customerId) {
    return { success: false, error: "Missing customer id" };
  }

  const { data: customer, error: customerError } = await adminClient
    .from("customers")
    .select("id, name, status, created_by")
    .eq("id", customerId)
    .maybeSingle();

  if (customerError || !customer) {
    return { success: false, error: customerError?.message || "Customer not found" };
  }

  if (customer.status !== "pending_approval") {
    return { success: false, error: "Only pending customers can be removed from review flow" };
  }

  await adminClient
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString()
    })
    .eq("customer_id", customerId)
    .eq("type", "customer_approval_request");

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

  const { error: deleteError } = await adminClient.from("customers").delete().eq("id", customerId);
  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  if (customer.created_by) {
    await adminClient.from("notifications").insert({
      recipient_id: customer.created_by,
      title: "Customer request removed",
      message: `Your customer request "${customer.name}" was removed by ${access.profile.full_name || access.profile.email}.`,
      type: "customer_approval_result",
      created_by: access.profile.id
    });
  }

  revalidatePath("/customers");
  revalidatePath("/notifications");
  return { success: true, message: "Pending customer removed." };
}

export async function updateCustomer(customerId: string, input: UpdateCustomerInput): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  const name = input.name.trim();
  const phone = input.phone.trim();
  const address = input.address.trim();
  const area = input.area?.trim() || null;
  const creditLimit = Number(input.credit_limit ?? 0);

  if (!name || !phone || !address) {
    return { success: false, error: "Name, phone, and address are required" };
  }

  if (!Number.isFinite(creditLimit) || creditLimit < 0) {
    return { success: false, error: "Credit limit must be a valid non-negative number" };
  }

  const { data: customer, error: customerError } = await adminClient
    .from("customers")
    .select("id, status, created_by")
    .eq("id", customerId)
    .maybeSingle();

  if (customerError || !customer) {
    return { success: false, error: customerError?.message || "Customer not found" };
  }

  const isAdminOrManager = access.profile.role === "admin" || access.profile.role === "manager";
  const isOwnPendingRequest =
    access.profile.role === "sales_rep" &&
    customer.created_by === access.profile.id &&
    customer.status === "pending_approval";

  if (!isAdminOrManager && !isOwnPendingRequest) {
    return { success: false, error: "You do not have permission to edit this customer" };
  }

  const updateData: any = {
    name,
    phone,
    address,
    area,
    credit_limit: creditLimit
  };

  if (isAdminOrManager && input.sales_rep_id) {
    updateData.sales_rep_id = input.sales_rep_id;
  }

  const { error: updateError } = await adminClient
    .from("customers")
    .update(updateData)
    .eq("id", customerId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  return { success: true, message: "Customer updated successfully." };
}

export async function deleteCustomer(customerId: string): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  const { data: customer, error: customerError } = await adminClient
    .from("customers")
    .select("id, name, status, created_by")
    .eq("id", customerId)
    .maybeSingle();

  if (customerError || !customer) {
    return { success: false, error: customerError?.message || "Customer not found" };
  }

  const isAdminOrManager = access.profile.role === "admin" || access.profile.role === "manager";
  const isOwnPendingRequest =
    access.profile.role === "sales_rep" &&
    customer.created_by === access.profile.id &&
    customer.status === "pending_approval";

  if (!isAdminOrManager && !isOwnPendingRequest) {
    return { success: false, error: "You do not have permission to delete this customer" };
  }

  const { error: deleteError } = await adminClient.from("customers").delete().eq("id", customerId);
  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  return { success: true, message: "Customer deleted successfully." };
}

export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!notificationId) {
    return { success: false, error: "Notification id is required" };
  }

  const { error } = await adminClient
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString()
    })
    .eq("id", notificationId)
    .eq("recipient_id", access.profile.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/notifications");
  return { success: true };
}
