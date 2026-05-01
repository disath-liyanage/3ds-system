"use client";

import { useMemo, useState } from "react";

import { approvePendingCustomer, markNotificationRead } from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useQuery } from "@tanstack/react-query";

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  customer_id: string | null;
  created_at: string;
};

export default function NotificationsPage() {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { permissions, user } = useCurrentUserPermissions();
  const supabase = useMemo(() => createClient(), []);

  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) return [];

      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, message, type, is_read, customer_id, created_at")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data || []) as NotificationRow[];
    }
  });

  const canReviewCustomers = user?.role === "admin" || user?.role === "manager";

  const handleMarkRead = async (notificationId: string) => {
    setProcessingId(notificationId);
    const result = await markNotificationRead(notificationId);
    setProcessingId(null);

    if (!result.success) {
      toast({ title: "Failed to update notification", description: result.error, variant: "error" });
      return;
    }

    await notificationsQuery.refetch();
  };

  const handleApproveCustomer = async (customerId: string, notificationId: string) => {
    setProcessingId(notificationId);
    const result = await approvePendingCustomer(customerId, notificationId);
    setProcessingId(null);

    if (!result.success) {
      toast({ title: "Approval failed", description: result.error, variant: "error" });
      return;
    }

    toast({ title: "Customer approved", description: result.message, variant: "success" });
    await notificationsQuery.refetch();
  };

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-sm text-muted-foreground">Review updates and pending customer requests.</p>
      </header>

      {notificationsQuery.data?.length ? (
        <div className="space-y-3">
          {notificationsQuery.data.map((notification) => {
            const pendingApproval = notification.type === "customer_approval_request" && !!notification.customer_id;
            const isProcessing = processingId === notification.id;
            const showApprove = pendingApproval && !notification.is_read && canReviewCustomers;

            return (
              <Card key={notification.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{notification.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{notification.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(notification.created_at).toLocaleString()}
                    {notification.is_read ? " · Read" : " · Unread"}
                  </p>
                  <div className="flex gap-2">
                    {!notification.is_read ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => handleMarkRead(notification.id)}
                      >
                        Mark as read
                      </Button>
                    ) : null}
                    {showApprove ? (
                      <Button
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => handleApproveCustomer(notification.customer_id as string, notification.id)}
                      >
                        Approve Customer
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">No notifications right now.</CardContent>
        </Card>
      )}
    </section>
  );
}
