"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";

import "react-day-picker/dist/style.css";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useQuotations } from "@/hooks/useQuotations";
import { formatDate } from "@/lib/utils";

export default function QuotationsPage() {
  const { user, isLoading: isPermissionsLoading } = useCurrentUserPermissions();
  const { data: quotations, isLoading: isQuotationsLoading, isError, error } = useQuotations();
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
  const [minQuotationNo, setMinQuotationNo] = useState("");
  const [maxQuotationNo, setMaxQuotationNo] = useState("");

  const getStatusLabel = (status: string) => {
    if (status === "pending_approval") return "Pending approval";
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

  const hasFilters = 
    customerSearch !== "" ||
    Boolean(dateRange?.from) ||
    Boolean(dateRange?.to) ||
    statusFilter !== "all" ||
    minTotal !== "" ||
    maxTotal !== "" ||
    minQuotationNo !== "" ||
    maxQuotationNo !== "";

  const handleResetFilters = () => {
    setCustomerSearch("");
    setDateRange(undefined);
    setStatusFilter("all");
    setMinTotal("");
    setMaxTotal("");
    setMinQuotationNo("");
    setMaxQuotationNo("");
  };

  const filteredQuotations = useMemo(() => {
    if (!quotations) return [];
    let result = quotations;

    if (customerSearch) {
      const lowerSearch = customerSearch.toLowerCase();
      result = result.filter((inv) =>
        inv.customer_name.toLowerCase().includes(lowerSearch) ||
        `Q${inv.quotation_number ?? ""}`.toLowerCase().includes(lowerSearch)
      );
    }

    if (dateRange?.from) {
      const start = new Date(dateRange.from).getTime();
      result = result.filter((inv) => new Date(inv.created_at).getTime() >= start);
    }
    if (dateRange?.to) {
      const end = new Date(dateRange.to);
      end.setHours(23, 59, 59, 999);
      result = result.filter((inv) => new Date(inv.created_at).getTime() <= end.getTime());
    }

    if (statusFilter !== "all") {
      if (statusFilter === "approved") {
        result = result.filter((inv) => inv.status === "approved" || inv.status === "issued");
      } else {
        result = result.filter((inv) => inv.status === statusFilter);
      }
    }

    if (minTotal) {
      result = result.filter((inv) => inv.total_amount >= Number(minTotal));
    }
    if (maxTotal) {
      result = result.filter((inv) => inv.total_amount <= Number(maxTotal));
    }

    if (minQuotationNo) {
      result = result.filter((inv) => (inv.quotation_number ?? 0) >= Number(minQuotationNo));
    }
    if (maxQuotationNo) {
      result = result.filter((inv) => (inv.quotation_number ?? 0) <= Number(maxQuotationNo));
    }

    return result;
  }, [quotations, customerSearch, dateRange, statusFilter, minTotal, maxTotal, minQuotationNo, maxQuotationNo]);

  const sortedQuotations = useMemo(
    () => [...filteredQuotations].sort((a, b) => (b.quotation_number ?? 0) - (a.quotation_number ?? 0)),
    [filteredQuotations]
  );

  const handleRowClick = (row: (typeof sortedQuotations)[number]) => {
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
        <h1 className="text-2xl font-bold">Quotations</h1>
        <p className="text-sm text-muted-foreground">Failed to load quotations.</p>
        <p className="text-xs text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
      </section>
    );
  }

  if (user?.role !== "admin" && user?.role !== "manager") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Quotations</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to view quotations.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quotations</h1>
          <p className="text-sm text-muted-foreground">Track quotation issuance, payment methods, and statuses.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/invoices">Back to Invoices</Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-3 rounded-md border border-border bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <Input
              placeholder="Search customer or quotation #..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="lg:max-w-md"
            />
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
          <div className="grid grid-cols-1 gap-4 rounded-md border border-border bg-muted/30 p-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Status</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
              <button
                type="button"
                onClick={() => setIsDatePickerOpen((prev) => !prev)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm text-foreground transition focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <span className={dateRange?.from ? "text-foreground" : "text-muted-foreground"}>
                  {dateRangeLabel}
                </span>
                <span className="text-xs text-muted-foreground">Pick</span>
              </button>
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
              <label className="text-xs font-semibold text-muted-foreground">Quotation # Range</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minQuotationNo}
                  onChange={(e) => setMinQuotationNo(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxQuotationNo}
                  onChange={(e) => setMaxQuotationNo(e.target.value)}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quotation #</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isQuotationsLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                Loading quotations...
              </TableCell>
            </TableRow>
          ) : sortedQuotations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                No quotations found matching criteria.
              </TableCell>
            </TableRow>
          ) : (
            sortedQuotations.map((row) => (
              <TableRow
                key={row.id}
                onClick={() => handleRowClick(row)}
                className={
                  row.status === "draft"
                    ? "bg-muted/30 cursor-pointer"
                    : row.status === "pending_approval"
                      ? "bg-orange-50 hover:bg-orange-100 cursor-pointer"
                      : "cursor-pointer"
                }
              >
                <TableCell className="font-medium">Q{row.quotation_number ?? "-"}</TableCell>
                <TableCell>{formatDate(row.created_at)}</TableCell>
                <TableCell>{row.customer_name}</TableCell>
                <TableCell className="capitalize">{row.payment_method}</TableCell>
                <TableCell>LKR {row.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(row.status)}>{getStatusLabel(row.status)}</Badge>
                </TableCell>
                <TableCell>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={row.status === "draft" ? `/invoices/new?draftId=${row.id}` : `/invoices/${row.id}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      View
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </section>
  );
}
