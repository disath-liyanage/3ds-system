"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import { recordCollectionBatch } from "@/app/actions/collections";
import { getCollectionRecipients } from "@/app/actions/customers";
import { getInvoiceDetail } from "@/app/actions/invoices";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select } from "@/components/ui/select";
import { COLLECTION_EXPENSES_QUERY_KEY } from "@/hooks/useCollectionExpenses";
import { COLLECTION_INVOICES_QUERY_KEY, useCollectionInvoices } from "@/hooks/useCollectionInvoices";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";
import { CirclePlus, Save } from "lucide-react";

type NewCollectionForm = {
  invoice_id: string;
  amount: number;
  payment_type: "cash" | "cheque";
  cheque_deposit_date: string;
  notes: string;
};

type ExpenseForm = {
  category: ExpenseCategory;
  amount: number;
  notes: string;
};

type StagedCollectionEntry = NewCollectionForm & {
  id: string;
  invoice_number: number;
  customer_name: string;
  remaining_amount: number;
};

type StagedExpenseEntry = ExpenseForm & {
  id: string;
};

type ExpenseCategory = "Fuel" | "Food" | "Parking" | "Other";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 2 }).format(value);

const getLineTotal = (item: {
  qty: number;
  unit_price: number;
  discount_type: "percent" | "amount";
  discount_value: number;
}) => {
  const discountPerUnit =
    item.discount_type === "percent" ? (Number(item.unit_price) * Number(item.discount_value)) / 100 : Number(item.discount_value);
  const effectiveUnitPrice = Math.max(0, Number(item.unit_price) - discountPerUnit);
  return Number(item.qty) * effectiveUnitPrice;
};

