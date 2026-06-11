"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createReturnInvoice, listReturnableInvoices, type ReturnableInvoiceRow } from "@/app/actions/invoices";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { toast } from "@/lib/toast";
import { useQuery } from "@tanstack/react-query";
import { Save } from "lucide-react";

export default function ReturnInvoicePage() {
  const router = useRouter();
  const { user, isLoading: isPermissionsLoading } = useCurrentUserPermissions();

  const { data, isLoading, isError, error } = useQuery<ReturnableInvoiceRow[]>({
    queryKey: ["returnable-invoices"],
    queryFn: async () => {
      const result = await listReturnableInvoices();
      if (!result.success) throw new Error(result.error || "Failed to load invoices");
      return result.data ?? [];
    }
  });

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [qtyByItem, setQtyByItem] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const selectedInvoice = useMemo(
    () => (data ?? []).find((invoice) => invoice.id === selectedInvoiceId) ?? null,
    [data, selectedInvoiceId]
  );

  const invoiceOptions = useMemo<SearchableSelectOption[]>(
    () =>
      (data ?? []).map((invoice) => ({
        value: invoice.id,
        label: `${invoice.customer_name}`,
        meta: `INV-${invoice.invoice_number}`,
        subLabel: `Payment: ${invoice.payment_method.toUpperCase()}`
      })),
    [data]
  );

  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  const setAll = () => {
    if (!selectedInvoice) return;
    const next: Record<string, string> = {};
    for (const item of selectedInvoice.items) {
      if (item.returnable_qty > 0) {
        next[item.invoice_item_id] = String(item.returnable_qty);
      }
    }
    setQtyByItem(next);
  };

  const clearAll = () => {
    setQtyByItem({});
  };

  const handleSave = async () => {
    if (!selectedInvoice) {
      toast({ title: "Select an invoice", variant: "error" });
      return;
    }

    const items = selectedInvoice.items
      .map((item) => ({
        invoice_item_id: item.invoice_item_id,
        qty: Number(qtyByItem[item.invoice_item_id] || 0)
      }))
      .filter((item) => item.qty > 0);

    if (items.length === 0) {
      toast({ title: "Add at least one return quantity", variant: "error" });
      return;
    }

    for (const item of items) {
      const source = selectedInvoice.items.find((row) => row.invoice_item_id === item.invoice_item_id);
      if (!source) continue;
      if (item.qty > source.returnable_qty) {
        toast({ title: "Invalid quantity", description: "Return quantity exceeds available qty", variant: "error" });
        return;
      }
    }

    setIsSaving(true);
    const result = await createReturnInvoice({
      invoice_id: selectedInvoice.id,
      notes: notes.trim() || undefined,
      items
    });
    setIsSaving(false);

    if (!result.success || !result.return_invoice_id) {
      toast({ title: "Failed to save return invoice", description: result.error, variant: "error" });
      return;
    }

    toast({ title: "Return invoice saved", variant: "success" });
    router.push(`/invoices/return/${result.return_invoice_id}`);
  };

  if (isPermissionsLoading || isLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (!isAdminOrManager) {
    return (
      <section className="space-y-4">
        <PageHeader
          title="Return Invoices"
          description="Only managers and admins can add return invoices."
        />
      </section>
    );
  }

  if (isError) {
    return (
      <section className="space-y-4">
        <PageHeader title="Return Invoices" description="Failed to load returnable invoices." />
        <p className="text-xs text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Return Invoices"
        description="Select sold items and subtract quantities to create a return."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/invoices/return/list">View Returned Invoices</Link>
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Create Return Invoice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Source Invoice</label>
              <SearchableSelect
                value={selectedInvoiceId}
                onChange={(value) => {
                  setSelectedInvoiceId(value);
                  setQtyByItem({});
                }}
                options={invoiceOptions}
                placeholder="Select an invoice"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for return" />
            </div>
          </div>

          {selectedInvoice ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Invoice #{selectedInvoice.invoice_number} · {selectedInvoice.customer_name}
                </p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={setAll}>
                    Select All Returnable
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
                    Clear
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Sold Qty</TableHead>
                    <TableHead className="text-right">Returned</TableHead>
                    <TableHead className="text-right">Can Return</TableHead>
                    <TableHead className="text-right">Return Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedInvoice.items.map((item) => (
                    <TableRow key={item.invoice_item_id}>
                      <TableCell>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">{item.product_unit}</p>
                      </TableCell>
                      <TableCell className="text-right">{item.qty}</TableCell>
                      <TableCell className="text-right">{item.already_returned_qty}</TableCell>
                      <TableCell className="text-right">{item.returnable_qty}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          max={item.returnable_qty}
                          value={qtyByItem[item.invoice_item_id] ?? ""}
                          onChange={(e) =>
                            setQtyByItem((prev) => ({
                              ...prev,
                              [item.invoice_item_id]: e.target.value
                            }))
                          }
                          className="ml-auto w-24"
                          disabled={item.returnable_qty <= 0}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={!selectedInvoice || isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save Return Invoice"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
