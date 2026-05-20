"use client";

import { ChevronLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const depth = pathname.split("/").filter(Boolean).length;
  const showBack = depth > 1;

  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex items-start gap-3">
        {showBack ? (
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center self-center rounded-full border border-border/70 bg-white/80 text-muted-foreground shadow-sm backdrop-blur-sm transition hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : null}
        <div className="space-y-1">
          {eyebrow ? (
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
          ) : null}
          <h1 className="text-2xl font-bold">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
