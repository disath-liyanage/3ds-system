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

  const formatAmount = (amount: number) => amount.toLocaleString(undefined, { minimumFractionDigits: 2 });
  const returnNumber = `RTN${String(data.return_number).padStart(4, "0")}`;
  const sourceInvoiceNumber = String(data.source_invoice_number);

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

      <Card className="bg-white p-8 print:hidden">
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
                <TableCell className="text-right">LKR {formatAmount(item.unit_price)}</TableCell>
                <TableCell className="text-right">LKR {formatAmount(item.line_total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-6 flex justify-end border-t pt-4">
          <div className="w-64">
            <div className="flex justify-between font-bold text-lg">
              <span>Total Return:</span>
              <span>LKR {formatAmount(data.total_return_amount)}</span>
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

      <div className="thermal-receipt hidden print:block">
        <div className="thermal-center thermal-header">
          <div className="thermal-bold">SANULA PAINTS HUB (PVT) LTD</div>
          <div>No 44/1, Tharanga Place, Panagoda, Homagama</div>
          <div>077 530 3215 / 011 208 3773</div>
        </div>

        <div className="thermal-divider" />

        <div className="thermal-center thermal-bold thermal-title">RETURN NOTE</div>

        <div className="thermal-fields">
          <div className="thermal-row">
            <span>Return Customer :</span>
            <span>{data.customer_name}</span>
          </div>
          <div className="thermal-row">
            <span>Return Date :</span>
            <span>{formatDate(data.created_at)}</span>
          </div>
          <div className="thermal-row">
            <span>Return No :</span>
            <span>{returnNumber}</span>
          </div>
          <div className="thermal-row">
            <span>Return Invoice :</span>
            <span>{sourceInvoiceNumber}</span>
          </div>
        </div>

        <div className="thermal-divider" />

        <div className="thermal-items">
          {data.items.map((item) => (
            <div key={item.id} className="thermal-item">
              <div className="thermal-item-name">{item.product_name}</div>
              <div className="thermal-line-row">
                <span>
                  {item.qty} x {formatAmount(item.unit_price)}
                </span>
                <span className="thermal-dots" aria-hidden="true" />
                <span>{formatAmount(item.line_total)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="thermal-divider" />

        <div className="thermal-total">TOTAL RETURN: LKR {formatAmount(data.total_return_amount)}</div>

        {data.notes ? <div className="thermal-notes">Notes: {data.notes}</div> : null}

        <div className="thermal-divider" />

        <div className="thermal-center thermal-footer">
          <div>Software By Disath</div>
          <div>www.disathliyanage.com</div>
          <div>077-9519072</div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          html,
          body {
            width: 80mm;
          }
          body * {
            visibility: hidden;
          }
          .thermal-receipt,
          .thermal-receipt * {
            visibility: visible;
          }
          .thermal-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 72mm;
            padding: 2mm 4mm;
            font-family: "Courier New", Courier, monospace;
            font-size: 11px;
            line-height: 1.35;
            color: #000;
          }
          .thermal-center {
            text-align: center;
          }
          .thermal-bold {
            font-weight: 700;
          }
          .thermal-header {
            font-size: 11px;
          }
          .thermal-title {
            margin: 2mm 0;
          }
          .thermal-divider {
            width: 100%;
            border-top: 1px dashed #000;
            margin: 2mm 0;
          }
          .thermal-fields {
            display: flex;
            flex-direction: column;
            gap: 0.5mm;
          }
          .thermal-row,
          .thermal-line-row {
            display: flex;
            justify-content: space-between;
            gap: 2mm;
          }
          .thermal-row span:first-child {
            flex: 0 0 auto;
          }
          .thermal-row span:last-child {
            text-align: right;
            word-break: break-word;
          }
          .thermal-items {
            display: flex;
            flex-direction: column;
            gap: 1.5mm;
          }
          .thermal-item-name {
            overflow-wrap: anywhere;
          }
          .thermal-line-row {
            padding-left: 4mm;
            white-space: nowrap;
          }
          .thermal-dots {
            flex: 1 1 auto;
            min-width: 4mm;
            border-bottom: 1px dotted #000;
            transform: translateY(-2px);
          }
          .thermal-total {
            font-weight: 700;
            text-align: right;
          }
          .thermal-notes {
            margin-top: 2mm;
            overflow-wrap: anywhere;
          }
          .thermal-footer {
            font-size: 10px;
          }
        }
      `}</style>
    </section>
  );
}
