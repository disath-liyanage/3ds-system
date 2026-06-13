"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type SidebarItem = {
  href: string;
  label: string;
  icon?: LucideIcon;
  badgeCount?: number;
};

type SidebarProps = {
  title: string;
  logoSrc?: string;
  items: SidebarItem[];
  adminItems?: SidebarItem[];
  adminTitle?: string;
  footer?: ReactNode;
};

export function Sidebar({ title, logoSrc, items, adminItems = [], adminTitle = "Admin", footer }: SidebarProps) {
  const pathname = usePathname();

  const renderItem = (item: SidebarItem) => {
    const Icon = item.icon;
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "relative flex items-center gap-2 overflow-hidden rounded-full px-3 py-2 text-sm transition",
          active
            ? "font-bold text-white bg-brand-dark hover:bg-brand-dark/90"
            : "text-gray-500 hover:bg-brand/10 hover:text-brand"
        )}
      >
        {Icon ? <Icon className="relative h-4 w-4" /> : null}
        <span className="relative">{item.label}</span>
        {typeof item.badgeCount === "number" && item.badgeCount > 0 ? (
          <span className="relative ml-auto rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">
            {item.badgeCount}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <aside className="flex w-full flex-col border-b border-brand-muted bg-brand-light/35 p-4 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r lg:overflow-y-auto">
      <div className="mb-6 flex justify-center">
        {logoSrc ? (
          <Image src={logoSrc} alt={title} width={220} height={124} priority className="h-auto w-full max-w-[220px]" />
        ) : (
          <h2 className="text-lg font-semibold">{title}</h2>
        )}
      </div>

      <div className="flex-1">
        <nav className="grid gap-1">{items.map(renderItem)}</nav>

        {adminItems.length > 0 ? (
          <div className="mt-6 border-t border-border pt-4">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{adminTitle}</p>
            <nav className="grid gap-1">{adminItems.map(renderItem)}</nav>
          </div>
        ) : null}
      </div>

      {footer ? <div className="mt-6 border-t border-border pt-4">{footer}</div> : null}
    </aside>
  );
}