const createLocalId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export default function NewCollectionPage() {
  const { permissions, isLoading, user } = useCurrentUserPermissions();
  const { data: invoices, isLoading: isInvoicesLoading } = useCollectionInvoices();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialInvoiceId = searchParams.get("invoiceId") || "";

  const { register, setValue, watch, reset } = useForm<NewCollectionForm>({
    defaultValues: {
      invoice_id: initialInvoiceId,
      amount: 0,
      payment_type: "cash",
      cheque_deposit_date: "",
      notes: ""
    }
  });

  const expenseForm = useForm<ExpenseForm>({
    defaultValues: {
      category: "Fuel",
      amount: 0,
      notes: ""
    }
  });

  const isManagerOrAdmin = user?.role === "admin" || user?.role === "manager";
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [stagedCollections, setStagedCollections] = useState<StagedCollectionEntry[]>([]);
  const [stagedExpenses, setStagedExpenses] = useState<StagedExpenseEntry[]>([]);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [isInvoiceExpanded, setIsInvoiceExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recipientsQuery = useQuery({
    queryKey: ["collection-recipients"],
    queryFn: async () => await getCollectionRecipients(),
    enabled: true
  });

  useEffect(() => {
    if (!isManagerOrAdmin && user?.id) {
      setSelectedRecipientId(user.id);
    }
  }, [isManagerOrAdmin, user?.id]);

  const recipientOptions = useMemo(
    () =>
      (recipientsQuery.data || []).map((recipient) => ({
        value: recipient.id,
        label: recipient.full_name,
        meta: recipient.role === "driver" ? "Driver" : "Sales rep"
      })),
    [recipientsQuery.data]
  );

  const selectedRecipient = useMemo(
    () => recipientOptions.find((recipient) => recipient.value === selectedRecipientId) || null,
    [recipientOptions, selectedRecipientId]
  );

  const stagedTotalsByInvoice = useMemo(() => {
    const totals = new Map<string, number>();
    for (const entry of stagedCollections) {
      if (entry.id === editingCollectionId) continue;
      totals.set(entry.invoice_id, (totals.get(entry.invoice_id) ?? 0) + Number(entry.amount));
    }
    return totals;
  }, [editingCollectionId, stagedCollections]);

  const availableInvoices = useMemo(() => {
    let rows = (invoices || []).filter((row) => !row.is_settled);

    if (user?.role === "sales_rep") {
      rows = rows.filter((row) => !row.sales_rep_id || row.sales_rep_id === user.id);
    }

    return rows;
  }, [invoices, user?.id, user?.role]);

  const invoiceOptions = useMemo(
    () =>
      availableInvoices.map((row) => {
        const stagedTotal = stagedTotalsByInvoice.get(row.id) ?? 0;
        const remainingForSession = Math.max(0, Number(row.remaining_amount) - stagedTotal);
        return {
          value: row.id,
          label: `#${row.invoice_number} · ${row.customer_name}`,
          subLabel: `Remaining ${formatCurrency(remainingForSession)} · Due ${formatDate(row.due_date)}`,
          meta: row.sales_rep_name || "Unassigned"
        };
      }),
    [availableInvoices, stagedTotalsByInvoice]
  );

  const selectedInvoiceId = watch("invoice_id");
  const paymentType = watch("payment_type");
  const selectedInvoice = useMemo(
    () => availableInvoices.find((row) => row.id === selectedInvoiceId) || null,
    [availableInvoices, selectedInvoiceId]
  );
  const selectedInvoiceStagedTotal = selectedInvoice ? stagedTotalsByInvoice.get(selectedInvoice.id) ?? 0 : 0;
  const selectedInvoiceRemainingForSession = selectedInvoice
    ? Math.max(0, Number(selectedInvoice.remaining_amount) - selectedInvoiceStagedTotal)
    : 0;

  const invoiceDetailQuery = useQuery({
    queryKey: ["collection-invoice-detail", selectedInvoiceId],
    queryFn: async () => {
      const result = await getInvoiceDetail(selectedInvoiceId);
      if (!result.success) throw new Error(result.error || "Failed to load invoice");
      return result.data;
    },
    enabled: Boolean(selectedInvoiceId && isInvoiceExpanded)
  });

  useEffect(() => {
    if (!selectedInvoice || editingCollectionId) return;
    setValue("amount", selectedInvoiceRemainingForSession);
  }, [editingCollectionId, selectedInvoice, selectedInvoiceRemainingForSession, setValue]);

  useEffect(() => {
    setIsInvoiceExpanded(false);
  }, [selectedInvoiceId]);

  const summary = useMemo(() => {
    const totalCashCollected = stagedCollections
      .filter((entry) => entry.payment_type === "cash")
      .reduce((sum, entry) => sum + Number(entry.amount), 0);
    const totalChequesCollected = stagedCollections
      .filter((entry) => entry.payment_type === "cheque")
      .reduce((sum, entry) => sum + Number(entry.amount), 0);
    const totalExpenses = stagedExpenses.reduce((sum, entry) => sum + Number(entry.amount), 0);

    return {
      totalCashCollected,
      totalChequesCollected,
      totalExpenses,
      cashInHand: totalCashCollected - totalExpenses
    };
  }, [stagedCollections, stagedExpenses]);

  const resetCollectionForm = () => {
    reset({
      invoice_id: "",
      amount: 0,
      payment_type: "cash",
      cheque_deposit_date: "",
      notes: ""
    });
    setEditingCollectionId(null);
  };

  const handleStageCollection = () => {
    const values = watch();
    if (!selectedRecipientId) {
      toast({ title: "User required", description: "Select a sales rep or driver for this session.", variant: "error" });
      return;
    }
    if (!selectedInvoice) {
      toast({ title: "Invoice required", description: "Select an invoice before adding the collection.", variant: "error" });
      return;
    }

    const amount = Number(values.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Invalid amount", description: "Amount must be greater than 0.", variant: "error" });
      return;
    }
    if (amount > selectedInvoiceRemainingForSession + 0.01) {
      toast({
        title: "Amount exceeds remaining",
        description: `This session has ${formatCurrency(selectedInvoiceRemainingForSession)} remaining for the selected invoice.`,
        variant: "error"
      });
      return;
    }
    if (values.payment_type === "cheque" && !values.cheque_deposit_date) {
      toast({ title: "Deposit date required", description: "Select the cheque deposit date.", variant: "error" });
      return;
    }

    const nextEntry: StagedCollectionEntry = {
      id: editingCollectionId || createLocalId(),
      invoice_id: selectedInvoice.id,
      invoice_number: selectedInvoice.invoice_number,
      customer_name: selectedInvoice.customer_name,
      remaining_amount: Number(selectedInvoice.remaining_amount),
      amount,
      payment_type: values.payment_type,
      cheque_deposit_date: values.payment_type === "cheque" ? values.cheque_deposit_date : "",
      notes: values.notes?.trim() || ""
    };

    setStagedCollections((prev) =>
      editingCollectionId ? prev.map((entry) => (entry.id === editingCollectionId ? nextEntry : entry)) : [...prev, nextEntry]
    );
    resetCollectionForm();
  };

  const handleEditCollection = (entry: StagedCollectionEntry) => {
    setEditingCollectionId(entry.id);
    reset({
      invoice_id: entry.invoice_id,
      amount: entry.amount,
      payment_type: entry.payment_type,
      cheque_deposit_date: entry.cheque_deposit_date,
      notes: entry.notes
    });
  };

  const handleRemoveCollection = (entryId: string) => {
    setStagedCollections((prev) => prev.filter((entry) => entry.id !== entryId));
    if (editingCollectionId === entryId) {
      resetCollectionForm();
    }
  };

  const handleStageExpense = () => {
    const values = expenseForm.getValues();
    const amount = Number(values.amount);
    if (!selectedRecipientId) {
      toast({ title: "User required", description: "Select a sales rep or driver for this session.", variant: "error" });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Invalid expense", description: "Expense amount must be greater than 0.", variant: "error" });
      return;
    }

    const nextExpense: StagedExpenseEntry = {
      id: editingExpenseId || createLocalId(),
      category: values.category,
      amount,
      notes: values.notes?.trim() || ""
    };

    setStagedExpenses((prev) =>
      editingExpenseId ? prev.map((entry) => (entry.id === editingExpenseId ? nextExpense : entry)) : [...prev, nextExpense]
    );
    expenseForm.reset({ category: "Fuel", amount: 0, notes: "" });
    setEditingExpenseId(null);
  };

  const handleEditExpense = (entry: StagedExpenseEntry) => {
    setEditingExpenseId(entry.id);
    expenseForm.reset({
      category: entry.category,
      amount: entry.amount,
      notes: entry.notes
    });
  };

  const handleRemoveExpense = (entryId: string) => {
    setStagedExpenses((prev) => prev.filter((entry) => entry.id !== entryId));
    if (editingExpenseId === entryId) {
      expenseForm.reset({ category: "Fuel", amount: 0, notes: "" });
      setEditingExpenseId(null);
    }
  };

  const handleSubmitBatch = async () => {
    if (isSubmitting) return;
    if (!selectedRecipientId) {
      toast({ title: "User required", description: "Select a sales rep or driver for this session.", variant: "error" });
      return;
    }
    if (stagedCollections.length === 0) {
      toast({ title: "No collections staged", description: "Add at least one collection record before submitting.", variant: "error" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await recordCollectionBatch({
        collections: stagedCollections.map((entry) => ({
          invoice_id: entry.invoice_id,
          amount: entry.amount,
          payment_type: entry.payment_type,
          cheque_deposit_date: entry.payment_type === "cheque" ? entry.cheque_deposit_date : undefined,
          notes: entry.notes,
          incentive_recipient_id: isManagerOrAdmin ? selectedRecipientId : user?.id
        })),
        expenses: stagedExpenses.map((entry) => ({
          category: entry.category,
          amount: entry.amount,
          notes: entry.notes,
          sales_rep_id: isManagerOrAdmin ? selectedRecipientId : user?.id
        }))
      });

      if (!result.success) {
        toast({ title: "Collection batch failed", description: result.error, variant: "error" });
        return;
      }

      toast({ title: "Collection session recorded", description: result.message, variant: "success" });
      setStagedCollections([]);
      setStagedExpenses([]);
      resetCollectionForm();
      expenseForm.reset({ category: "Fuel", amount: 0, notes: "" });
      setEditingExpenseId(null);
      void queryClient.invalidateQueries({ queryKey: COLLECTION_INVOICES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: COLLECTION_EXPENSES_QUERY_KEY });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoading && !permissions?.canRecordCollections) {
    return (
      <section className="space-y-4">
        <PageHeader title="New Collection" description="You do not have permission to record collections." />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader title="New Collection" description="Record a collection session with multiple entries." />

      <Card>
        <CardHeader>
          <CardTitle>Collection User</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <label className="text-sm font-medium">Sales Rep / Driver</label>
          <SearchableSelect
            value={selectedRecipientId}
            options={recipientOptions}
            placeholder={recipientsQuery.isLoading ? "Loading users..." : "Select user"}
            disabled={!isManagerOrAdmin}
            onChange={setSelectedRecipientId}
          />
          {!isManagerOrAdmin ? (
            <p className="text-xs text-muted-foreground">Collections will be recorded under your user account.</p>
          ) : !selectedRecipient && !recipientsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">Search includes both sales reps and drivers.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>{editingCollectionId ? "Edit Collection Entry" : "Add Collection Entry"}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!selectedInvoiceId}
            onClick={() => setIsInvoiceExpanded((prev) => !prev)}
          >
            {isInvoiceExpanded ? "Hide Invoice" : "View Invoice"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Invoice</label>
            <SearchableSelect
              value={selectedInvoiceId}
              options={invoiceOptions}
              placeholder={isInvoicesLoading ? "Loading invoices..." : "Select invoice"}
              onChange={(value) => setValue("invoice_id", value)}
            />
          </div>
          {selectedInvoice ? (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Assigned Sales Rep: {selectedInvoice.sales_rep_name || "Unassigned"} · Due {formatDate(selectedInvoice.due_date)}
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Type</label>
              <Select
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "cheque", label: "Cheque" }
                ]}
                value={paymentType}
                onChange={(event) => {
                  const nextType = event.target.value as "cash" | "cheque";
                  setValue("payment_type", nextType);
                  if (nextType === "cash") {
                    setValue("cheque_deposit_date", "");
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Amount</label>
              <Input type="number" step="0.01" {...register("amount", { valueAsNumber: true })} />
            </div>
          </div>
          {selectedInvoice ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                Remaining this session {formatCurrency(selectedInvoiceRemainingForSession)} · Invoice remaining{" "}
                {formatCurrency(selectedInvoice.remaining_amount)}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setValue("amount", Number(selectedInvoiceRemainingForSession) / 2)}
              >
                Set 50%
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setValue("amount", Number(selectedInvoiceRemainingForSession))}
              >
                Set remaining
              </Button>
            </div>
          ) : null}
          {paymentType === "cheque" ? (
            <div className="space-y-1">
              <label className="text-sm font-medium">Deposit Date</label>
              <Input type="date" {...register("cheque_deposit_date")} />
            </div>
          ) : null}
          <div className="space-y-1">
            <label className="text-sm font-medium">Notes</label>
            <Input placeholder="Payment reference" {...register("notes")} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!selectedInvoiceId} onClick={handleStageCollection}>
              <CirclePlus className="mr-2 h-4 w-4" />
              {editingCollectionId ? "Update Entry" : "Add Entry"}
            </Button>
            {editingCollectionId ? (
              <Button type="button" variant="outline" onClick={resetCollectionForm}>
                Cancel Edit
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {selectedInvoice && isInvoiceExpanded ? (
        <Card>
          <CardHeader>
            <CardTitle>Invoice #{selectedInvoice.invoice_number}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {invoiceDetailQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading invoice products...</p>
            ) : invoiceDetailQuery.isError ? (
              <p className="text-sm text-destructive">Unable to load invoice preview.</p>
            ) : !invoiceDetailQuery.data ? (
              <p className="text-sm text-muted-foreground">Invoice not found.</p>
            ) : (
              <>
                <div className="rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2">Qty</th>
                        <th className="px-3 py-2">Unit Price</th>
                        <th className="px-3 py-2">Discount</th>
                        <th className="px-3 py-2 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceDetailQuery.data.items.map((item) => (
                        <tr key={item.id} className="border-t border-border">
                          <td className="px-3 py-2">
                            {item.product_name}
                            {item.product_unit ? <span className="ml-1 text-xs text-muted-foreground">({item.product_unit})</span> : null}
                          </td>
                          <td className="px-3 py-2">{item.qty}</td>
                          <td className="px-3 py-2">{formatCurrency(Number(item.unit_price))}</td>
                          <td className="px-3 py-2">
                            {item.discount_value > 0
                              ? item.discount_type === "percent"
                                ? `${item.discount_value}%`
                                : formatCurrency(Number(item.discount_value))
                              : "-"}
                          </td>
                          <td className="px-3 py-2 text-right">{formatCurrency(getLineTotal(item))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-right text-sm font-semibold">
                  Invoice Total: {formatCurrency(Number(invoiceDetailQuery.data.total_amount))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Staged Collections</CardTitle>
        </CardHeader>
        <CardContent>
          {stagedCollections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No collection entries added yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Invoice</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Deposit Date</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stagedCollections.map((entry) => (
                    <tr key={entry.id} className="border-t border-border">
                      <td className="px-3 py-2">#{entry.invoice_number}</td>
                      <td className="px-3 py-2">{entry.customer_name}</td>
                      <td className="px-3 py-2 capitalize">{entry.payment_type}</td>
                      <td className="px-3 py-2">{entry.payment_type === "cheque" ? formatDate(entry.cheque_deposit_date) : "-"}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(entry.amount)}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => handleEditCollection(entry)}>
                            Edit
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => handleRemoveCollection(entry.id)}>
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Category</label>
              <Select
                value={expenseForm.watch("category")}
                options={[
                  { value: "Fuel", label: "Fuel" },
                  { value: "Food", label: "Food" },
                  { value: "Parking", label: "Parking" },
                  { value: "Other", label: "Other" }
                ]}
                onChange={(event) => expenseForm.setValue("category", event.target.value as ExpenseCategory)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Amount</label>
              <Input type="number" step="0.01" {...expenseForm.register("amount", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Notes</label>
              <Input placeholder="Optional note" {...expenseForm.register("notes")} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleStageExpense}>
              <CirclePlus className="mr-2 h-4 w-4" />
              {editingExpenseId ? "Update Expense" : "Add Expense"}
            </Button>
            {editingExpenseId ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  expenseForm.reset({ category: "Fuel", amount: 0, notes: "" });
                  setEditingExpenseId(null);
                }}
              >
                Cancel Edit
              </Button>
            ) : null}
          </div>

          {stagedExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses added yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Notes</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stagedExpenses.map((entry) => (
                    <tr key={entry.id} className="border-t border-border">
                      <td className="px-3 py-2">{entry.category}</td>
                      <td className="px-3 py-2">{entry.notes || "-"}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(entry.amount)}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => handleEditExpense(entry)}>
                            Edit
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => handleRemoveExpense(entry.id)}>
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 text-muted-foreground">Total Cash Collected</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(summary.totalCashCollected)}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 text-muted-foreground">Total Cheques Collected</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(summary.totalChequesCollected)}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 text-muted-foreground">Total Expenses</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(summary.totalExpenses)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-muted-foreground">Cash in Hand</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(summary.cashInHand)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Button type="button" disabled={isSubmitting || stagedCollections.length === 0} onClick={handleSubmitBatch}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? "Recording..." : "Record Collection Session"}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
