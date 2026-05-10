"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useDailyCollectionReports } from "@/hooks/useDailyCollectionReports";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 2 }).format(value);

const statusLabels: Record<string, string> = {
  none: "No report",
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected"
};

const statusVariants: Record<string, "default" | "success" | "warning" | "danger" | "muted"> = {
  none: "muted",
  draft: "warning",
  submitted: "warning",
  approved: "success",
  rejected: "danger"
};

export default function CollectionReportsPage() {
  const { permissions, isLoading } = useCurrentUserPermissions();
  const [reportDate, setReportDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const reportsQuery = useDailyCollectionReports(reportDate);

  const canViewReports = permissions?.canValidateCollections ?? false;

  const totals = useMemo(() => {
    const rows = reportsQuery.data ?? [];
    const collected = rows.reduce((sum, row) => sum + row.collected_total, 0);
    const expenses = rows.reduce((sum, row) => sum + row.expense_total, 0);
    return {
      collected,
      expenses,
      net: collected - expenses
    };
  }, [reportsQuery.data]);

  if (!isLoading && !canViewReports) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Collection Reports</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to view collection reports.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Collection Reports</h1>
          <p className="text-sm text-muted-foreground">Review daily collection reports from sales reps.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/collections">Back to collections</Link>
        </Button>
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
            <label className="text-sm font-medium">Total collected</label>
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
              {formatCurrency(totals.collected)}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Net cash in hand</label>
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
              {formatCurrency(totals.net)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sales Rep</TableHead>
            <TableHead>Collected</TableHead>
            <TableHead>Expenses</TableHead>
            <TableHead>Net Cash</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reportsQuery.isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-sm text-muted-foreground">
                Loading reports...
              </TableCell>
            </TableRow>
          ) : reportsQuery.isError ? (
            <TableRow>
              <TableCell colSpan={6} className="text-sm text-muted-foreground">
                Failed to load reports.
              </TableCell>
            </TableRow>
          ) : (reportsQuery.data ?? []).length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-sm text-muted-foreground">
                No sales reps found.
              </TableCell>
            </TableRow>
          ) : (
            (reportsQuery.data ?? []).map((row) => (
              <TableRow key={row.sales_rep_id}>
                <TableCell>{row.sales_rep_name}</TableCell>
                <TableCell>{formatCurrency(row.collected_total)}</TableCell>
                <TableCell>{formatCurrency(row.expense_total)}</TableCell>
                <TableCell>{formatCurrency(row.net_total)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariants[row.status]}>{statusLabels[row.status]}</Badge>
                </TableCell>
                <TableCell>
                  {row.report_id ? (
                    <Button asChild size="sm">
                      <Link href={`/collections/reports/${row.report_id}`}>View</Link>
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
    </section>
  );
}
