import { redirect } from "next/navigation";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { BackupClient } from "./BackupClient";

export default async function AdminBackupPage() {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileById, error: profileByIdError } = await adminClient
    .from("users_profile")
    .select("id, email, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileByIdError) {
    redirect("/dashboard");
  }

  let currentProfile = profileById;

  if (!currentProfile && user.email) {
    const { data: profileByEmail, error: profileByEmailError } = await adminClient
      .from("users_profile")
      .select("id, email, role")
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

  return <BackupClient />;
}
