"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  addCollectionReportExpense,
  deleteCollectionReportExpense,
  submitCollectionReport
} from "@/app/actions/collections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useDailyCollectionReport, DAILY_COLLECTION_REPORT_QUERY_KEY } from "@/hooks/useDailyCollectionReport";
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

export default function MyCollectionReportPage() {
  const { permissions, isLoading } = useCurrentUserPermissions();
  const [reportDate, setReportDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [expenseDate, setExpenseDate] = useState(reportDate);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const queryClient = useQueryClient();
  const reportQuery = useDailyCollectionReport(reportDate);

  const canRecordCollections = permissions?.canRecordCollections ?? false;

  useEffect(() => {
    setExpenseDate(reportDate);
  }, [reportDate]);

  const addExpenseMutation = useMutation({
    mutationFn: async (payload: {
      report_id: string;
      expense_date: string;
      category: string;
      amount: number;
      note?: string;
    }) => {
      const result = await addCollectionReportExpense(payload);
      if (!result.success) throw new Error(result.error || "Failed to add expense");
      return result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DAILY_COLLECTION_REPORT_QUERY_KEY });
      setCategory("");
      setAmount("");
      setNote("");
      toast({ title: "Expense added", variant: "success" });
    },
    onError: (error) => {
      toast({ title: "Failed to add expense", description: String(error), variant: "error" });
    }
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async ({ reportId, expenseId }: { reportId: string; expenseId: string }) => {
      const result = await deleteCollectionReportExpense(reportId, expenseId);
      if (!result.success) throw new Error(result.error || "Failed to remove expense");
      return result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DAILY_COLLECTION_REPORT_QUERY_KEY });
      toast({ title: "Expense removed", variant: "success" });
    },
    onError: (error) => {
      toast({ title: "Failed to remove expense", description: String(error), variant: "error" });
    }
  });

  const submitReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const result = await submitCollectionReport(reportId);
      if (!result.success) throw new Error(result.error || "Failed to submit report");
      return result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DAILY_COLLECTION_REPORT_QUERY_KEY });
      toast({ title: "Report submitted", variant: "success" });
    },
    onError: (error) => {
      toast({ title: "Failed to submit report", description: String(error), variant: "error" });
    }
  });

  const isEditable = useMemo(() => {
    const status = reportQuery.data?.report.status;
    return status === "draft" || status === "rejected";
  }, [reportQuery.data?.report.status]);

  if (!isLoading && !canRecordCollections) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">My Collection Report</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to record collections.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Collection Report</h1>
          <p className="text-sm text-muted-foreground">Add expenses and submit your daily report.</p>
        </div>
        {reportQuery.data ? (
          <Badge variant={statusVariants[reportQuery.data.report.status]}>
            {statusLabels[reportQuery.data.report.status]}
          </Badge>
        ) : null}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Report Date</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Date</label>
            <Input
              type="date"
              value={reportDate}
              onChange={(event) => setReportDate(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Collected</label>
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
              {formatCurrency(reportQuery.data?.totals.collected_total ?? 0)}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Net cash in hand</label>
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
              {formatCurrency(reportQuery.data?.totals.net_total ?? 0)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="space-y-1">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
                disabled={!isEditable}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Category</label>
              <Input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Fuel, lunch, parking"
                disabled={!isEditable}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={!isEditable}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Note</label>
              <Input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional"
                disabled={!isEditable}
              />
            </div>
          </div>

          <Button
            type="button"
            disabled={!isEditable || addExpenseMutation.isPending}
            onClick={() => {
              if (!reportQuery.data) return;
              addExpenseMutation.mutate({
                report_id: reportQuery.data.report.id,
                expense_date: expenseDate,
                category,
                amount: Number(amount),
                note
              });
            }}
          >
            Add Expense
          </Button>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    Loading expenses...
                  </TableCell>
                </TableRow>
              ) : (reportQuery.data?.expenses ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
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
                    <TableCell>
                      {isEditable ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            deleteExpenseMutation.mutate({
                              reportId: reportQuery.data?.report.id || "",
                              expenseId: expense.id
                            })
                          }
                        >
                          Remove
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                    No collections recorded for this date.
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

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          disabled={!reportQuery.data || !isEditable || submitReportMutation.isPending}
          onClick={() => reportQuery.data && submitReportMutation.mutate(reportQuery.data.report.id)}
        >
          Submit Report
        </Button>
      </div>
    </section>
  );
}
