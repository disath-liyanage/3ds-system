"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";

import "react-day-picker/dist/style.css";

import {
  deleteCollectionEntry,
  getCollectionContextById,
  getInvoiceCollectionHistory,
  type InvoiceCollectionHistoryRow,
  updateCollectionEntry
} from "@/app/actions/collections";
import { getSalesReps } from "@/app/actions/customers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCollectionInvoices } from "@/hooks/useCollectionInvoices";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";
import { useSearchParams } from "next/navigation";

type StatusFilter = "open" | "unpaid" | "partially_paid" | "paid" | "all";

const statusOptions = [
  { value: "open", label: "Unpaid + P. Paid" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "all", label: "All" }
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 2 }).format(value);
const PAGE_SIZE = 50;
const invoiceLinkClassName = "font-medium text-primary underline-offset-2 hover:underline";

export default function CollectionsPage() {
  const searchParams = useSearchParams();
  const { permissions, isLoading, user } = useCurrentUserPermissions();
  const { data: invoices, isLoading: isInvoicesLoading, error } = useCollectionInvoices();
  const queryClient = useQueryClient();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [salesRepFilter, setSalesRepFilter] = useState("all");
  const [historyInvoiceId, setHistoryInvoiceId] = useState<string | null>(null);
  const [historyInvoiceNumber, setHistoryInvoiceNumber] = useState<number | null>(null);
  const [focusedCollectionId, setFocusedCollectionId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<InvoiceCollectionHistoryRow | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editType, setEditType] = useState<"cash" | "cheque">("cash");
  const [editDepositDate, setEditDepositDate] = useState("");
  const [editNotes, setEditNotes] = useState("");

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

  const historyQuery = useQuery<InvoiceCollectionHistoryRow[]>({
    queryKey: ["invoice-collection-history", historyInvoiceId],
    queryFn: async () => {
      if (!historyInvoiceId) return [];
      const result = await getInvoiceCollectionHistory(historyInvoiceId);
      if (!result.success) throw new Error(result.error || "Failed to load collection history");
      return result.data ?? [];
    },
    enabled: Boolean(historyInvoiceId)
  });

  const updateEntryMutation = useMutation({
    mutationFn: async () => {
      if (!editingEntry) throw new Error("No collection selected");
      const result = await updateCollectionEntry({
        collection_id: editingEntry.id,
        amount: Number(editAmount),
        payment_type: editType,
        cheque_deposit_date: editType === "cheque" ? editDepositDate : undefined,
        notes: editNotes
      });
      if (!result.success) throw new Error(result.error || "Failed to update collection");
      return result;
    },
    onSuccess: async () => {
      toast({ title: "Collection updated", variant: "success" });
      setEditingEntry(null);
      await queryClient.invalidateQueries({ queryKey: ["invoice-collection-history", historyInvoiceId] });
      await queryClient.invalidateQueries({ queryKey: ["collection-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["collection-approval-summaries"] });
      await queryClient.invalidateQueries({ queryKey: ["collection-approval-detail"] });
    },
    onError: (error) => {
      toast({ title: "Update failed", description: String(error), variant: "error" });
    }
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (collectionId: string) => {
      const result = await deleteCollectionEntry(collectionId);
      if (!result.success) throw new Error(result.error || "Failed to delete collection");
      return result;
    },
    onSuccess: async () => {
      toast({ title: "Collection deleted", variant: "success" });
      await queryClient.invalidateQueries({ queryKey: ["invoice-collection-history", historyInvoiceId] });
      await queryClient.invalidateQueries({ queryKey: ["collection-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["collection-approval-summaries"] });
      await queryClient.invalidateQueries({ queryKey: ["collection-approval-detail"] });
    },
    onError: (error) => {
      toast({ title: "Delete failed", description: String(error), variant: "error" });
    }
  });

  const filteredInvoices = useMemo(() => {
    let rows = invoices ?? [];

    if (customerSearch) {
      const lowerSearch = customerSearch.toLowerCase();
      rows = rows.filter((row) =>
        `${row.customer_name} ${row.invoice_number}`.toLowerCase().includes(lowerSearch)
      );
    }

    if (statusFilter === "open") {
      rows = rows.filter((row) => row.payment_status === "unpaid" || row.payment_status === "partially_paid");
    } else if (statusFilter !== "all") {
      rows = rows.filter((row) => row.payment_status === statusFilter);
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

    if (statusFilter === "paid") {
      rows = [...rows].sort((a, b) => {
        const aTime = new Date(a.settled_at || a.last_collection_at || a.created_at).getTime();
        const bTime = new Date(b.settled_at || b.last_collection_at || b.created_at).getTime();
        return bTime - aTime;
      });
    }

    return rows;
  }, [invoices, customerSearch, statusFilter, salesRepFilter, dateRange]);
  const totalRows = filteredInvoices.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const startRow = totalRows === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endRow = totalRows === 0 ? 0 : Math.min(page * PAGE_SIZE, totalRows);
  const pagedInvoices = useMemo(
    () => filteredInvoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredInvoices, page]
  );

  const hasFilters =
    customerSearch !== "" ||
    Boolean(dateRange?.from) ||
    Boolean(dateRange?.to) ||
    statusFilter !== "open" ||
    salesRepFilter !== "all";

  const handleResetFilters = () => {
    setCustomerSearch("");
    setDateRange(undefined);
    setStatusFilter("open");
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

  useEffect(() => {
    const collectionId = searchParams.get("collectionId");
    if (!collectionId) return;

    let active = true;
    void (async () => {
      const result = await getCollectionContextById(collectionId);
      if (!active || !result.success || !result.data) return;
      setHistoryInvoiceId(result.data.invoice_id);
      setHistoryInvoiceNumber(result.data.invoice_number);
      setFocusedCollectionId(result.data.collection_id);
    })();

    return () => {
      active = false;
    };
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [customerSearch, statusFilter, salesRepFilter, dateRange?.from, dateRange?.to]);

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
        <div className="flex flex-wrap items-center gap-2">
          {isManagerOrAdmin ? (
            <Button variant="outline" asChild>
              <Link href="/collections/approvals">Approve Collections</Link>
            </Button>
          ) : null}
          {canRecordCollections && !isManagerOrAdmin ? (
            <Button variant="outline" asChild>
              <Link href="/collections/expenses">Expenses</Link>
            </Button>
          ) : null}
          {canRecordCollections ? (
            <Button asChild>
              <Link href="/collections/new">
                {isManagerOrAdmin ? "Record Collection" : "Record Outside Collection"}
              </Link>
            </Button>
          ) : null}
        </div>
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
            <TableHead>Invoice</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Remaining</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Sales Rep</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Settled</TableHead>
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
          ) : pagedInvoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-sm text-muted-foreground">
                No invoices match the current filters.
              </TableCell>
            </TableRow>
          ) : (
            pagedInvoices.map((row) => (
              <TableRow
                key={row.id}
                className={row.payment_status === "partially_paid" ? "hover:bg-muted/30" : undefined}
              >
                <TableCell
                  className={row.payment_status === "partially_paid" ? "cursor-pointer" : undefined}
                  onClick={
                    row.payment_status === "partially_paid"
                      ? () => {
                          setHistoryInvoiceId(row.id);
                          setHistoryInvoiceNumber(row.invoice_number);
                        }
                      : undefined
                  }
                >
                  <Link
                    href={`/invoices/${row.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={invoiceLinkClassName}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {row.invoice_number}
                  </Link>
                </TableCell>
                <TableCell
                  className={row.payment_status === "partially_paid" ? "cursor-pointer" : undefined}
                  onClick={
                    row.payment_status === "partially_paid"
                      ? () => {
                          setHistoryInvoiceId(row.id);
                          setHistoryInvoiceNumber(row.invoice_number);
                        }
                      : undefined
                  }
                >
                  {row.customer_name}
                </TableCell>
                <TableCell
                  className={row.payment_status === "partially_paid" ? "cursor-pointer" : undefined}
                  onClick={
                    row.payment_status === "partially_paid"
                      ? () => {
                          setHistoryInvoiceId(row.id);
                          setHistoryInvoiceNumber(row.invoice_number);
                        }
                      : undefined
                  }
                >
                  <div className="flex flex-col">
                    <span>{formatCurrency(row.remaining_amount)}</span>
                    {row.payment_status === "partially_paid" ? (
                      <span className="text-xs text-muted-foreground">
                        Collected {formatCurrency(row.collected_total)} / {formatCurrency(row.total_amount)}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell
                  className={row.payment_status === "partially_paid" ? "cursor-pointer" : undefined}
                  onClick={
                    row.payment_status === "partially_paid"
                      ? () => {
                          setHistoryInvoiceId(row.id);
                          setHistoryInvoiceNumber(row.invoice_number);
                        }
                      : undefined
                  }
                >
                  {formatDate(row.due_date)}
                </TableCell>
                <TableCell>{row.sales_rep_name || "Unassigned"}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      row.payment_status === "paid"
                        ? "success"
                        : row.payment_status === "partially_paid"
                          ? "default"
                          : "warning"
                    }
                  >
                    {row.payment_status === "paid"
                      ? "Paid"
                      : row.payment_status === "partially_paid"
                        ? "P. Paid"
                        : "Unpaid"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {row.payment_status === "paid"
                    ? formatDate(row.settled_at || row.last_collection_at || row.created_at)
                    : row.settled_at
                      ? formatDate(row.settled_at)
                      : "-"}
                </TableCell>
                <TableCell>
                  {row.payment_status !== "paid" && canRecordCollections ? (
                    <Button asChild size="sm" onClick={(event) => event.stopPropagation()}>
                      <Link href={`/collections/new?invoiceId=${row.id}`}>Record</Link>
                    </Button>
                  ) : row.payment_status === "paid" || row.payment_status === "partially_paid" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        setHistoryInvoiceId(row.id);
                        setHistoryInvoiceNumber(row.invoice_number);
                      }}
                    >
                      History
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
      <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
        <button
          type="button"
          onClick={() => setPage((prev) => prev - 1)}
          aria-label="Previous page"
          disabled={page <= 1 || isInvoicesLoading}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-white/80 text-muted-foreground shadow-sm backdrop-blur-sm transition hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span>{`Rows ${startRow} - ${endRow} of ${totalRows}`}</span>
        <button
          type="button"
          onClick={() => setPage((prev) => prev + 1)}
          aria-label="Next page"
          disabled={page >= totalPages || isInvoicesLoading}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-white/80 text-muted-foreground shadow-sm backdrop-blur-sm transition hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <Dialog
        open={Boolean(historyInvoiceId)}
        onOpenChange={(open) => {
          if (!open) {
            setHistoryInvoiceId(null);
            setHistoryInvoiceNumber(null);
            setFocusedCollectionId(null);
          }
        }}
        title={
          historyInvoiceId && historyInvoiceNumber ? (
            <>
              Collection History · Invoice{" "}
              <Link
                href={`/invoices/${historyInvoiceId}`}
                target="_blank"
                rel="noopener noreferrer"
                className={invoiceLinkClassName}
              >
                #{historyInvoiceNumber}
              </Link>
            </>
          ) : (
            "Collection History"
          )
        }
        description="View how this invoice was collected."
        showBottomClose={false}
      >
        {historyQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading history...</p>
        ) : historyQuery.isError ? (
          <p className="text-sm text-destructive">Failed to load history.</p>
        ) : historyQuery.data && historyQuery.data.length > 0 ? (
          <div className="max-h-[60vh] space-y-3 overflow-auto pr-1">
            {historyQuery.data.map((entry) => (
              <div
                key={entry.id}
                className={`rounded-md border p-3 text-sm ${
                  focusedCollectionId === entry.id ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Collection #{entry.collection_number}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(entry.created_at)}</p>
                  </div>
                  <Badge variant={entry.status === "validated" ? "success" : entry.status === "rejected" ? "danger" : "warning"}>
                    {entry.status}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground">
                  <p>Amount: {formatCurrency(entry.amount)}</p>
                  <p>Type: {entry.payment_type === "cheque" ? "Cheque" : "Cash"}</p>
                  <p>Collected By: {entry.collected_by_name || "-"}</p>
                  <p>Sales Rep: {entry.sales_rep_name || "-"}</p>
                  {entry.payment_type === "cheque" ? (
                    <p>Deposit Date: {entry.cheque_deposit_date ? formatDate(entry.cheque_deposit_date) : "-"}</p>
                  ) : null}
                  <p>Validated By: {entry.validated_by_name || "-"}</p>
                  <p>Notes: {entry.notes || "-"}</p>
                </div>
                {(() => {
                  const isManagerOrAdmin = user?.role === "admin" || user?.role === "manager";
                  const isSalesRepOwnPending =
                    user?.role === "sales_rep" && entry.collected_by_id === user?.id && entry.status === "pending";
                  const canEditDelete = isManagerOrAdmin || isSalesRepOwnPending;
                  if (!canEditDelete) return null;

                  return (
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingEntry(entry);
                          setEditAmount(String(entry.amount));
                          setEditType(entry.payment_type);
                          setEditDepositDate(
                            entry.cheque_deposit_date ? entry.cheque_deposit_date.slice(0, 10) : ""
                          );
                          setEditNotes(entry.notes ?? "");
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={deleteEntryMutation.isPending}
                        onClick={() => deleteEntryMutation.mutate(entry.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No collection history found for this invoice.</p>
        )}
      </Dialog>

      <Dialog
        open={Boolean(editingEntry)}
        onOpenChange={(open) => {
          if (!open) setEditingEntry(null);
        }}
        title={editingEntry ? `Edit Collection #${editingEntry.collection_number}` : "Edit Collection"}
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Amount</label>
            <Input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Type</label>
            <Select
              value={editType}
              options={[
                { value: "cash", label: "Cash" },
                { value: "cheque", label: "Cheque" }
              ]}
              onChange={(event) => setEditType(event.target.value as "cash" | "cheque")}
            />
          </div>
          {editType === "cheque" ? (
            <div className="space-y-1">
              <label className="text-sm font-medium">Deposit Date</label>
              <Input type="date" value={editDepositDate} onChange={(e) => setEditDepositDate(e.target.value)} />
            </div>
          ) : null}
          <div className="space-y-1">
            <label className="text-sm font-medium">Notes</label>
            <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button disabled={updateEntryMutation.isPending} onClick={() => updateEntryMutation.mutate()}>
              Save Changes
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
