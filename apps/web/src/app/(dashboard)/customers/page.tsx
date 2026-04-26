"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";

const customers = [
  { id: "u1", name: "City Paint Mart", phone: "+94 77111222", area: "Colombo", balance: "LKR 15,000" },
  { id: "u2", name: "Northline Traders", phone: "+94 77888444", area: "Jaffna", balance: "LKR 0" },
  { id: "u3", name: "Kandy Hardware", phone: "+94 76123456", area: "Kandy", balance: "LKR 8,450" }
];

export default function CustomersPage() {
  const [query, setQuery] = useState("");
  const { permissions, isLoading } = useCurrentUserPermissions();

  const filtered = useMemo(
    () =>
      customers.filter((customer) =>
        `${customer.name} ${customer.phone} ${customer.area}`.toLowerCase().includes(query.toLowerCase())
      ),
    [query]
  );

  if (!isLoading && !permissions?.canManageCustomers) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to view customers.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-sm text-muted-foreground">Review account balances and contacts.</p>
      </header>

      <div className="max-w-sm">
        <Input placeholder="Search customers..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Area</TableHead>
            <TableHead>Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell>{customer.name}</TableCell>
              <TableCell>{customer.phone}</TableCell>
              <TableCell>{customer.area}</TableCell>
              <TableCell>{customer.balance}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}