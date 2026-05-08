"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";

import "react-day-picker/dist/style.css";

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

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("unsettled");
  const [salesRepFilter, setSalesRepFilter] = useState("all");

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

    if (customerSearch) {
      const lowerSearch = customerSearch.toLowerCase();
      rows = rows.filter((row) =>
        `${row.customer_name} ${row.invoice_number}`.toLowerCase().includes(lowerSearch)
      );
    }

    if (statusFilter === "settled") {
      rows = rows.filter((row) => row.is_settled);
    }
    if (statusFilter === "unsettled") {
      rows = rows.filter((row) => !row.is_settled);
    }

    if (salesRepFilter !== "all") {
      rows = rows.filter((row) => row.sales_rep_id === salesRepFilter);
    }

    if (dateRange?.from) {
      const start = new Date(dateRange.from).getTime();
      rows = rows.filter((row) => new Date(row.created_at).getTime() >= start);
    }

    if (dateRange?.to) {
      const end = new Date(dateRange.to);
      end.setHours(23, 59, 59, 999);
      rows = rows.filter((row) => new Date(row.created_at).getTime() <= end.getTime());
    }

    return rows;
  }, [invoices, customerSearch, statusFilter, salesRepFilter, dateRange]);

  const hasFilters =
    customerSearch !== "" ||
    Boolean(dateRange?.from) ||
    Boolean(dateRange?.to) ||
    statusFilter !== "unsettled" ||
    salesRepFilter !== "all";

  const handleResetFilters = () => {
    setCustomerSearch("");
    setDateRange(undefined);
    setStatusFilter("unsettled");
    setSalesRepFilter("all");
  };

  const dateRangeLabel = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, "MMM dd, yyyy")} - ${format(dateRange.to, "MMM dd, yyyy")}`;
    }
    if (dateRange?.from) {
      return `${format(dateRange.from, "MMM dd, yyyy")} - ...`;
    }
    return "Select date range";
  }, [dateRange]);

  useEffect(() => {
    if (!isDatePickerOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!datePickerRef.current || datePickerRef.current.contains(event.target as Node)) return;
      setIsDatePickerOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDatePickerOpen]);

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

      <div className="flex flex-col gap-3 rounded-md border border-border bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <Input
              placeholder="Search customer or invoice #..."
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
              className="lg:max-w-md"
            />
            {hasFilters ? <span className="text-xs text-muted-foreground">Filters active</span> : null}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => setFiltersOpen((prev) => !prev)}>
              <span className="flex items-center gap-2">
                <ChevronRight
                  className={
                    filtersOpen
                      ? "h-4 w-4 rotate-90 transition-transform"
                      : "h-4 w-4 rotate-0 transition-transform"
                  }
                />
                {filtersOpen ? "Hide filters" : "Show filters"}
              </span>
            </Button>
            <Button
              variant={hasFilters ? "default" : "outline"}
              size="sm"
              onClick={handleResetFilters}
              disabled={!hasFilters}
            >
              Reset
            </Button>
            <Button type="button" variant="outline" onClick={toggleSettled}>
              {statusFilter === "settled" ? "Show Unsettled" : "Show Settled"}
            </Button>
          </div>
        </div>

        {filtersOpen ? (
          <div className="grid grid-cols-1 gap-4 rounded-md border border-border bg-muted/30 p-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Status</label>
              <Select
                options={statusOptions}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Date range</label>
              <div className="relative" ref={datePickerRef}>
                <Button type="button" variant="outline" onClick={() => setIsDatePickerOpen((prev) => !prev)}>
                  {dateRangeLabel}
                </Button>
                {isDatePickerOpen ? (
                  <div className="absolute left-0 top-12 z-20 rounded-md border border-border bg-white p-2 shadow-lg">
                    <DayPicker mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                  </div>
                ) : null}
              </div>
            </div>
            {isManagerOrAdmin ? (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Sales rep</label>
                <Select
                  options={salesRepOptions}
                  value={salesRepFilter}
                  onChange={(event) => setSalesRepFilter(event.target.value)}
                />
              </div>
            ) : null}
          </div>
        ) : null}
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