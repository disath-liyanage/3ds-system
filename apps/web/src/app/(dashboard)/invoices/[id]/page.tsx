"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef } from "react";

import { deleteInvoice } from "@/app/actions/invoices";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useInvoice } from "@/hooks/useInvoice";
import { toast } from "@/lib/toast";

export default function InvoiceDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { permissions, user, isLoading: isPermissionsLoading } = useCurrentUserPermissions();
  const { data: invoice, isLoading: isInvoiceLoading, isError } = useInvoice(invoiceId);

  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  const handleDelete = async () => {
    if (!invoiceId) return;
    const confirmed = window.confirm("Delete this invoice? This will restore product stock and customer balance. This cannot be undone.");
    if (!confirmed) return;

    const result = await deleteInvoice(invoiceId);
    if (!result.success) {
      toast({
        title: "Failed to delete invoice",
        description: result.error || "Please try again.",
        variant: "error"
      });
      return;
    }

    toast({ title: "Invoice deleted", variant: "success" });
    router.push("/invoices");
  };

  const handlePrint = () => {
    window.print();
  };

  if (isPermissionsLoading || isInvoiceLoading) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Invoice Details</h1>
        <p className="text-sm text-muted-foreground">Loading invoice...</p>
      </section>
    );
  }

  if (isError || !invoice) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Invoice Details</h1>
        <p className="text-sm text-muted-foreground">Unable to find this invoice.</p>
        <Button asChild variant="outline">
          <Link href="/invoices">Back to Invoices</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Invoice #{invoice.invoice_number}</h1>
          <p className="text-sm text-muted-foreground">View and print invoice details.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="default" onClick={handlePrint}>
            Print Invoice
          </Button>
          {isAdminOrManager && (
            <Button variant="danger" onClick={handleDelete}>
              Delete Invoice
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/invoices">Back</Link>
          </Button>
        </div>
      </div>

      {/* Printable Area */}
      <div className="print-area bg-white p-8 rounded-lg shadow-sm border print:shadow-none print:border-none print:p-0">
        <div className="flex justify-between items-start border-b pb-6 mb-6">
          <div>
            <h2 className="text-3xl font-bold text-primary mb-2">INVOICE</h2>
            <div className="text-sm text-muted-foreground">
              <p>Invoice #: {invoice.invoice_number}</p>
              <p>Date: {new Date(invoice.created_at).toLocaleDateString()}</p>
              <p className="capitalize">Payment Method: {invoice.payment_method}</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <h3 className="font-semibold text-lg">3DS Paint Distribution</h3>
            <p className="text-muted-foreground">123 Main Street</p>
            <p className="text-muted-foreground">City, Country</p>
            <p className="text-muted-foreground">Phone: +94 77 123 4567</p>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="font-semibold text-gray-700 mb-2">Bill To:</h3>
          <div className="text-sm">
            <p className="font-medium text-lg">{invoice.customer_name}</p>
            <p className="text-muted-foreground">{invoice.customer_address}</p>
            <p className="text-muted-foreground">{invoice.customer_phone}</p>
          </div>
        </div>

        <Table className="mb-8">
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  {item.product_name} <span className="text-muted-foreground text-xs">({item.product_unit})</span>
                </TableCell>
                <TableCell className="text-right">{item.qty}</TableCell>
                <TableCell className="text-right">
                  LKR {item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-right font-medium">
                  LKR {(item.qty * item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex justify-end border-t pt-4">
          <div className="w-64 space-y-3">
            <div className="flex justify-between font-bold text-lg">
              <span>Grand Total:</span>
              <span>LKR {invoice.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center text-sm pt-2 border-t">
              <span>Status:</span>
              <Badge variant={invoice.status === "paid" ? "success" : "default"}>
                {invoice.status.toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center text-xs text-muted-foreground print:block">
          <p>Thank you for your business!</p>
          <p>Issued by: {invoice.issued_by_name}</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}