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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

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
  { href: "/receive-notes", label: "GRN", icon: ReceiptText },
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
  const queryClient = useQueryClient();
  const previousUnreadCountRef = useRef<number | null>(null);

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

  const playNotificationSound = () => {
    if (typeof window === "undefined") return;

    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.16);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.17);

    oscillator.onended = () => {
      void audioContext.close();
    };
  };

  useEffect(() => {
    const currentUnread = unreadNotificationsQuery.data ?? 0;
    const previousUnread = previousUnreadCountRef.current;

    if (previousUnread !== null && currentUnread > previousUnread) {
      playNotificationSound();
    }

    previousUnreadCountRef.current = currentUnread;
  }, [unreadNotificationsQuery.data]);

  useEffect(() => {
    let isMounted = true;
    let authUserId: string | null = null;
    let subscription:
      | ReturnType<ReturnType<typeof createClient>["channel"]>
      | null = null;

    const attachRealtime = async () => {
      const {
        data: { user: authUser }
      } = await supabase.auth.getUser();

      if (!isMounted || !authUser) return;
      authUserId = authUser.id;

      subscription = supabase
        .channel(`notifications-unread-${authUser.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `recipient_id=eq.${authUser.id}`
          },
          async (payload) => {
            const eventType = payload.eventType;
            const newRow = (payload as { new?: { is_read?: boolean } }).new;
            const oldRow = (payload as { old?: { is_read?: boolean } }).old;

            if (eventType === "INSERT" && newRow?.is_read === false) {
              queryClient.setQueryData<number>(["notifications-unread-count"], (current) => (current ?? 0) + 1);
              return;
            }

            if (eventType === "UPDATE") {
              if (oldRow?.is_read === false && newRow?.is_read === true) {
                queryClient.setQueryData<number>(["notifications-unread-count"], (current) =>
                  Math.max(0, (current ?? 0) - 1)
                );
                return;
              }

              if (oldRow?.is_read === true && newRow?.is_read === false) {
                queryClient.setQueryData<number>(["notifications-unread-count"], (current) => (current ?? 0) + 1);
                return;
              }
            }

            if (eventType === "DELETE" && oldRow?.is_read === false) {
              queryClient.setQueryData<number>(["notifications-unread-count"], (current) =>
                Math.max(0, (current ?? 0) - 1)
              );
              return;
            }

            await queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
          }
        )
        .subscribe();
    };

    attachRealtime();

    return () => {
      isMounted = false;
      if (subscription) {
        void supabase.removeChannel(subscription);
      }
      if (authUserId) {
        void queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      }
    };
  }, [queryClient, supabase]);

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
