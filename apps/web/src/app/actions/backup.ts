"use server";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateBackupSQL } from "@/lib/backup/generateBackupSQL";

export type GenerateBackupSQLResponse = {
  success: boolean;
  error?: string;
  sql?: string;
};

export async function generateBackupSQLAction(): Promise<GenerateBackupSQLResponse> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data: profileById, error: profileByIdError } = await adminClient
    .from("users_profile")
    .select("id, email, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileByIdError) {
    return { success: false, error: profileByIdError.message };
  }

  let currentProfile = profileById;

  if (!currentProfile && user.email) {
    const { data: profileByEmail, error: profileByEmailError } = await adminClient
      .from("users_profile")
      .select("id, email, role")
      .eq("email", user.email)
      .maybeSingle();

    if (profileByEmailError) {
      return { success: false, error: profileByEmailError.message };
    }

    currentProfile = profileByEmail;
  }

  if (!currentProfile || currentProfile.role !== "admin") {
    return { success: false, error: "Only admins can generate backups." };
  }

  try {
    const sql = await generateBackupSQL(adminClient);
    return { success: true, sql };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate backup."
    };
  }
}
