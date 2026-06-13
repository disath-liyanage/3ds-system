"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { DayPicker, type DateRange } from "react-day-picker";
import { ChevronLeft, ChevronRight, Search, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useReceiveNotes } from "@/hooks/useReceiveNotes";
import { formatDate } from "@/lib/utils";

import { useRouter } from "next/navigation";
import "react-day-picker/dist/style.css";

const PAGE_SIZE = 50;

export default function ReceiveNotesPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [grnRangeFrom, setGrnRangeFrom] = useState("");
  const [grnRangeTo, setGrnRangeTo] = useState("");
  const [amountRangeFrom, setAmountRangeFrom] = useState("");
  const [amountRangeTo, setAmountRangeTo] = useState("");
  const { permissions, isLoading } = useCurrentUserPermissions();
  const canManageReceiveNotes = permissions?.canManageReceiveNotes ?? false;
  const canViewReceiveNotes = permissions?.canViewReceiveNotes ?? false;
  const { data, isLoading: isReceiveNotesLoading } = useReceiveNotes({
    page,
    pageSize: PAGE_SIZE,
    query: query.trim() || undefined,
    grnFrom: grnRangeFrom === "" ? undefined : Number(grnRangeFrom),
    grnTo: grnRangeTo === "" ? undefined : Number(grnRangeTo),
    amountFrom: amountRangeFrom === "" ? undefined : Number(amountRangeFrom),
    amountTo: amountRangeTo === "" ? undefined : Number(amountRangeTo),
    fromDate: dateRange?.from ? new Date(dateRange.from).toISOString() : undefined,
    toDate: dateRange?.to ? new Date(new Date(dateRange.to).setHours(23, 59, 59, 999)).toISOString() : undefined
  });

  const normalizeNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 2 }).format(value);

  const dateRangeLabel = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, "MMM dd, yyyy")} - ${format(dateRange.to, "MMM dd, yyyy")}`;
    }
    if (dateRange?.from) {
      return `${format(dateRange.from, "MMM dd, yyyy")} - ...`;
    }
    return "Select date range";
  }, [dateRange]);

  const notesWithTotals = useMemo(
    () =>
      (data?.rows ?? []).map((row) => ({
        ...row,
        total_amount: (row.receive_note_items ?? []).reduce(
          (sum, item) => sum + normalizeNumber(item.qty) * normalizeNumber(item.unit_cost),
          0
        )
      })),
    [data?.rows]
  );
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endRow = total === 0 ? 0 : Math.min(page * PAGE_SIZE, total);

  const hasFilters =
    query !== "" ||
    Boolean(dateRange?.from) ||
    Boolean(dateRange?.to) ||
    grnRangeFrom !== "" ||
    grnRangeTo !== "" ||
    amountRangeFrom !== "" ||
    amountRangeTo !== "";

  const handleResetFilters = () => {
    setQuery("");
    setDateRange(undefined);
    setGrnRangeFrom("");
    setGrnRangeTo("");
    setAmountRangeFrom("");
    setAmountRangeTo("");
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
    setPage(1);
  }, [query, dateRange?.from, dateRange?.to, grnRangeFrom, grnRangeTo, amountRangeFrom, amountRangeTo]);

  if (!isLoading && !canViewReceiveNotes) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">GRN</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to access GRN.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">GRN</h1>
          <p className="text-sm text-muted-foreground">GRN log from suppliers.</p>
        </div>
        {canManageReceiveNotes ? (
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Truck className="mr-2 h-4 w-4" />
              <Link href="/receive-notes/suppliers">Suppliers</Link>
            </Button>
            <Button asChild>
              <Link href="/receive-notes/new">New GRN</Link>
            </Button>
          </div>
        ) : null}
      </div>

      <div className="glass-panel flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search GRNs..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="glass-search  pl-10"
            />
            </div>
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
            <Button variant={hasFilters ? "default" : "outline"} size="sm" onClick={handleResetFilters} disabled={!hasFilters}>
              Reset
            </Button>
          </div>
        </div>

        {filtersOpen ? (
          <div className="glass-panel grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="relative space-y-1" ref={datePickerRef}>
              <label className="text-xs font-semibold text-muted-foreground">Date range</label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => setIsDatePickerOpen((prev) => !prev)}
              >
                {dateRangeLabel}
              </Button>
              {isDatePickerOpen ? (
                <div className="absolute left-0 top-12 z-20 rounded-md border border-border bg-white p-2 shadow-lg">
                  <DayPicker mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                </div>
              ) : null}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">GRN id range</label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="From"
                  value={grnRangeFrom}
                  onChange={(event) => setGrnRangeFrom(event.target.value)}
                />
                <Input type="number" placeholder="To" value={grnRangeTo} onChange={(event) => setGrnRangeTo(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Total invoice range</label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="From"
                  value={amountRangeFrom}
                  onChange={(event) => setAmountRangeFrom(event.target.value)}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="To"
                  value={amountRangeTo}
                  onChange={(event) => setAmountRangeTo(event.target.value)}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>GRN #</TableHead>
            <TableHead>Invoice #</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Received At</TableHead>
            <TableHead>Total Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isReceiveNotesLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-sm text-muted-foreground">
                Loading GRNs...
              </TableCell>
            </TableRow>
          ) : notesWithTotals.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-sm text-muted-foreground">
                No GRNs found.
              </TableCell>
            </TableRow>
          ) : (
            notesWithTotals.map((row) => (
              <TableRow 
                key={row.id}
                className="cursor-pointer transition hover:bg-muted/50"
                onClick={() => router.push(`/receive-notes/${row.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(`/receive-notes/${row.id}`);
                  }
                }}
                tabIndex={0}
              >
                <TableCell>{row.rn_number}</TableCell>
                <TableCell>{row.invoice_number}</TableCell>
                <TableCell>{row.supplier_name}</TableCell>
                <TableCell>{formatDate(row.created_at)}</TableCell>
                <TableCell>{formatCurrency(row.total_amount)}</TableCell>
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
          disabled={page <= 1 || isReceiveNotesLoading}
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
          disabled={page >= totalPages || isReceiveNotesLoading}
          className="h-9 w-9 rounded-full p-0 bg-white/80 text-muted-foreground shadow-sm backdrop-blur-sm hover:border-brand hover:text-brand"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
