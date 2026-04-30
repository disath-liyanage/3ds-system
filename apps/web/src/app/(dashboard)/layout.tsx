import { redirect } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
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
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? "sales_rep";
  const isAdmin = role === "admin";

  return (
    <div className="min-h-screen lg:flex">
      <DashboardSidebar
        isAdmin={isAdmin}
        user={{
          fullName: profile?.full_name ?? null,
          email: user.email ?? "",
          role
        }}
      />
      <main className="flex-1 p-4 lg:p-8">{children}</main>
    </div>
  );
}