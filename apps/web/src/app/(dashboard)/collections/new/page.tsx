"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import { recordCollection } from "@/app/actions/collections";
import { getSalesReps } from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useCollectionInvoices } from "@/hooks/useCollectionInvoices";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { toast } from "@/lib/toast";

type NewCollectionForm = {
  invoice_id: string;
  amount: number;
  notes: string;
  incentive_recipient_id: string;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 2 }).format(value);

export default function NewCollectionPage() {
  const { permissions, isLoading, user } = useCurrentUserPermissions();
  const { data: invoices, isLoading: isInvoicesLoading } = useCollectionInvoices();
  const searchParams = useSearchParams();
  const initialInvoiceId = searchParams.get("invoiceId") || "";

  const { register, handleSubmit, setValue, watch } = useForm<NewCollectionForm>({
    defaultValues: {
      invoice_id: initialInvoiceId,
      amount: 0,
      notes: "",
      incentive_recipient_id: ""
    }
  });

  const isManagerOrAdmin = user?.role === "admin" || user?.role === "manager";

  const salesRepsQuery = useQuery({
    queryKey: ["sales-reps"],
    queryFn: async () => await getSalesReps(),
    enabled: Boolean(isManagerOrAdmin)
  });

  const invoiceOptions = useMemo(
    () =>
      (invoices || [])
        .filter((row) => !row.is_settled)
        .map((row) => ({
          value: row.id,
          label: `#${row.invoice_number} · ${row.customer_name}`,
          subLabel: `Amount ${formatCurrency(row.total_amount)} · Due ${new Date(row.due_date).toLocaleDateString()}`,
          meta: row.sales_rep_name || "Unassigned"
        })),
    [invoices]
  );

  const selectedInvoiceId = watch("invoice_id");
  const selectedInvoice = useMemo(
    () => (invoices || []).find((row) => row.id === selectedInvoiceId) || null,
    [invoices, selectedInvoiceId]
  );

  useEffect(() => {
    if (!selectedInvoice) return;
    setValue("amount", Number(selectedInvoice.total_amount));
    if (isManagerOrAdmin) {
      setValue("incentive_recipient_id", selectedInvoice.sales_rep_id || "");
    }
  }, [selectedInvoice, isManagerOrAdmin, setValue]);

  const salesRepOptions = useMemo(
    () =>
      (salesRepsQuery.data || []).map((rep) => ({
        value: rep.id,
        label: rep.full_name
      })),
    [salesRepsQuery.data]
  );

  const onSubmit = async (values: NewCollectionForm) => {
    const result = await recordCollection({
      invoice_id: values.invoice_id,
      amount: values.amount,
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
    setValue("notes", "");
    setValue("incentive_recipient_id", "");
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
        <CardHeader>
          <CardTitle>Collection Details</CardTitle>
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
                Assigned rep: {selectedInvoice.sales_rep_name || "Unassigned"} · Due {new Date(selectedInvoice.due_date).toLocaleDateString()}
              </div>
            ) : null}
            <div className="space-y-1">
              <label className="text-sm font-medium">Amount</label>
              <Input type="number" step="0.01" {...register("amount", { valueAsNumber: true })} />
            </div>
            {isManagerOrAdmin ? (
              <div className="space-y-1">
                <label className="text-sm font-medium">Incentive recipient</label>
                <SearchableSelect
                  value={watch("incentive_recipient_id")}
                  options={salesRepOptions}
                  placeholder="Select sales rep"
                  onChange={(value) => setValue("incentive_recipient_id", value)}
                />
              </div>
            ) : null}
            <div className="space-y-1">
              <label className="text-sm font-medium">Notes</label>
              <Input placeholder="Payment reference" {...register("notes")} />
            </div>
            <Button type="submit" disabled={!selectedInvoiceId}>Save Collection</Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}