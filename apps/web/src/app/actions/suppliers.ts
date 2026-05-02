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

export type CreateSupplierInput = {
  name: string;
  phone: string;
  address: string;
};

export type UpdateSupplierInput = CreateSupplierInput;

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

function canManageSuppliers(profile: ProfilePermissionRow): boolean {
  const roleRelation = profile.custom_role;
  const customRole = Array.isArray(roleRelation) ? roleRelation[0] || null : roleRelation;

  return profile.role === "admin" || profile.role === "manager" || Boolean(customRole?.perm_manage_receive_notes);
}

export async function createSupplier(input: CreateSupplierInput): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canManageSuppliers(access.profile)) {
    return { success: false, error: "You do not have permission to add suppliers" };
  }

  const name = input.name.trim();
  const phone = input.phone.trim();
  const address = input.address.trim();

  if (!name || !phone || !address) {
    return { success: false, error: "Supplier name, phone, and address are required" };
  }

  const { error: supplierError } = await adminClient.from("suppliers").insert({
    name,
    phone,
    address,
    created_by: access.profile.id
  });

  if (supplierError) {
    return { success: false, error: supplierError.message };
  }

  revalidatePath("/suppliers");

  return { success: true, message: "Supplier added successfully." };
}

export async function updateSupplier(supplierId: string, input: UpdateSupplierInput): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canManageSuppliers(access.profile)) {
    return { success: false, error: "You do not have permission to edit suppliers" };
  }

  if (!supplierId) {
    return { success: false, error: "Missing supplier id" };
  }

  const name = input.name.trim();
  const phone = input.phone.trim();
  const address = input.address.trim();

  if (!name || !phone || !address) {
    return { success: false, error: "Supplier name, phone, and address are required" };
  }

  const { error: updateError } = await adminClient
    .from("suppliers")
    .update({ name, phone, address })
    .eq("id", supplierId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath("/suppliers");

  return { success: true, message: "Supplier updated successfully." };
}
