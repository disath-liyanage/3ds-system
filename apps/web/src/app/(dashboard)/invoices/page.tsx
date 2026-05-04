"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useInvoices } from "@/hooks/useInvoices";

export default function InvoicesPage() {
  const { permissions, isLoading: isPermissionsLoading } = useCurrentUserPermissions();
  const { data: invoices, isLoading: isInvoicesLoading } = useInvoices();

  const [customerSearch, setCustomerSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [minTotal, setMinTotal] = useState("");
  const [maxTotal, setMaxTotal] = useState("");
  const [minInvoiceNo, setMinInvoiceNo] = useState("");
  const [maxInvoiceNo, setMaxInvoiceNo] = useState("");

  const hasFilters = 
    customerSearch !== "" ||
    startDate !== "" ||
    endDate !== "" ||
    statusFilter !== "all" ||
    minTotal !== "" ||
    maxTotal !== "" ||
    minInvoiceNo !== "" ||
    maxInvoiceNo !== "";

  const handleResetFilters = () => {
    setCustomerSearch("");
    setStartDate("");
    setEndDate("");
    setStatusFilter("all");
    setMinTotal("");
    setMaxTotal("");
    setMinInvoiceNo("");
    setMaxInvoiceNo("");
  };

  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    let result = invoices;

    if (customerSearch) {
      const lowerSearch = customerSearch.toLowerCase();
      result = result.filter((inv) => inv.customer_name.toLowerCase().includes(lowerSearch));
    }

    if (startDate) {
      const start = new Date(startDate).getTime();
      result = result.filter((inv) => new Date(inv.created_at).getTime() >= start);
    }
    if (endDate) {
      const end = new Date(endDate).getTime();
      result = result.filter((inv) => new Date(inv.created_at).getTime() <= end + 86400000); // end of day
    }

    if (statusFilter !== "all") {
      result = result.filter((inv) => inv.status === statusFilter);
    }

    if (minTotal) {
      result = result.filter((inv) => inv.total_amount >= Number(minTotal));
    }
    if (maxTotal) {
      result = result.filter((inv) => inv.total_amount <= Number(maxTotal));
    }

    if (minInvoiceNo) {
      result = result.filter((inv) => inv.invoice_number >= Number(minInvoiceNo));
    }
    if (maxInvoiceNo) {
      result = result.filter((inv) => inv.invoice_number <= Number(maxInvoiceNo));
    }

    return result;
  }, [invoices, customerSearch, startDate, endDate, statusFilter, minTotal, maxTotal, minInvoiceNo, maxInvoiceNo]);

  if (isPermissionsLoading) {
    return <p className="text-sm text-muted-foreground">Loading permissions...</p>;
  }

  // NOTE: assuming canCreateInvoices also grants view permissions for simplicity,
  // or you could have a dedicated canViewInvoices. Using canCreateInvoices for now.
  if (!permissions?.canCreateInvoices) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to view invoices.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground">Track issuance, payment methods, and statuses.</p>
        </div>
        <Button asChild>
          <Link href="/invoices/new">New Invoice</Link>
        </Button>
      </header>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-md">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Customer</label>
          <Input 
            placeholder="Search customer..." 
            value={customerSearch} 
            onChange={(e) => setCustomerSearch(e.target.value)} 
          />
        </div>
        
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Status</label>
          <select 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="issued">Issued</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Date Range</label>
          <div className="flex items-center gap-2">
            <Input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
            />
            <span>-</span>
            <Input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Total Range</label>
          <div className="flex items-center gap-2">
            <Input 
              type="number" 
              placeholder="Min" 
              value={minTotal} 
              onChange={(e) => setMinTotal(e.target.value)} 
            />
            <span>-</span>
            <Input 
              type="number" 
              placeholder="Max" 
              value={maxTotal} 
              onChange={(e) => setMaxTotal(e.target.value)} 
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Inv Number Range</label>
          <div className="flex items-center gap-2">
            <Input 
              type="number" 
              placeholder="Min No" 
              value={minInvoiceNo} 
              onChange={(e) => setMinInvoiceNo(e.target.value)} 
            />
            <span>-</span>
            <Input 
              type="number" 
              placeholder="Max No" 
              value={maxInvoiceNo} 
              onChange={(e) => setMaxInvoiceNo(e.target.value)} 
            />
          </div>
        </div>

        <div className="md:col-span-2 lg:col-span-4 flex justify-end mt-2">
          <Button variant="outline" size="sm" onClick={handleResetFilters} disabled={!hasFilters}>
            Reset Filters
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isInvoicesLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                Loading invoices...
              </TableCell>
            </TableRow>
          ) : filteredInvoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                No invoices found matching criteria.
              </TableCell>
            </TableRow>
          ) : (
            filteredInvoices.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.invoice_number}</TableCell>
                <TableCell>{new Date(row.created_at).toLocaleDateString()}</TableCell>
                <TableCell>{row.customer_name}</TableCell>
                <TableCell className="capitalize">{row.payment_method}</TableCell>
                <TableCell>LKR {row.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "paid" ? "success" : "default"}>{row.status}</Badge>
                </TableCell>
                <TableCell>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/invoices/${row.id}`}>View</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </section>
  );
}