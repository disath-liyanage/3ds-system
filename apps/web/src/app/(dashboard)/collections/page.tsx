"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getSalesReps } from "@/app/actions/customers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCollectionInvoices } from "@/hooks/useCollectionInvoices";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";

type StatusFilter = "unsettled" | "settled" | "all";

const statusOptions = [
  { value: "unsettled", label: "Unsettled" },
  { value: "settled", label: "Settled" },
  { value: "all", label: "All" }
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 2 }).format(value);

export default function CollectionsPage() {
  const { permissions, isLoading, user } = useCurrentUserPermissions();
  const { data: invoices, isLoading: isInvoicesLoading, error } = useCollectionInvoices();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("unsettled");
  const [salesRepFilter, setSalesRepFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const canRecordCollections = permissions?.canRecordCollections ?? false;
  const canViewCollections = permissions
    ? permissions.canRecordCollections || permissions.canValidateCollections
    : false;
  const isManagerOrAdmin = user?.role === "admin" || user?.role === "manager";

  const salesRepsQuery = useQuery({
    queryKey: ["sales-reps"],
    queryFn: async () => await getSalesReps(),
    enabled: Boolean(isManagerOrAdmin)
  });

  const salesRepOptions = useMemo(
    () => [
      { value: "all", label: "All sales reps" },
      ...(salesRepsQuery.data || []).map((rep) => ({
        value: rep.id,
        label: rep.full_name
      }))
    ],
    [salesRepsQuery.data]
  );

  const filteredInvoices = useMemo(() => {
    let rows = invoices ?? [];

    if (statusFilter === "settled") {
      rows = rows.filter((row) => row.is_settled);
    }
    if (statusFilter === "unsettled") {
      rows = rows.filter((row) => !row.is_settled);
    }

    if (salesRepFilter !== "all") {
      rows = rows.filter((row) => row.sales_rep_id === salesRepFilter);
    }

    if (fromDate) {
      const from = new Date(fromDate);
      rows = rows.filter((row) => new Date(row.created_at) >= from);
    }

    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      rows = rows.filter((row) => new Date(row.created_at) <= end);
    }

    return rows;
  }, [invoices, statusFilter, salesRepFilter, fromDate, toDate]);

  const toggleSettled = () => {
    setStatusFilter((prev) => (prev === "settled" ? "unsettled" : "settled"));
  };

  if (!isLoading && !canViewCollections) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Collections</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to view collections.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Collections</h1>
          <p className="text-sm text-muted-foreground">Track unsettled and settled invoices.</p>
        </div>
        {canRecordCollections ? (
          <Button asChild>
            <Link href="/collections/new">Record Collection</Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-white p-4">
        <div className="min-w-[180px] space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Status</label>
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          />
        </div>
        <div className="min-w-[160px] space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">From</label>
          <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </div>
        <div className="min-w-[160px] space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">To</label>
          <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>
        {isManagerOrAdmin ? (
          <div className="min-w-[200px] space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Sales rep</label>
            <Select
              options={salesRepOptions}
              value={salesRepFilter}
              onChange={(event) => setSalesRepFilter(event.target.value)}
            />
          </div>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="outline" onClick={toggleSettled}>
            {statusFilter === "settled" ? "Show Unsettled" : "Show Settled"}
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Sales Rep</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Settled At</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isInvoicesLoading ? (
            <TableRow>
              <TableCell colSpan={8} className="text-sm text-muted-foreground">
                Loading collections...
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={8} className="text-sm text-muted-foreground">
                Failed to load collections.
              </TableCell>
            </TableRow>
          ) : filteredInvoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-sm text-muted-foreground">
                No invoices match the current filters.
              </TableCell>
            </TableRow>
          ) : (
            filteredInvoices.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.invoice_number}</TableCell>
                <TableCell>{row.customer_name}</TableCell>
                <TableCell>{formatCurrency(row.total_amount)}</TableCell>
                <TableCell>{new Date(row.due_date).toLocaleDateString()}</TableCell>
                <TableCell>{row.sales_rep_name || "Unassigned"}</TableCell>
                <TableCell>
                  <Badge variant={row.is_settled ? "success" : "warning"}>
                    {row.is_settled ? "settled" : "unsettled"}
                  </Badge>
                </TableCell>
                <TableCell>{row.settled_at ? new Date(row.settled_at).toLocaleDateString() : "-"}</TableCell>
                <TableCell>
                  {!row.is_settled && canRecordCollections ? (
                    <Button asChild size="sm">
                      <Link href={`/collections/new?invoiceId=${row.id}`}>Record</Link>
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