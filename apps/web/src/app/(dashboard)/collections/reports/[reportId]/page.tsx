"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { approveCollectionReport, rejectCollectionReport } from "@/app/actions/collections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  COLLECTION_REPORT_DETAIL_QUERY_KEY,
  useCollectionReportDetail
} from "@/hooks/useCollectionReportDetail";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 2 }).format(value);

const statusLabels: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected"
};

const statusVariants: Record<string, "default" | "success" | "warning" | "danger" | "muted"> = {
  draft: "warning",
  submitted: "warning",
  approved: "success",
  rejected: "danger"
};

export default function CollectionReportDetailPage() {
  const params = useParams();
  const reportId = typeof params.reportId === "string" ? params.reportId : "";
  const { permissions } = useCurrentUserPermissions();

  const queryClient = useQueryClient();
  const reportQuery = useCollectionReportDetail(reportId);

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await approveCollectionReport(id);
      if (!result.success) throw new Error(result.error || "Failed to approve report");
      return result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COLLECTION_REPORT_DETAIL_QUERY_KEY });
      toast({ title: "Report approved", variant: "success" });
    },
    onError: (error) => {
      toast({ title: "Approval failed", description: String(error), variant: "error" });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await rejectCollectionReport(id);
      if (!result.success) throw new Error(result.error || "Failed to reject report");
      return result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COLLECTION_REPORT_DETAIL_QUERY_KEY });
      toast({ title: "Report rejected", variant: "success" });
    },
    onError: (error) => {
      toast({ title: "Rejection failed", description: String(error), variant: "error" });
    }
  });

  const canValidate = permissions?.canValidateCollections ?? false;
  const reportStatus = reportQuery.data?.report.status;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Collection Report</h1>
          <p className="text-sm text-muted-foreground">
            {reportQuery.data
              ? `${reportQuery.data.report.sales_rep_name} · ${formatDate(reportQuery.data.report.report_date)}`
              : "Loading report..."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {reportQuery.data ? (
            <Badge variant={statusVariants[reportQuery.data.report.status]}>
              {statusLabels[reportQuery.data.report.status]}
            </Badge>
          ) : null}
          <Button variant="outline" asChild>
            <Link href="/collections/reports">Back</Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Collected</CardTitle>
          </CardHeader>
          <CardContent>{formatCurrency(reportQuery.data?.totals.collected_total ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expenses</CardTitle>
          </CardHeader>
          <CardContent>{formatCurrency(reportQuery.data?.totals.expense_total ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Net Cash</CardTitle>
          </CardHeader>
          <CardContent>{formatCurrency(reportQuery.data?.totals.net_total ?? 0)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Collected Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Collected At</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    Loading collections...
                  </TableCell>
                </TableRow>
              ) : (reportQuery.data?.collections ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    No collections recorded.
                  </TableCell>
                </TableRow>
              ) : (
                (reportQuery.data?.collections ?? []).map((collection) => (
                  <TableRow key={collection.id}>
                    <TableCell>{collection.invoice_number ?? "-"}</TableCell>
                    <TableCell>{collection.customer_name}</TableCell>
                    <TableCell>{formatCurrency(collection.amount)}</TableCell>
                    <TableCell>{formatDate(collection.created_at)}</TableCell>
                    <TableCell>{collection.notes || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    Loading expenses...
                  </TableCell>
                </TableRow>
              ) : (reportQuery.data?.expenses ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    No expenses recorded.
                  </TableCell>
                </TableRow>
              ) : (
                (reportQuery.data?.expenses ?? []).map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{formatDate(expense.expense_date)}</TableCell>
                    <TableCell>{expense.category}</TableCell>
                    <TableCell>{formatCurrency(expense.amount)}</TableCell>
                    <TableCell>{expense.note || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canValidate && reportStatus === "submitted" ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => reportQuery.data && rejectMutation.mutate(reportQuery.data.report.id)}
            disabled={rejectMutation.isPending}
          >
            Reject
          </Button>
          <Button
            type="button"
            onClick={() => reportQuery.data && approveMutation.mutate(reportQuery.data.report.id)}
            disabled={approveMutation.isPending}
          >
            Approve
          </Button>
        </div>
      ) : null}
    </section>
  );
}
