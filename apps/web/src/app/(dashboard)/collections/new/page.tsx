"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import { addCollectionExpense, recordCollection } from "@/app/actions/collections";
import { getInvoiceDetail } from "@/app/actions/invoices";
import { getCollectionRecipients } from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select } from "@/components/ui/select";
import { useCollectionInvoices } from "@/hooks/useCollectionInvoices";
import { COLLECTION_EXPENSES_QUERY_KEY } from "@/hooks/useCollectionExpenses";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";

type NewCollectionForm = {
  invoice_id: string;
  amount: number;
  payment_type: "cash" | "cheque";
  cheque_deposit_date: string;
  notes: string;
  incentive_recipient_id: string;
};

type RecipientRole = "sales_rep" | "driver";
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

export default function NewCollectionPage() {
  const { permissions, isLoading, user } = useCurrentUserPermissions();
  const { data: invoices, isLoading: isInvoicesLoading } = useCollectionInvoices();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialInvoiceId = searchParams.get("invoiceId") || "";

  const { register, handleSubmit, setValue, watch } = useForm<NewCollectionForm>({
    defaultValues: {
      invoice_id: initialInvoiceId,
      amount: 0,
      payment_type: "cash",
      cheque_deposit_date: "",
      notes: "",
      incentive_recipient_id: ""
    }
  });

  const isManagerOrAdmin = user?.role === "admin" || user?.role === "manager";
  const [recipientRole, setRecipientRole] = useState<RecipientRole>("sales_rep");
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>("Fuel");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [isInvoiceExpanded, setIsInvoiceExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recipientsQuery = useQuery({
    queryKey: ["collection-recipients"],
    queryFn: async () => await getCollectionRecipients(),
    enabled: true
  });

  const availableInvoices = useMemo(() => {
    let rows = (invoices || []).filter((row) => !row.is_settled);

    if (user?.role === "sales_rep") {
      rows = rows.filter((row) => !row.sales_rep_id || row.sales_rep_id === user.id);
    }

    return rows;
  }, [invoices, user?.id, user?.role]);

  const invoiceOptions = useMemo(
    () =>
      availableInvoices.map((row) => ({
        value: row.id,
        label: `#${row.invoice_number} · ${row.customer_name}`,
        subLabel: `Amount ${formatCurrency(row.total_amount)} · Due ${formatDate(row.due_date)}`,
        meta: row.sales_rep_name || "Unassigned"
      })),
    [availableInvoices]
  );

  const selectedInvoiceId = watch("invoice_id");
  const paymentType = watch("payment_type");
  const selectedInvoice = useMemo(
    () => availableInvoices.find((row) => row.id === selectedInvoiceId) || null,
    [availableInvoices, selectedInvoiceId]
  );

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
    if (!selectedInvoice) return;
    setValue("amount", Number(selectedInvoice.remaining_amount));
    if (isManagerOrAdmin) {
      if (recipientRole === "sales_rep") {
        setValue("incentive_recipient_id", selectedInvoice.sales_rep_id || "");
      }
    }
  }, [selectedInvoice, isManagerOrAdmin, recipientRole, setValue]);

  useEffect(() => {
    setIsInvoiceExpanded(false);
  }, [selectedInvoiceId]);

  const recipientOptions = useMemo(() => {
    if (!recipientsQuery.data || recipientsQuery.data.length === 0) {
      console.log("[DEBUG] recipientsQuery.data is empty or not loaded", {
        data: recipientsQuery.data,
        isLoading: recipientsQuery.isLoading,
        error: recipientsQuery.error
      });
      return [];
    }
    console.log("[DEBUG] All recipients fetched:", recipientsQuery.data);
    const rows = (recipientsQuery.data || []).filter((recipient) => recipient.role === recipientRole);
    console.log("[DEBUG] Filtered recipients for role", recipientRole, ":", rows);
    return rows.map((recipient) => ({
      value: recipient.id,
      label: recipient.full_name,
      meta: recipient.role
    }));
  }, [recipientsQuery.data, recipientRole, isManagerOrAdmin]);

  const addExpenseMutation = useMutation({
    mutationFn: async () => {
      const notes = expenseNotes.trim();
      const result = await addCollectionExpense({
        category: expenseCategory,
        amount: Number(expenseAmount),
        notes
      });
      if (!result.success) throw new Error(result.error || "Failed to add expense");
      return result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COLLECTION_EXPENSES_QUERY_KEY });
      setExpenseCategory("Fuel");
      setExpenseNotes("");
      setExpenseAmount("");
      toast({ title: "Expense added", variant: "success" });
    },
    onError: (error) => {
      toast({ title: "Failed to add expense", description: String(error), variant: "error" });
    }
  });

  const onSubmit = async (values: NewCollectionForm) => {
    if (isSubmitting) return;

    if (values.payment_type === "cheque" && !values.cheque_deposit_date) {
      toast({ title: "Deposit date required", description: "Select the cheque deposit date.", variant: "error" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await recordCollection({
        invoice_id: values.invoice_id,
        amount: values.amount,
        payment_type: values.payment_type,
        cheque_deposit_date: values.payment_type === "cheque" ? values.cheque_deposit_date : undefined,
        notes: values.notes,
        incentive_recipient_id: isManagerOrAdmin ? values.incentive_recipient_id : user?.id
      });

      if (!result.success) {
        toast({ title: "Collection failed", description: result.error, variant: "error" });
        return;
      }

      toast({ title: "Collection recorded", description: result.message, variant: "success" });
      setValue("invoice_id", "");
      setValue("amount", 0);
      setValue("payment_type", "cash");
      setValue("cheque_deposit_date", "");
      setValue("notes", "");
      setValue("incentive_recipient_id", "");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoading && !permissions?.canRecordCollections) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">New Collection</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to record collections.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">New Collection</h1>
        <p className="text-sm text-muted-foreground">Record a collection against a customer invoice.</p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>Collection Details</CardTitle>
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
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
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
            <div className="space-y-1">
              {selectedInvoice ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    Remaining {formatCurrency(selectedInvoice.remaining_amount)} · Total {formatCurrency(selectedInvoice.total_amount)}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setValue("amount", Number(selectedInvoice.remaining_amount) / 2)}
                  >
                    Set 50%
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setValue("amount", Number(selectedInvoice.remaining_amount))}
                  >
                    Set remaining
                  </Button>
                </div>
              ) : null}

            </div>
            {isManagerOrAdmin ? (
              <div className="grid gap-3 md:grid-cols-3">
                {paymentType === "cheque" ? (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Deposit Date</label>
                    <Input type="date" {...register("cheque_deposit_date")} />
                  </div>
                ) : null}
                <div className="space-y-1">
                  <label className="text-sm font-medium">Recipient Type</label>
                  <Select
                    options={[
                      { value: "sales_rep", label: "Sales rep" },
                      { value: "driver", label: "Driver" }
                    ]}
                    value={recipientRole}
                    onChange={(event) => {
                      const nextRole = event.target.value as RecipientRole;
                      setRecipientRole(nextRole);
                      setValue("incentive_recipient_id", "");
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Sales Rep</label>
                  <SearchableSelect
                    value={watch("incentive_recipient_id")}
                    options={recipientOptions}
                    placeholder={
                      recipientsQuery.isLoading
                        ? "Loading..."
                        : recipientRole === "driver"
                          ? "Select Driver"
                          : "Select Sales Rep"
                    }
                    onChange={(value) => setValue("incentive_recipient_id", value)}
                  />
                  {recipientOptions.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      No {recipientRole === "driver" ? "drivers" : "sales reps"} found.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {!isManagerOrAdmin && paymentType === "cheque" ? (
              <div className="space-y-1">
                <label className="text-sm font-medium">Deposit Date</label>
                <Input type="date" {...register("cheque_deposit_date")} />
              </div>
            ) : null}
            <div className="space-y-1">
              <label className="text-sm font-medium">Notes</label>
              <Input placeholder="Payment reference" {...register("notes")} />
            </div>
            <Button type="submit" disabled={!selectedInvoiceId || isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Collection"}
            </Button>
          </form>
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

      {isManagerOrAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Record Expense</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Category</label>
                <Select
                  value={expenseCategory}
                  options={[
                    { value: "Fuel", label: "Fuel" },
                    { value: "Food", label: "Food" },
                    { value: "Parking", label: "Parking" },
                    { value: "Other", label: "Other" }
                  ]}
                  onChange={(event) => setExpenseCategory(event.target.value as ExpenseCategory)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Amount</label>
                <Input
                  type="number"
                  step="0.01"
                  value={expenseAmount}
                  onChange={(event) => setExpenseAmount(event.target.value)}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium">Notes</label>
                <Input
                  value={expenseNotes}
                  onChange={(event) => setExpenseNotes(event.target.value)}
                  placeholder="Optional note"
                />
              </div>
            </div>
            <Button
              type="button"
              disabled={addExpenseMutation.isPending}
              onClick={() => addExpenseMutation.mutate()}
            >
              Add Expense
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
