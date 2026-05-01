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
  area: string;
  credit_limit?: number;
};

export type UpdateCustomerInput = CreateCustomerInput;

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

export async function createCustomer(input: CreateCustomerInput): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canAddCustomers(access.profile)) {
    return { success: false, error: "You do not have permission to add customers" };
  }

  const name = input.name.trim();
  const phone = input.phone.trim();
  const address = input.address.trim();
  const area = input.area.trim();
  const creditLimit = Number(input.credit_limit ?? 0);

  if (!name || !phone || !address || !area) {
    return { success: false, error: "Name, phone, address, and area are required" };
  }

  if (!Number.isFinite(creditLimit) || creditLimit < 0) {
    return { success: false, error: "Credit limit must be a valid non-negative number" };
  }

  const status = access.profile.role === "sales_rep" ? "pending_approval" : "active";

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
      created_by: access.profile.id
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
  const area = input.area.trim();
  const creditLimit = Number(input.credit_limit ?? 0);

  if (!name || !phone || !address || !area) {
    return { success: false, error: "Name, phone, address, and area are required" };
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

  const { error: updateError } = await adminClient
    .from("customers")
    .update({
      name,
      phone,
      address,
      area,
      credit_limit: creditLimit
    })
    .eq("id", customerId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath("/customers");
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
