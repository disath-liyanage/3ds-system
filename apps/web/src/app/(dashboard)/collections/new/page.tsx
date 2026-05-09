"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import { recordCollection } from "@/app/actions/collections";
import { getCollectionRecipients } from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select } from "@/components/ui/select";
import { useCollectionInvoices } from "@/hooks/useCollectionInvoices";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";

type NewCollectionForm = {
  invoice_id: string;
  amount: number;
  notes: string;
  incentive_recipient_id: string;
};

type RecipientRole = "sales_rep" | "driver";

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
  const [recipientRole, setRecipientRole] = useState<RecipientRole>("sales_rep");

  const recipientsQuery = useQuery({
    queryKey: ["collection-recipients"],
    queryFn: async () => await getCollectionRecipients(),
    enabled: true
  });

  const availableInvoices = useMemo(() => {
    let rows = (invoices || []).filter((row) => !row.is_settled);

    if (user?.role === "sales_rep") {
      rows = rows.filter((row) => !row.sales_rep_id || row.sales_rep_id !== user.id);
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
  const selectedInvoice = useMemo(
    () => availableInvoices.find((row) => row.id === selectedInvoiceId) || null,
    [availableInvoices, selectedInvoiceId]
  );

  useEffect(() => {
    if (!selectedInvoice) return;
    setValue("amount", Number(selectedInvoice.total_amount));
    if (isManagerOrAdmin) {
      if (recipientRole === "sales_rep") {
        setValue("incentive_recipient_id", selectedInvoice.sales_rep_id || "");
      }
    }
  }, [selectedInvoice, isManagerOrAdmin, recipientRole, setValue]);

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
                Assigned rep: {selectedInvoice.sales_rep_name || "Unassigned"} · Due {formatDate(selectedInvoice.due_date)}
              </div>
            ) : null}
            <div className="space-y-1">
              <label className="text-sm font-medium">Amount</label>
              <Input type="number" step="0.01" {...register("amount", { valueAsNumber: true })} />
            </div>
            {isManagerOrAdmin ? (
              <div className="flex items-center gap-3">
                <div className="w-48">
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
                <div className="flex-1">
                  <SearchableSelect
                    value={watch("incentive_recipient_id")}
                    options={recipientOptions}
                    placeholder={
                      recipientsQuery.isLoading
                        ? "Loading..."
                        : recipientRole === "driver"
                          ? "Select driver"
                          : "Select sales rep"
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