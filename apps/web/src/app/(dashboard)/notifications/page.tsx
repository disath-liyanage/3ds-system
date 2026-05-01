"use client";

import { useMemo, useState } from "react";

import { approvePendingCustomer, markNotificationRead, removePendingCustomer } from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
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
  customer: {
    id: string;
    name: string;
    phone: string;
    address: string;
    area: string;
    credit_limit: number;
    status: "pending_approval" | "active" | "rejected";
  } | null;
};

type RawNotificationRow = Omit<NotificationRow, "customer"> & {
  customer: NotificationRow["customer"] | NotificationRow["customer"][];
};

export default function NotificationsPage() {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
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
        .select(
          "id, title, message, type, is_read, customer_id, created_at, customer:customers(id, name, phone, address, area, credit_limit, status)"
        )
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return ((data || []) as RawNotificationRow[]).map((row) => ({
        ...row,
        customer: Array.isArray(row.customer) ? row.customer[0] || null : row.customer
      }));
    }
  });

  const canReviewCustomers = user?.role === "admin" || user?.role === "manager";
  const selectedNotification = notificationsQuery.data?.find((item) => item.id === selectedNotificationId) || null;

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
    setSelectedNotificationId(null);
    await notificationsQuery.refetch();
  };

  const handleRemoveCustomer = async (customerId: string, notificationId: string) => {
    setProcessingId(notificationId);
    const result = await removePendingCustomer(customerId, notificationId);
    setProcessingId(null);

    if (!result.success) {
      toast({ title: "Remove failed", description: result.error, variant: "error" });
      return;
    }

    toast({ title: "Customer removed", description: result.message, variant: "success" });
    setSelectedNotificationId(null);
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
                      <>
                        <Button size="sm" variant="outline" onClick={() => setSelectedNotificationId(notification.id)}>
                          View Customer
                        </Button>
                        <Button
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => handleApproveCustomer(notification.customer_id as string, notification.id)}
                        >
                          Approve Customer
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={isProcessing}
                          onClick={() => handleRemoveCustomer(notification.customer_id as string, notification.id)}
                        >
                          Remove Customer
                        </Button>
                      </>
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

      <Dialog
        open={Boolean(selectedNotification)}
        onOpenChange={(open) => {
          if (!open) setSelectedNotificationId(null);
        }}
        title="Customer Request Review"
        description="Review details and decide whether to approve or remove this pending request."
      >
        {selectedNotification?.customer ? (
          <div className="space-y-3 text-sm">
            <p>
              <strong>Name:</strong> {selectedNotification.customer.name}
            </p>
            <p>
              <strong>Phone:</strong> {selectedNotification.customer.phone}
            </p>
            <p>
              <strong>Area:</strong> {selectedNotification.customer.area}
            </p>
            <p>
              <strong>Address:</strong> {selectedNotification.customer.address}
            </p>
            <p>
              <strong>Credit Limit:</strong> LKR {Number(selectedNotification.customer.credit_limit).toLocaleString()}
            </p>
            <div className="flex gap-2">
              {!selectedNotification.is_read ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={processingId === selectedNotification.id}
                  onClick={() => handleMarkRead(selectedNotification.id)}
                >
                  Mark as read
                </Button>
              ) : null}
              {canReviewCustomers && selectedNotification.customer.status === "pending_approval" ? (
                <>
                  <Button
                    size="sm"
                    disabled={processingId === selectedNotification.id}
                    onClick={() =>
                      handleApproveCustomer(selectedNotification.customer?.id as string, selectedNotification.id)
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={processingId === selectedNotification.id}
                    onClick={() =>
                      handleRemoveCustomer(selectedNotification.customer?.id as string, selectedNotification.id)
                    }
                  >
                    Remove
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Customer record is not available anymore.</p>
        )}
      </Dialog>
    </section>
  );
}
