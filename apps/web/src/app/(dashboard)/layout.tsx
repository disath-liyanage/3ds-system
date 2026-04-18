import {
  BarChart3,
  ClipboardList,
  FileText,
  HandCoins,
  Home,
  Package,
  ReceiptText,
  Users
} from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/collections", label: "Collections", icon: HandCoins },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/receive-notes", label: "Receive Notes", icon: ReceiptText },
  { href: "/products", label: "Products", icon: Package },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart3 }
];

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar title="PaintDist" items={navItems} />
      <main className="flex-1 p-4 lg:p-8">{children}</main>
    </div>
  );
}