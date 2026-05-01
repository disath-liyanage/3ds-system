"use client";

import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useMemo, useState } from "react";

import { createCustomer } from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  area: string;
  balance: number;
  status: "pending_approval" | "active" | "rejected";
};

export default function CustomersPage() {
  const [query, setQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    area: "",
    credit_limit: "0"
  });
  const { permissions, isLoading } = useCurrentUserPermissions();
  const supabase = useMemo(() => createClient(), []);

  const customersQuery = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, area, balance, status")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data || []) as CustomerRow[];
    }
  });

  const filtered = useMemo(
    () =>
      (customersQuery.data || []).filter((customer) =>
        `${customer.name} ${customer.phone} ${customer.area}`.toLowerCase().includes(query.toLowerCase())
      ),
    [customersQuery.data, query]
  );

  const canViewCustomers = permissions?.canViewCustomers || permissions?.canManageCustomers;
  const canAddCustomers = Boolean(permissions?.canAddCustomers);

  if (!isLoading && !canViewCustomers) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to view customers.</p>
      </section>
    );
  }

  const handleAddCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    const result = await createCustomer({
      name: form.name,
      phone: form.phone,
      address: form.address,
      area: form.area,
      credit_limit: Number(form.credit_limit || 0)
    });
    setIsSubmitting(false);

    if (!result.success) {
      toast({ title: "Failed to add customer", description: result.error, variant: "error" });
      return;
    }

    toast({ title: "Customer submitted", description: result.message, variant: "success" });
    setForm({ name: "", phone: "", address: "", area: "", credit_limit: "0" });
    setIsAddOpen(false);
    await customersQuery.refetch();
  };

  return (
    <section className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground">Review account balances and contacts.</p>
        </div>
        {canAddCustomers ? <Button onClick={() => setIsAddOpen(true)}>Add Customer</Button> : null}
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
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell>{customer.name}</TableCell>
              <TableCell>{customer.phone}</TableCell>
              <TableCell>{customer.area}</TableCell>
              <TableCell>LKR {Number(customer.balance).toLocaleString()}</TableCell>
              <TableCell>
                {customer.status === "pending_approval"
                  ? "Pending Approval"
                  : customer.status === "rejected"
                    ? "Rejected"
                    : "Active"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        title="Add customer"
        description="Admins and managers create customers immediately. Sales reps submit a request for review."
      >
        <form className="space-y-3" onSubmit={handleAddCustomer}>
          <Input
            placeholder="Name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
          <Input
            placeholder="Phone"
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            required
          />
          <Input
            placeholder="Address"
            value={form.address}
            onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
            required
          />
          <Input
            placeholder="Area"
            value={form.area}
            onChange={(event) => setForm((prev) => ({ ...prev, area: event.target.value }))}
            required
          />
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="Credit limit"
            value={form.credit_limit}
            onChange={(event) => setForm((prev) => ({ ...prev, credit_limit: event.target.value }))}
          />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Submit"}
          </Button>
        </form>
      </Dialog>
    </section>
  );
}
