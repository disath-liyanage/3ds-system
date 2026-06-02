"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Printer, Search } from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";

import "react-day-picker/dist/style.css";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useInvoices } from "@/hooks/useInvoices";
import { formatDate } from "@/lib/utils";

const PAGE_SIZE = 50;

export default function InvoicesPage() {
  const { permissions, user, isLoading: isPermissionsLoading } = useCurrentUserPermissions();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [minTotal, setMinTotal] = useState("");
  const [maxTotal, setMaxTotal] = useState("");
  const [minInvoiceNo, setMinInvoiceNo] = useState("");
  const [maxInvoiceNo, setMaxInvoiceNo] = useState("");
  const [page, setPage] = useState(1);
  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";
  const { data, isLoading: isInvoicesLoading, isError, error } = useInvoices({
    page,
    pageSize: PAGE_SIZE,
    customerSearch: customerSearch.trim() || undefined,
    status: statusFilter,
    minTotal: minTotal === "" ? undefined : Number(minTotal),
    maxTotal: maxTotal === "" ? undefined : Number(maxTotal),
    minInvoiceNo: minInvoiceNo === "" ? undefined : Number(minInvoiceNo),
    maxInvoiceNo: maxInvoiceNo === "" ? undefined : Number(maxInvoiceNo),
    fromDate: dateRange?.from ? new Date(dateRange.from).toISOString() : undefined,
    toDate: dateRange?.to
      ? new Date(new Date(dateRange.to).setHours(23, 59, 59, 999)).toISOString()
      : undefined
  });

  const getStatusLabel = (status: string) => {
    if (status === "pending_approval") return "Pending";
    if (status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";
    if (status === "issued") return "Approved";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getStatusVariant = (status: string) => {
    if (status === "paid" || status === "approved" || status === "issued") return "success";
    if (status === "rejected") return "danger";
    if (status === "pending_approval" || status === "draft") return "warning";
    return "default";
  };

  const getInvoiceStatusBadge = (row: (typeof rows)[number]) => {
    const isOutstandingInvoice = row.payment_method === "credit" || row.payment_method === "on_account";
    const paymentStatus = row.payment_status ?? (row.status === "paid" ? "paid" : "unpaid");
    const isPaid = row.status === "paid" || (isOutstandingInvoice && paymentStatus === "paid");
    const isPartiallyPaid = isOutstandingInvoice && paymentStatus === "partially_paid";
    const isApprovedUnsettledCredit =
      isOutstandingInvoice && (row.status === "approved" || row.status === "issued") && paymentStatus === "unpaid";

    if (isPaid) return { label: "Paid", variant: "success-dark" } as const;
    if (isPartiallyPaid) return { label: "P. Paid", variant: "warning" } as const;
    if (isApprovedUnsettledCredit) return { label: "Approved", variant: "success" } as const;
    if (row.status === "pending_approval") return { label: "Pending", variant: "default" } as const;

    return { label: getStatusLabel(row.status), variant: getStatusVariant(row.status) } as const;
  };

  const hasFilters = 
    customerSearch !== "" ||
    Boolean(dateRange?.from) ||
    Boolean(dateRange?.to) ||
    statusFilter !== "all" ||
    minTotal !== "" ||
    maxTotal !== "" ||
    minInvoiceNo !== "" ||
    maxInvoiceNo !== "";

  const handleResetFilters = () => {
    setCustomerSearch("");
    setDateRange(undefined);
    setStatusFilter("all");
    setMinTotal("");
    setMaxTotal("");
    setMinInvoiceNo("");
    setMaxInvoiceNo("");
  };

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endRow = total === 0 ? 0 : Math.min(page * PAGE_SIZE, total);

  const handleRowClick = (row: (typeof rows)[number]) => {
    if (row.status === "draft") {
      router.push(`/invoices/new?draftId=${row.id}`);
      return;
    }

    router.push(`/invoices/${row.id}`);
  };

  useEffect(() => {
    if (!isDatePickerOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!datePickerRef.current || datePickerRef.current.contains(event.target as Node)) return;
      setIsDatePickerOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDatePickerOpen]);

  useEffect(() => {
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    if (!fromParam && !toParam) return;

    const fromDate = fromParam ? new Date(fromParam) : undefined;
    const toDate = toParam ? new Date(toParam) : fromDate;
    if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) return;

    setDateRange({
      from: fromDate,
      to: toDate
    });
    setFiltersOpen(true);
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [customerSearch, dateRange?.from, dateRange?.to, statusFilter, minTotal, maxTotal, minInvoiceNo, maxInvoiceNo]);

  const dateRangeLabel = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, "MMM dd, yyyy")} - ${format(dateRange.to, "MMM dd, yyyy")}`;
    }
    if (dateRange?.from) {
      return `${format(dateRange.from, "MMM dd, yyyy")} - ...`;
    }
    return "Select date range";
  }, [dateRange]);

  if (isPermissionsLoading) {
    return <p className="text-sm text-muted-foreground">Loading permissions...</p>;
  }

  if (isError) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-sm text-muted-foreground">Failed to load invoices.</p>
        <p className="text-xs text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
      </section>
    );
  }

  // NOTE: assuming canCreateInvoices also grants view permissions for simplicity,
  // or you could have a dedicated canViewInvoices. Using canCreateInvoices for now.
  if (!permissions?.canCreateInvoices) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to view invoices.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground">Track issuance, payment methods, and statuses.</p>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === "admin" || user?.role === "manager" ? (
            <Button asChild variant="outline">
              <Link href="/invoices/quotations">Quotations</Link>
            </Button>
          ) : null}
          {user?.role === "admin" || user?.role === "manager" ? (
            <Button asChild variant="outline">
              <Link href="/invoices/return">Return Invoice</Link>
            </Button>
          ) : null}
          <Button asChild>
            <Link href="/invoices/new">New Invoice</Link>
          </Button>
        </div>
      </header>

      <div className="glass-panel flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search customer, invoice #, or quotation #..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="glass-search pl-10"
            />
            </div>
            {hasFilters ? <span className="text-xs text-muted-foreground">Filters active</span> : null}
          </div>
            <div className="flex items-center gap-2">
            <Button
              type="button"
                variant="ghost"
              onClick={() => setFiltersOpen((prev) => !prev)}
            >
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
          </div>
        </div>

        {filtersOpen ? (
          <div className="glass-panel grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Status</label>
              <select
                className="glass-field flex h-10 w-full px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Status filter"
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            <div className="space-y-1" ref={datePickerRef}>
              <label className="text-xs font-semibold text-muted-foreground">Date Range</label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDatePickerOpen((prev) => !prev)}
                className="h-10 w-full justify-between px-3 text-sm font-normal"
              >
                <span className={dateRange?.from ? "text-foreground" : "text-muted-foreground"}>
                  {dateRangeLabel}
                </span>
                <span className="text-xs text-muted-foreground">Pick</span>
              </Button>
              {isDatePickerOpen ? (
                <div className="relative">
                  <div className="absolute z-20 mt-2 rounded-md border border-border bg-white p-3 shadow-lg">
                    <DayPicker
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      defaultMonth={dateRange?.from}
                      className="rounded-md"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Total (LKR)</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minTotal}
                  onChange={(e) => setMinTotal(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxTotal}
                  onChange={(e) => setMaxTotal(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Invoice # Range</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minInvoiceNo}
                  onChange={(e) => setMinInvoiceNo(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxInvoiceNo}
                  onChange={(e) => setMaxInvoiceNo(e.target.value)}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isInvoicesLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                Loading invoices...
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                No invoices found matching criteria.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={() => handleRowClick(row)}
                className={
                  row.status === "draft"
                    ? "bg-muted/30 cursor-pointer"
                    : row.status === "pending_approval"
                      ? "bg-brand-light/70 hover:bg-brand-light cursor-pointer"
                      : "cursor-pointer"
                }
              >
                <TableCell className="font-medium">
                  {row.quotation_number ? `Q${row.quotation_number}` : row.invoice_number}
                </TableCell>
                <TableCell>{formatDate(row.created_at)}</TableCell>
                <TableCell>{row.customer_name}</TableCell>
                <TableCell className="capitalize">{row.payment_method === "on_account" ? "On Account" : row.payment_method}</TableCell>
                <TableCell>LKR {row.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  {(() => {
                    const badge = getInvoiceStatusBadge(row);
                    return <Badge variant={badge.variant}>{badge.label}</Badge>;
                  })()}
                </TableCell>
                <TableCell>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={row.status === "draft" ? `/invoices/new?draftId=${row.id}` : `/invoices/${row.id}?print=true`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPage((prev) => prev - 1)}
          aria-label="Previous page"
          disabled={page <= 1 || isInvoicesLoading}
          className="h-9 w-9 rounded-full p-0 bg-white/80 text-muted-foreground shadow-sm backdrop-blur-sm hover:border-brand hover:text-brand"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span>{`Rows ${startRow} - ${endRow} of ${total}`}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPage((prev) => prev + 1)}
          aria-label="Next page"
          disabled={page >= totalPages || isInvoicesLoading}
          className="h-9 w-9 rounded-full p-0 bg-white/80 text-muted-foreground shadow-sm backdrop-blur-sm hover:border-brand hover:text-brand"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
