import type { User } from "@paintdist/shared";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { UsersTableClient } from "./components/UsersTableClient";
import type { AdminUserRow, CustomRoleSelectOption, UserCustomRoleSummary } from "./components/types";

type RawUserRow = {
  id: string;
  email: string;
  role: User["role"];
  full_name: string;
  phone: string | null;
  is_active: boolean | null;
  created_at: string;
  custom_role_id: string | null;
  custom_role: UserCustomRoleSummary | UserCustomRoleSummary[] | null;
};

export default async function AdminUsersPage() {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: currentProfile, error: currentProfileError } = await supabase
    .from("users_profile")
    .select("id, email, role, full_name, phone, created_at, custom_role_id")
    .eq("id", user.id)
    .maybeSingle();

  if (currentProfileError || !currentProfile || currentProfile.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: users, error: usersError } = await supabase
    .from("users_profile")
    .select(
      "id, email, role, full_name, phone, is_active, created_at, custom_role_id, custom_role:custom_roles(id, name)"
    )
    .order("created_at", { ascending: false });

  const { data: customRoles, error: customRolesError } = await supabase
    .from("custom_roles")
    .select("id, name")
    .order("name", { ascending: true });

  const normalizedUsers: AdminUserRow[] = ((users ?? []) as RawUserRow[]).map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    full_name: row.full_name,
    phone: row.phone,
    created_at: row.created_at,
    custom_role_id: row.custom_role_id,
    custom_role: Array.isArray(row.custom_role) ? row.custom_role[0] || null : row.custom_role,
    is_active: row.is_active ?? true
  }));

  const normalizedCustomRoles: CustomRoleSelectOption[] = (customRoles ?? []) as CustomRoleSelectOption[];

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
      {usersError ? <p className="text-sm text-red-600">Failed to load users: {usersError.message}</p> : null}
      {customRolesError ? (
        <p className="text-sm text-red-600">Failed to load custom roles: {customRolesError.message}</p>
      ) : null}

      <UsersTableClient users={normalizedUsers} customRoles={normalizedCustomRoles} currentUser={currentUser} />
    </div>
  );
}
