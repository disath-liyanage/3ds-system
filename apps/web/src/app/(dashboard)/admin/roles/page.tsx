import type { CustomRole, User } from "@paintdist/shared";
import { redirect } from "next/navigation";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { RolesManagementClient } from "./components/RolesManagementClient";

export default async function AdminRolesPage() {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileById, error: profileByIdError } = await adminClient
    .from("users_profile")
    .select("id, email, role, full_name, phone, created_at, custom_role_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileByIdError) {
    redirect("/dashboard");
  }

  let currentProfile = profileById;

  if (!currentProfile && user.email) {
    const { data: profileByEmail, error: profileByEmailError } = await adminClient
      .from("users_profile")
      .select("id, email, role, full_name, phone, created_at, custom_role_id")
      .eq("email", user.email)
      .maybeSingle();

    if (profileByEmailError) {
      redirect("/dashboard");
    }

    currentProfile = profileByEmail;
  }

  if (!currentProfile || currentProfile.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: roles, error: rolesError } = await adminClient
    .from("custom_roles")
    .select(
      "id, name, description, created_by, created_at, perm_create_orders, perm_approve_orders, perm_view_all_orders, perm_record_collections, perm_validate_collections, perm_manage_products, perm_manage_customers, perm_create_invoices, perm_manage_receive_notes, perm_view_reports, perm_export_reports, perm_manage_users, perm_view_users"
    )
    .order("created_at", { ascending: false });

  const currentUser: User = {
    id: currentProfile.id,
    email: currentProfile.email,
    role: currentProfile.role,
    full_name: currentProfile.full_name,
    phone: currentProfile.phone,
    created_at: currentProfile.created_at,
    custom_role_id: currentProfile.custom_role_id,
    is_active: true
  };

  return (
    <div className="space-y-4">
      {rolesError ? <p className="text-sm text-red-600">Failed to load custom roles: {rolesError.message}</p> : null}
      <RolesManagementClient roles={(roles ?? []) as CustomRole[]} currentUser={currentUser} />
    </div>
  );
}
