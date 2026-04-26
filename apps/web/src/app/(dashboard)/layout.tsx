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
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-screen lg:flex">
      <DashboardSidebar isAdmin={isAdmin} />
      <main className="flex-1 p-4 lg:p-8">{children}</main>
    </div>
  );
}