import type { Worker, User } from "@paintdist/shared";
import { redirect } from "next/navigation";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { WorkersManagementClient } from "./components/WorkersManagementClient";

export default async function AdminWorkersPage() {
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

  if (!currentProfile || (currentProfile.role !== "admin" && currentProfile.role !== "manager")) {
    redirect("/dashboard");
  }

  const { data: workers, error: workersError } = await adminClient
    .from("workers")
    .select("id, name, identity_card_no, salary_type, salary_amount, created_at")
    .order("created_at", { ascending: false });

  const currentUser: User = {
    id: currentProfile.id,
    email: currentProfile.email,
    role: currentProfile.role,
    full_name: currentProfile.full_name,
    phone: currentProfile.phone,
    created_at: currentProfile.created_at,
    custom_role_id: currentProfile.custom_role_id,
    worker_id: null,
    is_active: true
  };

  return (
    <div className="space-y-4">
      {workersError ? <p className="text-sm text-red-600">Failed to load workers: {workersError.message}</p> : null}
      <WorkersManagementClient workers={(workers ?? []) as Worker[]} currentUser={currentUser} />
    </div>
  );
}
