"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { useParams } from "next/navigation";

import type { Invoice } from "@paintdist/shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceTemplate, type InvoicePdfItem } from "@/lib/pdf/invoice-template";

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();

  const invoice: Invoice = {
    id: params.id,
    invoice_number: 5001,
    order_id: "order-1",
    customer_id: "customer-1",
    issued_by: "user-1",
    total_amount: 25000,
    status: "issued",
    created_at: new Date().toISOString()
  };

  const items: InvoicePdfItem[] = [
    { description: "Exterior Acrylic Paint", qty: 20, unitPrice: 850 },
    { description: "Primer Coat", qty: 10, unitPrice: 800 }
  ];

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Invoice Detail</h1>
        <p className="text-sm text-muted-foreground">Invoice ID: {params.id}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Invoice #{invoice.invoice_number}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Total Amount: LKR {invoice.total_amount.toLocaleString()}</p>
          <PDFDownloadLink
            document={<InvoiceTemplate invoice={invoice} items={items} companyName="PaintDist Pvt Ltd" />}
            fileName={`invoice-${invoice.invoice_number}.pdf`}
          >
            {({ loading }) => <Button>{loading ? "Preparing PDF..." : "Download PDF"}</Button>}
          </PDFDownloadLink>
        </CardContent>
      </Card>
    </section>
  );
}