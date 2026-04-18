"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type SidebarItem = {
  href: string;
  label: string;
  icon?: LucideIcon;
};

type SidebarProps = {
  title: string;
  items: SidebarItem[];
};

export function Sidebar({ title, items }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-full border-b border-border bg-white p-4 lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
      <div className="mb-6 flex items-center gap-2">
        <div className="h-8 w-8 rounded-md bg-primary" />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <nav className="grid gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition hover:bg-muted",
                active ? "bg-muted font-semibold" : "text-muted-foreground"
              )}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}