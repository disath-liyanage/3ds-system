"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { approveCollectionRep } from "@/app/actions/collections";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCollectionApprovalDetail, COLLECTION_APPROVAL_DETAIL_QUERY_KEY } from "@/hooks/useCollectionApprovalDetail";
import {
  useCollectionApprovalSummaries,
  COLLECTION_APPROVAL_SUMMARIES_QUERY_KEY
} from "@/hooks/useCollectionApprovalSummaries";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";
import { Check, CircleCheck } from "lucide-react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 2 }).format(value);

const statusVariants: Record<string, "default" | "success" | "warning" | "danger" | "muted"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger"
};

export default function CollectionApprovalsPage() {
  const { permissions, isLoading } = useCurrentUserPermissions();
  const summariesQuery = useCollectionApprovalSummaries();
  const queryClient = useQueryClient();

  const [selectedRepId, setSelectedRepId] = useState("");
  const detailQuery = useCollectionApprovalDetail(selectedRepId);

  const canValidate = permissions?.canValidateCollections ?? false;

  const repOptions = useMemo(
    () =>
      (summariesQuery.data ?? []).map((rep) => ({
        value: rep.sales_rep_id,
        label: rep.sales_rep_name
      })),
    [summariesQuery.data]
  );

  const selectedSummary = useMemo(
    () => summariesQuery.data?.find((rep) => rep.sales_rep_id === selectedRepId) ?? null,
    [summariesQuery.data, selectedRepId]
  );

  const approveMutation = useMutation({
    mutationFn: async (repId: string) => {
      const result = await approveCollectionRep(repId);
      if (!result.success) throw new Error(result.error || "Failed to approve collections");
      return result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COLLECTION_APPROVAL_SUMMARIES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: COLLECTION_APPROVAL_DETAIL_QUERY_KEY });
      toast({ title: "Collections approved", variant: "success" });
    },
    onError: (error) => {
      toast({ title: "Approval failed", description: String(error), variant: "error" });
    }
  });

  if (!isLoading && !canValidate) {
    return (
      <section className="space-y-4">
        <PageHeader
          title="Approve Collections"
          description="You do not have permission to approve collections."
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Approve Collections"
        description="Select a sales rep to review pending collections and expenses."
      />

      <Card>
        <CardHeader>
          <CardTitle>Sales Rep</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1 max-w-sm">
            <label className="text-sm font-medium">Select Rep</label>
            <Select
              value={selectedRepId}
              onChange={(event) => setSelectedRepId(event.target.value)}
              options={repOptions}
              placeholder={summariesQuery.isLoading ? "Loading reps..." : "Select sales rep"}
            />
          </div>
          {selectedSummary ? (
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                Cash Collected: {formatCurrency(selectedSummary.pending_cash_total)}
              </div>
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                Cheques Collected: {formatCurrency(selectedSummary.pending_cheque_total)}
              </div>
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                Expenses: {formatCurrency(selectedSummary.pending_expenses_total)}
              </div>
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                Cash in hand: {formatCurrency(selectedSummary.cash_in_hand)}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {selectedRepId ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Pending Collections</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Collected At</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-muted-foreground">
                        Loading collections...
                      </TableCell>
                    </TableRow>
                  ) : (detailQuery.data?.collections ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-muted-foreground">
                        No pending collections.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (detailQuery.data?.collections ?? []).map((collection) => (
                      <TableRow key={collection.id}>
                        <TableCell>{collection.invoice_number ?? "-"}</TableCell>
                        <TableCell>{collection.customer_name}</TableCell>
                        <TableCell>{formatCurrency(collection.amount)}</TableCell>
                        <TableCell>{formatDate(collection.created_at)}</TableCell>
                        <TableCell>{collection.notes || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-sm text-muted-foreground">
                        Loading expenses...
                      </TableCell>
                    </TableRow>
                  ) : (detailQuery.data?.expenses ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-sm text-muted-foreground">
                        No pending expenses.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (detailQuery.data?.expenses ?? []).map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{expense.title}</TableCell>
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

          <div className="flex items-center justify-end">
            <Button
              type="button"
              disabled={
                approveMutation.isPending ||
                !detailQuery.data ||
                (detailQuery.data.collections.length === 0 && detailQuery.data.expenses.length === 0)
              }
              onClick={() => approveMutation.mutate(selectedRepId)}
            >
              <CircleCheck className="mr-2 h-4 w-4" />
              Approve Collection
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
