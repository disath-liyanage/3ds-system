"use client";

import {
  BarChart3,
  Bell,
  CalendarCheck2,
  ClipboardList,
  FileText,
  HandCoins,
  Home,
  LogOut,
  Package,
  ReceiptText,
  UserCircle2,
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
  isManager: boolean;
  user: {
    fullName: string | null;
    email: string;
    role: string;
    createdAt: string | null;
    identityCardNo: string | null;
  };
};

const baseNavItems: SidebarItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
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
  { href: "/admin/workers", label: "Workers", icon: Users }
];

export function DashboardSidebar({ isAdmin, isManager, user }: DashboardSidebarProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const previousUnreadCountRef = useRef<number | null>(null);

  const displayName = user.fullName?.trim() || user.email;
  const createdDateLabel = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" })
    : "-";
  const identityCardLabel = user.identityCardNo?.trim() || "-";

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
        .eq("is_read", false)
        .lte("created_at", new Date().toISOString());

      if (error) return 0;
      return count ?? 0;
    }
  });

  const navItems = useMemo(() => {
    const withAttendance =
      user.role === "admin" || user.role === "manager"
        ? [
            ...baseNavItems,
            { href: "/attendance", label: "Attendance", icon: CalendarCheck2 },
            { href: "/targets", label: "Targets", icon: ClipboardList },
            { href: "/expenses", label: "Expenses", icon: HandCoins }
          ]
        : baseNavItems;

    return withAttendance.map((item) =>
      item.href === "/notifications" ? { ...item, badgeCount: unreadNotificationsQuery.data ?? 0 } : item
    );
  }, [unreadNotificationsQuery.data, user.role]);

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

  useEffect(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }

    if (!isProfileExpanded) return;

    collapseTimerRef.current = setTimeout(() => {
      setIsProfileExpanded(false);
      collapseTimerRef.current = null;
    }, 20000);

    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
    };
  }, [isProfileExpanded]);

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <Sidebar
      title="3D's Distributors (PVT) Ltd."
      items={navItems}
      adminItems={isAdmin ? adminNavItems : []}
      footer={
        <div className="relative w-full">
          <div
            className={cn(
              "pointer-events-none absolute bottom-full left-0 mb-2 w-full origin-bottom rounded-md bg-background/95 px-3 py-3 text-center shadow-md backdrop-blur-sm transition-all duration-300 ease-in-out",
              isProfileExpanded ? "translate-y-0 scale-y-100 opacity-100" : "translate-y-2 scale-y-95 opacity-0"
            )}
            aria-hidden={!isProfileExpanded}
          >
            <UserCircle2
              className={cn(
                "mx-auto text-muted-foreground transition-all duration-300 ease-in-out",
                isProfileExpanded ? "h-10 w-10 scale-100 rotate-0" : "h-7 w-7 scale-90 -rotate-6"
              )}
            />
            <p className="mt-2 truncate text-xs text-muted-foreground">Role: {user.role}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">ID No: {identityCardLabel}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">Created: {createdDateLabel}</p>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void handleSignOut();
              }}
              disabled={isSigningOut}
              className={cn(
                "pointer-events-auto mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700",
                isSigningOut ? "cursor-not-allowed opacity-70" : ""
              )}
            >
              <LogOut className="h-4 w-4" />
              {isSigningOut ? "Signing out..." : "Logout"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsProfileExpanded((prev) => !prev)}
            className="w-full rounded-md bg-background text-left transition hover:bg-muted/40 focus:outline-none"
            aria-expanded={isProfileExpanded}
            aria-label="Toggle user profile"
          >
            <div
              className={cn(
                "relative flex items-center px-3 py-3 transition-all duration-300 ease-in-out",
                isProfileExpanded ? "justify-center" : "gap-3"
              )}
            >
              <UserCircle2
                className={cn(
                  "shrink-0 text-muted-foreground transition-all duration-300 ease-in-out",
                  isProfileExpanded
                    ? "pointer-events-none absolute left-3 h-8 w-8 scale-110 rotate-6 opacity-0"
                    : "h-7 w-7 scale-100 rotate-0 opacity-100"
                )}
              />
              <div
                className={cn(
                  "min-w-0 transition-all duration-300 ease-in-out",
                  isProfileExpanded ? "mx-auto text-center" : ""
                )}
              >
                <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
          </button>
        </div>
      }
    />
  );
}
