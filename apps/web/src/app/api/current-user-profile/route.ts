import { NextResponse } from "next/server";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await adminClient
    .from("users_profile")
    .select(
      "id, email, role, full_name, phone, created_at, custom_role_id, is_active, custom_role:custom_roles(id, name, description, created_by, created_at, perm_create_orders, perm_approve_orders, perm_view_all_orders, perm_record_collections, perm_validate_collections, perm_manage_products, perm_manage_customers, perm_create_invoices, perm_manage_receive_notes, perm_view_reports, perm_export_reports, perm_manage_users, perm_view_users)"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const roleRelation = profile.custom_role;
  const customRole = Array.isArray(roleRelation) ? roleRelation[0] || null : roleRelation;

  return NextResponse.json({
    user: {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      full_name: profile.full_name,
      phone: profile.phone,
      custom_role_id: profile.custom_role_id,
      is_active: profile.is_active ?? true,
      created_at: profile.created_at
    },
    customRole
  });
}
