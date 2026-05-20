"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { getCancelledInvoiceReport, type CancelledInvoiceReportRow } from "@/app/actions/invoices";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export default function CancelledInvoiceReportPage() {
  const params = useParams();
  const invoiceId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { data, isLoading, isError, error } = useQuery<CancelledInvoiceReportRow | null>({
    queryKey: ["cancelled-invoice-report", invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;
      const result = await getCancelledInvoiceReport(invoiceId);
      if (!result.success) throw new Error(result.error || "Failed to load cancelled invoice report");
      return result.data ?? null;
    },
    enabled: Boolean(invoiceId)
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading cancellation report...</p>;
  }

  if (isError || !data) {
    return (
      <section className="space-y-4">
        <PageHeader title="Cancelled Invoice Report" description="Could not load this cancellation report." />
        <p className="text-xs text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
        <Button asChild variant="outline">
          <Link href="/invoices">Back</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={`Cancelled Invoice INV-${data.invoice_number}`}
        description={`Cancelled on ${formatDate(data.cancelled_at)} by ${data.cancelled_by_name}`}
        actions={
          <Button asChild variant="outline">
            <Link href="/invoices">Back to Invoices</Link>
          </Button>
        }
      />

      <Card className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Free Qty</TableHead>
              <TableHead className="text-right">Restored Qty</TableHead>
              <TableHead className="text-right">Stock Before</TableHead>
              <TableHead className="text-right">Stock After</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item) => (
              <TableRow key={item.audit_id}>
                <TableCell>{item.product_name}</TableCell>
                <TableCell className="text-right">{item.qty}</TableCell>
                <TableCell className="text-right">{item.free_qty}</TableCell>
                <TableCell className="text-right">{item.restored_qty}</TableCell>
                <TableCell className="text-right">{item.stock_before}</TableCell>
                <TableCell className="text-right">{item.stock_after}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </section>
  );
}
