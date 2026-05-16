"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { addCollectionExpense } from "@/app/actions/collections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCollectionExpenses, COLLECTION_EXPENSES_QUERY_KEY } from "@/hooks/useCollectionExpenses";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 2 }).format(value);

const statusVariants: Record<string, "default" | "success" | "warning" | "danger" | "muted"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger"
};

export default function CollectionExpensesPage() {
  const { permissions, isLoading } = useCurrentUserPermissions();
  const expensesQuery = useCollectionExpenses();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState("Fuel");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("");

  const canRecordCollections = permissions?.canRecordCollections ?? false;

  const addExpenseMutation = useMutation({
    mutationFn: async () => {
      const result = await addCollectionExpense({
        category,
        notes: notes.trim(),
        amount: Number(amount)
      });
      if (!result.success) throw new Error(result.error || "Failed to add expense");
      return result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COLLECTION_EXPENSES_QUERY_KEY });
      setCategory("Fuel");
      setNotes("");
      setAmount("");
      toast({ title: "Expense added", variant: "success" });
    },
    onError: (error) => {
      toast({ title: "Failed to add expense", description: String(error), variant: "error" });
    }
  });

  const totals = useMemo(() => {
    const rows = expensesQuery.data ?? [];
    return rows.reduce(
      (acc, row) => {
        acc.total += row.amount;
        if (row.status === "pending") acc.pending += row.amount;
        if (row.status === "approved") acc.approved += row.amount;
        return acc;
      },
      { total: 0, pending: 0, approved: 0 }
    );
  }, [expensesQuery.data]);

  if (!isLoading && !canRecordCollections) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to add expenses.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Expenses</h1>
        <p className="text-sm text-muted-foreground">Add expenses related to collection visits.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Add Expense</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Category</label>
              <Select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                options={[
                  { value: "Fuel", label: "Fuel" },
                  { value: "Food", label: "Food" },
                  { value: "Parking", label: "Parking" },
                  { value: "Other", label: "Other" }
                ]}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Notes</label>
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional note"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
          </div>

          <Button type="button" disabled={addExpenseMutation.isPending} onClick={() => addExpenseMutation.mutate()}>
            Add Expense
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending</CardTitle>
          </CardHeader>
          <CardContent>{formatCurrency(totals.pending)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approved</CardTitle>
          </CardHeader>
          <CardContent>{formatCurrency(totals.approved)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total</CardTitle>
          </CardHeader>
          <CardContent>{formatCurrency(totals.total)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expensesQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    Loading expenses...
                  </TableCell>
                </TableRow>
              ) : (expensesQuery.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    No expenses recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                (expensesQuery.data ?? []).map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{expense.category}</TableCell>
                    <TableCell>{formatCurrency(expense.amount)}</TableCell>
                    <TableCell>{expense.notes || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[expense.status]}>{expense.status}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(expense.created_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
