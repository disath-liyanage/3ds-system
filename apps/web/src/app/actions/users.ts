"use server";

import { revalidatePath } from "next/cache";

import type { UserRole } from "@paintdist/shared";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ActionResult = {
  success: boolean;
  error?: string;
};

export type CustomRolePermissionKey =
  | "perm_create_orders"
  | "perm_approve_orders"
  | "perm_view_all_orders"
  | "perm_record_collections"
  | "perm_validate_collections"
  | "perm_manage_products"
  | "perm_manage_customers"
  | "perm_create_invoices"
  | "perm_manage_receive_notes"
  | "perm_view_reports"
  | "perm_export_reports"
  | "perm_manage_users"
  | "perm_view_users";

export const customRolePermissionKeys: CustomRolePermissionKey[] = [
  "perm_create_orders",
  "perm_approve_orders",
  "perm_view_all_orders",
  "perm_record_collections",
  "perm_validate_collections",
  "perm_manage_products",
  "perm_manage_customers",
  "perm_create_invoices",
  "perm_manage_receive_notes",
  "perm_view_reports",
  "perm_export_reports",
  "perm_manage_users",
  "perm_view_users"
];

export type CreateUserInput = {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  custom_role_id?: string;
};

export type UpdateUserInput = {
  full_name: string;
  phone?: string;
  role: UserRole;
  custom_role_id?: string;
  is_active: boolean;
};

export type CustomRoleInput = {
  name: string;
  description?: string;
} & Partial<Record<CustomRolePermissionKey, boolean>>;

async function requireAdmin() {
  const supabase = createClient();

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Unauthorized" as const };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users_profile")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin") {
    return { error: "Unauthorized" as const };
  }

  return {
    supabase,
    userId: user.id
  };
}

function normalizeCustomRoleData(data: CustomRoleInput) {
  const normalized = {
    name: data.name.trim(),
    description: data.description?.trim() || null
  } as Record<string, string | boolean | null>;

  for (const key of customRolePermissionKeys) {
    normalized[key] = Boolean(data[key]);
  }

  return normalized;
}

export async function createUser(data: CreateUserInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { success: false, error: admin.error };

  if (!data.email || !data.password || !data.full_name) {
    return { success: false, error: "Name, email, and password are required" };
  }

  if (data.password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters" };
  }

  if (data.role === "custom" && !data.custom_role_id) {
    return { success: false, error: "Please select a custom role" };
  }

  const { data: createdAuthUser, error: createAuthError } = await adminClient.auth.admin.createUser({
    email: data.email.trim(),
    password: data.password,
    email_confirm: true
  });

  if (createAuthError || !createdAuthUser.user) {
    return { success: false, error: createAuthError?.message || "Could not create auth user" };
  }

  const userId = createdAuthUser.user.id;

  const { error: profileInsertError } = await admin.supabase.from("users_profile").insert({
    id: userId,
    email: data.email.trim(),
    role: data.role,
    full_name: data.full_name.trim(),
    phone: data.phone?.trim() || null,
    custom_role_id: data.role === "custom" ? data.custom_role_id || null : null,
    is_active: true,
    created_by: admin.userId
  });

  if (profileInsertError) {
    await adminClient.auth.admin.deleteUser(userId);
    return { success: false, error: profileInsertError.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function updateUser(id: string, data: UpdateUserInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { success: false, error: admin.error };

  if (!id) return { success: false, error: "User id is required" };
  if (!data.full_name) return { success: false, error: "Full name is required" };
  if (data.role === "custom" && !data.custom_role_id) {
    return { success: false, error: "Please select a custom role" };
  }

  const { data: existingUser, error: existingUserError } = await admin.supabase
    .from("users_profile")
    .select("is_active")
    .eq("id", id)
    .maybeSingle();

  if (existingUserError) {
    return { success: false, error: existingUserError.message };
  }

  const { error: updateProfileError } = await admin.supabase
    .from("users_profile")
    .update({
      full_name: data.full_name.trim(),
      phone: data.phone?.trim() || null,
      role: data.role,
      custom_role_id: data.role === "custom" ? data.custom_role_id || null : null,
      is_active: data.is_active
    })
    .eq("id", id);

  if (updateProfileError) {
    return { success: false, error: updateProfileError.message };
  }

  if (existingUser?.is_active !== false && data.is_active === false) {
    const { error: suspendError } = await adminClient.auth.admin.updateUserById(id, {
      ban_duration: "none"
    });

    if (suspendError) {
      return { success: false, error: suspendError.message };
    }
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { success: false, error: admin.error };

  if (!id) return { success: false, error: "User id is required" };
  if (id === admin.userId) {
    return { success: false, error: "You cannot delete your own account" };
  }

  const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(id);
  if (deleteAuthError) {
    return { success: false, error: deleteAuthError.message };
  }

  const { error: deleteProfileError } = await admin.supabase.from("users_profile").delete().eq("id", id);
  if (deleteProfileError) {
    return { success: false, error: deleteProfileError.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function createCustomRole(data: CustomRoleInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { success: false, error: admin.error };

  if (!data.name?.trim()) {
    return { success: false, error: "Role name is required" };
  }

  const normalizedData = normalizeCustomRoleData(data);

  const { error } = await admin.supabase.from("custom_roles").insert({
    ...normalizedData,
    created_by: admin.userId
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/roles");
  revalidatePath("/admin/users");
  return { success: true };
}

export async function updateCustomRole(id: string, data: CustomRoleInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { success: false, error: admin.error };

  if (!id) return { success: false, error: "Role id is required" };
  if (!data.name?.trim()) return { success: false, error: "Role name is required" };

  const normalizedData = normalizeCustomRoleData(data);

  const { error } = await admin.supabase.from("custom_roles").update(normalizedData).eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/roles");
  revalidatePath("/admin/users");
  return { success: true };
}

export async function deleteCustomRole(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { success: false, error: admin.error };

  if (!id) return { success: false, error: "Role id is required" };

  const { count, error: usageError } = await admin.supabase
    .from("users_profile")
    .select("id", { count: "exact", head: true })
    .eq("custom_role_id", id);

  if (usageError) {
    return { success: false, error: usageError.message };
  }

  if ((count ?? 0) > 0) {
    return { success: false, error: "Role is in use" };
  }

  const { error } = await admin.supabase.from("custom_roles").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/roles");
  revalidatePath("/admin/users");
  return { success: true };
}
