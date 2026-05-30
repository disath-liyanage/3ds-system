"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approvePendingCustomer,
  deleteCustomer,
  getAreas,
  getCustomerDetail,
  getSalesReps,
  removePendingCustomer,
  updateCustomer,
  type CustomerDetailRow,
  type CustomerInvoiceRow
} from "@/app/actions/customers";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";

type CustomerFormState = {
  name: string;
  phone: string;
  address: string;
  area: string;
  credit_limit: string;
  sales_rep_id: string;
};

const emptyForm: CustomerFormState = {
  name: "",
  phone: "",
  address: "",
  area: "",
  credit_limit: "0",
  sales_rep_id: ""
};

function formatCurrencyLKR(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return `LKR ${Number.isFinite(amount) ? amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) : "0.00"}`;
}

function formatStatusLabel(status: string) {
  if (status === "pending_approval") return "Pending Approval";
  if (status === "rejected") return "Rejected";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getCustomerStatusVariant(status: CustomerDetailRow["status"]) {
  if (status === "pending_approval") return "warning" as const;
  if (status === "rejected") return "danger" as const;
  return "success" as const;
}

function buildCustomerCode(rawId?: string | null) {
  if (!rawId) return "C001";
  const digits = rawId.replace(/\D/g, "");
  if (!digits) return "C001";
  const num = (Number(digits.slice(-6)) % 999) + 1;
  return `C${String(num).padStart(3, "0")}`;
}

function toFormState(customer: CustomerDetailRow): CustomerFormState {
  return {
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    area: customer.area || "",
    credit_limit: String(customer.credit_limit ?? 0),
    sales_rep_id: customer.sales_rep_id || ""
  };
}

function InvoiceTable({
  rows,
  emptyMessage,
  showRemaining = true
}: {
  rows: CustomerInvoiceRow[];
  emptyMessage: string;
  showRemaining?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Collected</TableHead>
          {showRemaining ? <TableHead>Remaining</TableHead> : null}
          <TableHead>Payment</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell>
              <Link href={`/invoices/${invoice.id}`} className="font-medium underline">
                INV-{invoice.invoice_number}
              </Link>
            </TableCell>
            <TableCell>{invoice.created_at ? formatDate(invoice.created_at) : "-"}</TableCell>
            <TableCell>{formatCurrencyLKR(invoice.total_amount)}</TableCell>
            <TableCell>{formatCurrencyLKR(invoice.collected_total)}</TableCell>
            {showRemaining ? <TableCell>{formatCurrencyLKR(invoice.remaining_amount)}</TableCell> : null}
            <TableCell className="capitalize">{invoice.payment_method || "-"}</TableCell>
            <TableCell>{formatStatusLabel(invoice.status)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const customerId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { permissions, isLoading: isPermissionsLoading, user } = useCurrentUserPermissions();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [form, setForm] = useState<CustomerFormState>(emptyForm);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["customer-detail", customerId],
    queryFn: async () => {
      const result = await getCustomerDetail(customerId || "");
      if (!result.success) throw new Error(result.error || "Failed to load customer");
      return result.data ?? null;
    },
    enabled: Boolean(customerId)
  });

  const areasQuery = useQuery({
    queryKey: ["areas"],
    queryFn: async () => await getAreas()
  });

  const salesRepsQuery = useQuery({
    queryKey: ["sales-reps"],
    queryFn: async () => await getSalesReps()
  });

  const customer = detailQuery.data?.customer ?? null;
  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";
  const isOwnPendingSalesRepCustomer = Boolean(
    user?.role === "sales_rep" &&
      customer?.status === "pending_approval" &&
      customer.created_by === user.id
  );
  const canViewCustomers = permissions?.canViewCustomers || permissions?.canManageCustomers;
  const canEditCustomer = Boolean(customer && (isAdminOrManager || isOwnPendingSalesRepCustomer));
  const canApproveCustomer = Boolean(customer && isAdminOrManager && customer.status === "pending_approval");
  const canDeleteCustomer = Boolean(
    customer &&
      ((customer.status === "pending_approval" && (isAdminOrManager || isOwnPendingSalesRepCustomer)) ||
        (customer.status === "active" && isAdminOrManager))
  );

  const detailFields = useMemo(() => {
    if (!customer) return [];
    return [
      ["Customer ID", buildCustomerCode(customer.id)],
      ["Balance", formatCurrencyLKR(customer.balance)],
      ["Sales Rep", customer.sales_rep_name || "-"],
      ["Phone", customer.phone],
      ["Credit Limit", formatCurrencyLKR(customer.credit_limit)],
      ["Created By", customer.created_by_name || customer.created_by || "-"],
      ["Address", customer.address],
      ["Area", customer.area || "-"],
      ["Approved By", customer.approved_by_name || customer.approved_by || "-"]
    ];
  }, [customer]);

  useEffect(() => {
    if (isEditOpen && customer) {
      setForm(toFormState(customer));
      setSubmitError(null);
      setIsSubmitting(false);
    }
  }, [customer, isEditOpen]);

  const refreshCustomer = async () => {
    await detailQuery.refetch();
    await queryClient.invalidateQueries({ queryKey: ["customers"] });
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer || isSubmitting) return;

    const creditLimit = Number(form.credit_limit || 0);
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setSubmitError("Name, phone, and address are required");
      return;
    }
    if (!Number.isFinite(creditLimit) || creditLimit < 0) {
      setSubmitError("Credit limit must be a valid non-negative number");
      return;
    }
    if (isAdminOrManager && !form.sales_rep_id) {
      setSubmitError("Please select a sales rep.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    const result = await updateCustomer(customer.id, {
      name: form.name,
      phone: form.phone,
      address: form.address,
      area: form.area,
      credit_limit: creditLimit,
      sales_rep_id: form.sales_rep_id || undefined
    });
    setIsSubmitting(false);

    if (!result.success) {
      setSubmitError(result.error || "Failed to update customer");
      return;
    }

    toast({ title: "Customer updated", description: result.message, variant: "success" });
    setIsEditOpen(false);
    await refreshCustomer();
  };

  const handleApprove = async () => {
    if (!customer || isApproving) return;
    setIsApproving(true);
    const result = await approvePendingCustomer(customer.id);
    setIsApproving(false);

    if (!result.success) {
      toast({ title: "Approve failed", description: result.error, variant: "error" });
      return;
    }

    toast({ title: "Customer approved", description: result.message, variant: "success" });
    await queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    await refreshCustomer();
  };

  const handleDelete = async () => {
    if (!customer || isDeleting) return;

    setIsDeleting(true);
    const result =
      customer.status === "pending_approval" && isAdminOrManager
        ? await removePendingCustomer(customer.id)
        : await deleteCustomer(customer.id);
    setIsDeleting(false);

    if (!result.success) {
      toast({ title: "Delete failed", description: result.error, variant: "error" });
      return;
    }

    toast({ title: "Customer removed", description: result.message, variant: "success" });
    await queryClient.invalidateQueries({ queryKey: ["customers"] });
    router.push("/customers");
  };

  if (!isPermissionsLoading && !canViewCustomers) {
    return (
      <section className="space-y-4">
        <PageHeader title="Customer details" description="You do not have permission to view customers." />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Customer details"
        description="Review customer information, outstanding invoices, and this month's invoices."
        actions={
          <>
            {canEditCustomer ? <Button onClick={() => setIsEditOpen(true)}>Edit Customer</Button> : null}
            {canApproveCustomer ? (
              <Button variant="outline" onClick={handleApprove} disabled={isApproving}>
                {isApproving ? "Approving..." : "Approve"}
              </Button>
            ) : null}
          </>
        }
      />

      {detailQuery.isLoading || isPermissionsLoading ? (
        <div className="rounded-md border border-border bg-white p-4 text-sm text-muted-foreground">
          Loading customer...
        </div>
      ) : detailQuery.isError ? (
        <div className="rounded-md border border-border bg-white p-4 text-sm text-red-600">
          Failed to load customer.
        </div>
      ) : customer ? (
        <>
          <Card>
            <CardHeader className="flex items-center justify-between gap-3 pb-2">
              <CardTitle>{customer.name}</CardTitle>
              <Badge variant={getCustomerStatusVariant(customer.status)}>{formatStatusLabel(customer.status)}</Badge>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                {detailFields.map(([label, value]) => (
                  <div key={label} className="rounded-md border border-border bg-muted/20 p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
                    <p className="mt-1 break-words font-medium">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Outstanding Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <InvoiceTable
                rows={detailQuery.data?.outstanding_invoices ?? []}
                emptyMessage="No outstanding invoices for this customer."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>This Month&apos;s Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <InvoiceTable
                rows={detailQuery.data?.current_month_invoices ?? []}
                emptyMessage="No invoices raised for this customer this month."
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="rounded-md border border-border bg-white p-4 text-sm text-muted-foreground">
          Customer not found.
        </div>
      )}

      <Dialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        title="Edit customer"
        description="Update customer details and save to close."
        maxWidthClassName="max-w-3xl"
        stickyHeader
        showBottomClose={false}
      >
        <form className="space-y-4" onSubmit={handleEditSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="edit-customer-name" className="text-sm font-medium">Name</label>
              <Input
                id="edit-customer-name"
                required
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="edit-customer-phone" className="text-sm font-medium">Phone</label>
              <Input
                id="edit-customer-phone"
                required
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label htmlFor="edit-customer-address" className="text-sm font-medium">Address</label>
              <Input
                id="edit-customer-address"
                required
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="edit-customer-area" className="text-sm font-medium">Area</label>
              <SearchableSelect
                id="edit-customer-area"
                placeholder={areasQuery.isLoading ? "Loading areas..." : "Select Area"}
                options={(areasQuery.data || []).map((area) => ({ value: area.name, label: area.name }))}
                value={form.area}
                onChange={(value) => setForm((prev) => ({ ...prev, area: value }))}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="edit-customer-credit-limit" className="text-sm font-medium">Credit Limit</label>
              <Input
                id="edit-customer-credit-limit"
                type="number"
                min={0}
                step="0.01"
                value={form.credit_limit}
                onChange={(event) => setForm((prev) => ({ ...prev, credit_limit: event.target.value }))}
              />
            </div>
            {isAdminOrManager ? (
              <div className="space-y-1 md:col-span-2">
                <label htmlFor="edit-customer-sales-rep" className="text-sm font-medium">Sales Rep</label>
                <SearchableSelect
                  id="edit-customer-sales-rep"
                  placeholder="Select Sales Rep"
                  options={(salesRepsQuery.data || []).map((rep) => ({ value: rep.id, label: rep.full_name }))}
                  value={form.sales_rep_id}
                  onChange={(value) => setForm((prev) => ({ ...prev, sales_rep_id: value }))}
                />
              </div>
            ) : null}
          </div>

          {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            {canDeleteCustomer ? (
              <Button
                type="button"
                variant="danger"
                onClick={() => setIsDeleteOpen(true)}
                disabled={isSubmitting}
              >
                Delete Customer
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving changes..." : "Save changes"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete customer"
        description="This will remove the customer record. This action cannot be undone."
        maxWidthClassName="max-w-xl"
        showBottomClose={false}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Delete {customer?.name || "this customer"}?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete customer"}
            </Button>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={isDeleting}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
