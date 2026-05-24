"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { DayPicker, type DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useReceiveNotes } from "@/hooks/useReceiveNotes";
import { formatDate } from "@/lib/utils";

import { useRouter } from "next/navigation";
import "react-day-picker/dist/style.css";

export default function ReceiveNotesPage() {
  const router = useRouter();
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
  const { data: receiveNotes, isLoading: isReceiveNotesLoading } = useReceiveNotes();

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
      (receiveNotes ?? []).map((row) => ({
        ...row,
        total_amount: (row.receive_note_items ?? []).reduce(
          (sum, item) => sum + normalizeNumber(item.qty) * normalizeNumber(item.unit_cost),
          0
        )
      })),
    [receiveNotes]
  );

  const filtered = useMemo(() => {
    let rows = notesWithTotals;
    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter((row) =>
        `${row.rn_number} ${row.invoice_number} ${row.supplier_name}`.toLowerCase().includes(q)
      );
    }

    const grnFrom = Number(grnRangeFrom);
    const grnTo = Number(grnRangeTo);
    if (grnRangeFrom !== "" && Number.isFinite(grnFrom)) {
      rows = rows.filter((row) => row.rn_number >= grnFrom);
    }
    if (grnRangeTo !== "" && Number.isFinite(grnTo)) {
      rows = rows.filter((row) => row.rn_number <= grnTo);
    }

    const amountFrom = Number(amountRangeFrom);
    const amountTo = Number(amountRangeTo);
    if (amountRangeFrom !== "" && Number.isFinite(amountFrom)) {
      rows = rows.filter((row) => row.total_amount >= amountFrom);
    }
    if (amountRangeTo !== "" && Number.isFinite(amountTo)) {
      rows = rows.filter((row) => row.total_amount <= amountTo);
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
  }, [amountRangeFrom, amountRangeTo, dateRange, grnRangeFrom, grnRangeTo, notesWithTotals, query]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">GRN</h1>
          <p className="text-sm text-muted-foreground">GRN log from suppliers.</p>
        </div>
        {canManageReceiveNotes ? (
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/suppliers">View Suppliers</Link>
            </Button>
            <Button asChild>
              <Link href="/receive-notes/new">New GRN</Link>
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-sm">
          <Input placeholder="Search GRNs..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <Button type="button" variant="ghost" onClick={() => setFiltersOpen((prev) => !prev)}>
          {filtersOpen ? "Hide filters" : "Show filters"}
        </Button>
        <Button type="button" variant="outline" onClick={handleResetFilters} disabled={!hasFilters}>
          Reset filters
        </Button>
      </div>

      {filtersOpen ? (
        <div className="grid gap-3 rounded-md border border-border bg-muted/20 p-3 md:grid-cols-3">
          <div className="relative space-y-1" ref={datePickerRef}>
            <label className="text-xs font-semibold text-muted-foreground">Date range</label>
            <Button type="button" variant="outline" onClick={() => setIsDatePickerOpen((prev) => !prev)}>
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
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-sm text-muted-foreground">
                No GRNs found.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((row) => (
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
    </section>
  );
}
