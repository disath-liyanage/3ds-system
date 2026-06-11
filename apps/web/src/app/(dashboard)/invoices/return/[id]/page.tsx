"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { getReturnInvoiceDetail, type ReturnInvoiceDetailRow } from "@/app/actions/invoices";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { Printer } from "lucide-react";

export default function ReturnInvoiceReceiptPage() {
  const params = useParams();
  const returnInvoiceId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { data, isLoading, isError, error } = useQuery<ReturnInvoiceDetailRow | null>({
    queryKey: ["return-invoice", returnInvoiceId],
    queryFn: async () => {
      if (!returnInvoiceId) return null;
      const result = await getReturnInvoiceDetail(returnInvoiceId);
      if (!result.success) throw new Error(result.error || "Failed to load return invoice");
      return result.data ?? null;
    },
    enabled: Boolean(returnInvoiceId)
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading return receipt...</p>;
  }

  if (isError || !data) {
    return (
      <section className="space-y-4">
        <PageHeader title="Return Receipt" description="Could not load return receipt." />
        <p className="text-xs text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        className="print:hidden"
        title={`Return Invoice #${data.return_number}`}
        description="Receipt for returned items."
        actions={
          <>
            <Button variant="default" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print Receipt
            </Button>
          </>
        }
      />

      <Card className="bg-white p-8 print:shadow-none print:border-none print:p-0">
        <div className="mb-6 border-b pb-6">
          <h2 className="text-3xl font-bold text-primary">RETURN RECEIPT</h2>
          <p className="text-sm text-muted-foreground">Return #: {data.return_number}</p>
          <p className="text-sm text-muted-foreground">Date: {formatDate(data.created_at)}</p>
          <p className="text-sm text-muted-foreground">Source Invoice #: {data.source_invoice_number}</p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold">Customer</p>
            <p className="text-sm">{data.customer_name}</p>
            <p className="text-sm text-muted-foreground">{data.customer_address}</p>
            <p className="text-sm text-muted-foreground">{data.customer_phone}</p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-sm font-semibold">Returned By</p>
            <p className="text-sm">{data.returned_by_name}</p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Line Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  {item.product_name} <span className="text-xs text-muted-foreground">({item.product_unit})</span>
                </TableCell>
                <TableCell className="text-right">{item.qty}</TableCell>
                <TableCell className="text-right">LKR {item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right">LKR {item.line_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-6 flex justify-end border-t pt-4">
          <div className="w-64">
            <div className="flex justify-between font-bold text-lg">
              <span>Total Return:</span>
              <span>LKR {data.total_return_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {data.notes ? (
          <div className="mt-6">
            <p className="text-sm font-semibold">Notes</p>
            <p className="text-sm text-muted-foreground">{data.notes}</p>
          </div>
        ) : null}
      </Card>
    </section>
  );
}
