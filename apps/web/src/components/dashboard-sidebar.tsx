"use client";

import {
  BarChart3,
  ClipboardList,
  FileText,
  HandCoins,
  Home,
  Package,
  ReceiptText,
  ShieldCheck,
  Users
} from "lucide-react";

import { Sidebar, type SidebarItem } from "@/components/ui/sidebar";

type DashboardSidebarProps = {
  isAdmin: boolean;
};

const navItems: SidebarItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/collections", label: "Collections", icon: HandCoins },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/receive-notes", label: "Receive Notes", icon: ReceiptText },
  { href: "/products", label: "Products", icon: Package },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart3 }
];

const adminNavItems: SidebarItem[] = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/roles", label: "Roles", icon: ShieldCheck }
];

export function DashboardSidebar({ isAdmin }: DashboardSidebarProps) {
  return <Sidebar title="PaintDist" items={navItems} adminItems={isAdmin ? adminNavItems : []} />;
}
