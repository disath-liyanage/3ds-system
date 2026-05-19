import { redirect } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users_profile")
    .select("role, full_name, email, created_at, worker:workers(identity_card_no)")
    .eq("id", user.id)
    .maybeSingle();

  let resolvedProfile = profile;

  if (!resolvedProfile && user.email) {
    const { data: fallbackProfile } = await adminClient
      .from("users_profile")
      .select("role, full_name, email, created_at, worker:workers(identity_card_no)")
      .eq("email", user.email)
      .maybeSingle();

    resolvedProfile = fallbackProfile ?? null;
  }

  const role = resolvedProfile?.role ?? "sales_rep";
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const worker = Array.isArray(resolvedProfile?.worker) ? resolvedProfile.worker[0] : resolvedProfile?.worker;

  return (
    <div className="min-h-screen lg:flex">
      <DashboardSidebar
        isAdmin={isAdmin}
        isManager={isManager}
        user={{
          fullName: resolvedProfile?.full_name ?? null,
          email: user.email ?? "",
          role,
          createdAt: resolvedProfile?.created_at ?? null,
          identityCardNo: worker?.identity_card_no ?? null
        }}
      />
      <main className="flex-1 p-4 lg:p-8">{children}</main>
    </div>
  );
}
