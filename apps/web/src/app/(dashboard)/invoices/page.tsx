"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";

const rows = [
  { id: "i1", invoice_number: 5001, customer: "City Paint Mart", total: "LKR 25,000", status: "issued" },
  { id: "i2", invoice_number: 5002, customer: "Northline Traders", total: "LKR 72,500", status: "paid" }
];

export default function InvoicesPage() {
  const { permissions, isLoading } = useCurrentUserPermissions();

  if (!isLoading && !permissions?.canCreateInvoices) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to view invoices.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-sm text-muted-foreground">Track issuance and payment state.</p>
      </header>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.invoice_number}</TableCell>
              <TableCell>{row.customer}</TableCell>
              <TableCell>{row.total}</TableCell>
              <TableCell>
                <Badge variant={row.status === "paid" ? "success" : "default"}>{row.status}</Badge>
              </TableCell>
              <TableCell>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/invoices/${row.id}`}>View</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}