"use client";

import {
  BarChart3,
  Bell,
  ClipboardList,
  FileText,
  HandCoins,
  Home,
  LogOut,
  Package,
  ReceiptText,
  ShieldCheck,
  Users
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Sidebar, type SidebarItem } from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type DashboardSidebarProps = {
  isAdmin: boolean;
  user: {
    fullName: string | null;
    email: string;
    role: string;
  };
};

const baseNavItems: SidebarItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/collections", label: "Collections", icon: HandCoins },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/receive-notes", label: "Receive Notes", icon: ReceiptText },
  { href: "/products", label: "Products", icon: Package },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/reports", label: "Reports", icon: BarChart3 }
];

const adminNavItems: SidebarItem[] = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/roles", label: "Roles", icon: ShieldCheck }
];

export function DashboardSidebar({ isAdmin, user }: DashboardSidebarProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const displayName = user.fullName?.trim() || user.email;
  const secondaryText = displayName === user.email ? user.role : `${user.email} · ${user.role}`;

  const unreadNotificationsQuery = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => {
      const {
        data: { user: authUser }
      } = await supabase.auth.getUser();

      if (!authUser) return 0;

      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", authUser.id)
        .eq("is_read", false);

      if (error) return 0;
      return count ?? 0;
    }
  });

  const navItems = useMemo(
    () =>
      baseNavItems.map((item) =>
        item.href === "/notifications" ? { ...item, badgeCount: unreadNotificationsQuery.data ?? 0 } : item
      ),
    [unreadNotificationsQuery.data]
  );

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <Sidebar
      title="PaintDist"
      items={navItems}
      adminItems={isAdmin ? adminNavItems : []}
      footer={
        <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{secondaryText}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className={cn(
              "inline-flex items-center justify-center rounded-md border border-border px-2 py-1 text-xs font-medium transition hover:bg-muted",
              isSigningOut ? "cursor-not-allowed opacity-70" : ""
            )}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      }
    />
  );
}
