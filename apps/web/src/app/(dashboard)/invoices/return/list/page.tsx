"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { listReturnInvoices, type ReturnInvoiceListRow } from "@/app/actions/invoices";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export default function ReturnInvoiceListPage() {
  const router = useRouter();
  const { data, isLoading, isError, error } = useQuery<ReturnInvoiceListRow[]>({
    queryKey: ["return-invoices"],
    queryFn: async () => {
      const result = await listReturnInvoices();
      if (!result.success) throw new Error(result.error || "Failed to load returned invoices");
      return result.data ?? [];
    }
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading returned invoices...</p>;
  }

  if (isError) {
    return (
      <section className="space-y-4">
        <PageHeader title="Returned Invoices" description="Failed to load returned invoices." />
        <p className="text-xs text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Returned Invoices"
        description="All created return invoices."
      />

      <div className="glass-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Return #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Source Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Returned By</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No returned invoices found.
                </TableCell>
              </TableRow>
            ) : (
              (data ?? []).map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => router.push(`/invoices/return/${row.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/invoices/return/${row.id}`);
                    }
                  }}
                  tabIndex={0}
                >
                  <TableCell>
                    <Link href={`/invoices/return/${row.id}`} className="font-medium underline">
                      RET-{row.return_number}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(row.created_at)}</TableCell>
                  <TableCell>INV-{row.source_invoice_number}</TableCell>
                  <TableCell>{row.customer_name}</TableCell>
                  <TableCell>{row.returned_by_name}</TableCell>
                  <TableCell className="text-right">
                    LKR {row.total_return_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
