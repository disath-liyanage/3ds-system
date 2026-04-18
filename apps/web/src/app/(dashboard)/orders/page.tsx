"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const orderStatusOptions = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "reviewing", label: "Reviewing" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "invoiced", label: "Invoiced" }
];

const rows = [
  { id: "o1", order_number: 1024, customer: "City Paint Mart", status: "pending", amount: "LKR 25,000" },
  { id: "o2", order_number: 1025, customer: "Northline Traders", status: "approved", amount: "LKR 72,500" },
  { id: "o3", order_number: 1026, customer: "Kandy Hardware", status: "reviewing", amount: "LKR 14,200" }
];

export default function OrdersPage() {
  const [status, setStatus] = useState("all");

  const filteredRows = useMemo(
    () => (status === "all" ? rows : rows.filter((row) => row.status === status)),
    [status]
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-muted-foreground">Track and review sales orders.</p>
        </div>
        <Button asChild>
          <Link href="/orders/new">New Order</Link>
        </Button>
      </div>

      <div className="max-w-xs">
        <Select options={orderStatusOptions} value={status} onChange={(event) => setStatus(event.target.value)} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.order_number}</TableCell>
              <TableCell>{row.customer}</TableCell>
              <TableCell>
                <Badge variant={row.status === "approved" ? "success" : row.status === "rejected" ? "danger" : "warning"}>
                  {row.status}
                </Badge>
              </TableCell>
              <TableCell>{row.amount}</TableCell>
              <TableCell>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/orders/${row.id}`}>View</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}