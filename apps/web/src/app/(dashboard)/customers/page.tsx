"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import {
  approvePendingCustomer,
  createArea,
  createCustomer,
  deleteCustomer,
  getAreas,
  getSalesReps,
  removePendingCustomer,
  updateCustomer
} from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  address: string;
  area: string | null;
  credit_limit: number;
  balance: number;
  status: "pending_approval" | "active" | "rejected";
  created_by: string | null;
  sales_rep_id: string | null;
};

const CUSTOMERS_QUERY_KEY = ["customers"] as const;
const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;
const NOTIFICATIONS_UNREAD_QUERY_KEY = ["notifications-unread-count"] as const;
const PAGE_SIZE = 50;

export default function CustomersPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [areaFilter, setAreaFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CustomerRow["status"]>("all");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "with_balance" | "zero_balance" | "credit_balance">("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAddAreaOpen, setIsAddAreaOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAreaSubmitting, setIsAreaSubmitting] = useState(false);
  const [areaName, setAreaName] = useState("");
  const [processingCustomerId, setProcessingCustomerId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    area: "",
    credit_limit: "0",
    sales_rep_id: ""
  });
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    address: "",
    area: "",
    credit_limit: "0",
    sales_rep_id: ""
  });

  const { permissions, isLoading, user } = useCurrentUserPermissions();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  const salesRepsQuery = useQuery({
    queryKey: ["sales-reps"],
    queryFn: async () => await getSalesReps()
  });
  const areasQuery = useQuery({
    queryKey: ["areas"],
    queryFn: async () => await getAreas()
  });

  useRealtimeInvalidate({
    channel: "customers-realtime",
    table: "customers",
    queryKeys: [CUSTOMERS_QUERY_KEY, NOTIFICATIONS_QUERY_KEY, NOTIFICATIONS_UNREAD_QUERY_KEY]
  });

  const customersQuery = useQuery({
    queryKey: [...CUSTOMERS_QUERY_KEY, { page, query, areaFilter, statusFilter, balanceFilter }],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from("customers")
        .select("id, name, phone, address, area, credit_limit, balance, status, created_by, sales_rep_id", { count: "exact" })
        .order("created_at", { ascending: false });
      if (query.trim()) {
        const search = query.trim().replace(/[%_]/g, "\\$&");
        q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%,area.ilike.%${search}%`);
      }
      if (areaFilter) q = q.eq("area", areaFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (balanceFilter === "with_balance") q = q.gt("balance", 0);
      if (balanceFilter === "zero_balance") q = q.eq("balance", 0);
      if (balanceFilter === "credit_balance") q = q.lt("balance", 0);
      const { data, error, count } = await q.range(from, to);

      if (error) throw new Error(error.message);
      return { rows: (data || []) as CustomerRow[], total: count ?? 0 };
    }
  });

  const statusOptions = useMemo(
    () => [
      { value: "all", label: "All statuses" },
      { value: "active", label: "Approved" },
      { value: "pending_approval", label: "Pending Approval" },
      { value: "rejected", label: "Rejected" }
    ],
    []
  );
  const balanceOptions = useMemo(
    () => [
      { value: "all", label: "All balances" },
      { value: "with_balance", label: "With balance" },
      { value: "zero_balance", label: "Zero balance" },
      { value: "credit_balance", label: "Credit balance" }
    ],
    []
  );
  const areaOptions = useMemo(
    () => [
      { value: "", label: "All areas" },
      ...(areasQuery.data || []).map((area) => ({ value: area.name, label: area.name }))
    ],
    [areasQuery.data]
  );

  const filtered = customersQuery.data?.rows || [];
  const total = customersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endRow = total === 0 ? 0 : Math.min(page * PAGE_SIZE, total);

  const hasFilters = areaFilter !== "" || statusFilter !== "all" || balanceFilter !== "all";

  const canViewCustomers = permissions?.canViewCustomers || permissions?.canManageCustomers;
  const canAddCustomers = Boolean(permissions?.canAddCustomers);
  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";
  const selectedCustomer = filtered.find((customer) => customer.id === selectedCustomerId) || null;
  const isOwnPendingSalesRepCustomer = Boolean(
    user?.role === "sales_rep" &&
      selectedCustomer?.status === "pending_approval" &&
      selectedCustomer?.created_by === user?.id
  );
  const canEditSelected = Boolean(selectedCustomer && (isAdminOrManager || isOwnPendingSalesRepCustomer));
  const canApproveSelected = Boolean(isAdminOrManager && selectedCustomer?.status === "pending_approval");
  const canDeletePendingSelected = Boolean(
    selectedCustomer?.status === "pending_approval" && (isAdminOrManager || isOwnPendingSalesRepCustomer)
  );
  const canRemoveApprovedSelected = Boolean(selectedCustomer?.status === "active" && isAdminOrManager);
  const isPendingSelected = selectedCustomer?.status === "pending_approval";

  const handleResetFilters = () => {
    setAreaFilter("");
    setStatusFilter("all");
    setBalanceFilter("all");
    setPage(1);
  };

  useEffect(() => {
    setPage(1);
  }, [query, areaFilter, statusFilter, balanceFilter]);

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

    if (isAdminOrManager && !form.sales_rep_id) {
      toast({ title: "Validation error", description: "Please select a sales rep.", variant: "error" });
      return;
    }

    setIsSubmitting(true);
    const result = await createCustomer({
      name: form.name,
      phone: form.phone,
      address: form.address,
      area: form.area,
      credit_limit: Number(form.credit_limit || 0),
      sales_rep_id: form.sales_rep_id || undefined
    });
    setIsSubmitting(false);

    if (!result.success) {
      toast({ title: "Failed to add customer", description: result.error, variant: "error" });
      return;
    }

    toast({ title: "Customer submitted", description: result.message, variant: "success" });
    setForm({ name: "", phone: "", address: "", area: "", credit_limit: "0", sales_rep_id: "" });
    setIsAddOpen(false);
    await customersQuery.refetch();
  };

  const openCustomerDialog = (customer: CustomerRow) => {
    setSelectedCustomerId(customer.id);
    setEditForm({
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      area: customer.area || "",
      credit_limit: String(customer.credit_limit ?? 0),
      sales_rep_id: customer.sales_rep_id || ""
    });
    setIsEditing(false);
  };

  const handleSaveCustomer = async () => {
    if (!selectedCustomer) return;
    
    if (isAdminOrManager && !editForm.sales_rep_id) {
      toast({ title: "Validation error", description: "Please select a sales rep.", variant: "error" });
      return;
    }

    setProcessingCustomerId(selectedCustomer.id);
    const result = await updateCustomer(selectedCustomer.id, {
      name: editForm.name,
      phone: editForm.phone,
      address: editForm.address,
      area: editForm.area,
      credit_limit: Number(editForm.credit_limit || 0),
      sales_rep_id: editForm.sales_rep_id || undefined
    });
    setProcessingCustomerId(null);

    if (!result.success) {
      toast({ title: "Update failed", description: result.error, variant: "error" });
      return;
    }

    toast({ title: "Customer updated", description: result.message, variant: "success" });
    setIsEditing(false);
    await customersQuery.refetch();
  };

  const handleApproveFromCustomers = async (customerId: string) => {
    setProcessingCustomerId(customerId);
    const result = await approvePendingCustomer(customerId);
    setProcessingCustomerId(null);
    if (!result.success) {
      toast({ title: "Approve failed", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Customer approved", description: result.message, variant: "success" });
    setIsEditing(false);
    await queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    await customersQuery.refetch();
  };

  const handleSaveAndApprove = async () => {
    if (!selectedCustomer) return;
    const customerId = selectedCustomer.id;

    if (isAdminOrManager && !editForm.sales_rep_id) {
      toast({ title: "Validation error", description: "Please select a sales rep.", variant: "error" });
      return;
    }

    setProcessingCustomerId(customerId);
    const saveResult = await updateCustomer(customerId, {
      name: editForm.name,
      phone: editForm.phone,
      address: editForm.address,
      area: editForm.area,
      credit_limit: Number(editForm.credit_limit || 0),
      sales_rep_id: editForm.sales_rep_id || undefined
    });

    if (!saveResult.success) {
      setProcessingCustomerId(null);
      toast({ title: "Update failed", description: saveResult.error, variant: "error" });
      return;
    }

    const approveResult = await approvePendingCustomer(customerId);
    setProcessingCustomerId(null);
    if (!approveResult.success) {
      toast({ title: "Approve failed", description: approveResult.error, variant: "error" });
      return;
    }

    toast({
      title: "Customer updated and approved",
      description: approveResult.message,
      variant: "success"
    });
    setIsEditing(false);
    await queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    await customersQuery.refetch();
  };

  const handleDeletePendingCustomer = async (customerId: string) => {
    setProcessingCustomerId(customerId);
    const result = await (isAdminOrManager ? removePendingCustomer(customerId) : deleteCustomer(customerId));
    setProcessingCustomerId(null);
    if (!result.success) {
      toast({ title: "Delete failed", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Customer removed", description: result.message, variant: "success" });
    if (selectedCustomerId === customerId) setSelectedCustomerId(null);
    await customersQuery.refetch();
  };

  const handleRemoveApprovedCustomer = async (customerId: string) => {
    setProcessingCustomerId(customerId);
    const result = await deleteCustomer(customerId);
    setProcessingCustomerId(null);
    if (!result.success) {
      toast({ title: "Remove failed", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Customer removed", description: result.message, variant: "success" });
    if (selectedCustomerId === customerId) setSelectedCustomerId(null);
    await customersQuery.refetch();
  };

  return (
    <section className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground">Click a customer row to view details.</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdminOrManager ? (
            <Button variant="outline" onClick={() => setIsAddAreaOpen(true)}>
              Add Area
            </Button>
          ) : null}
          {canAddCustomers ? <Button onClick={() => setIsAddOpen(true)}>Add Customer</Button> : null}
        </div>
      </header>

      <div className="flex flex-col gap-3 rounded-md border border-border bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <Input
              placeholder="Search customers..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="lg:max-w-md"
            />
            {hasFilters ? <span className="text-xs text-muted-foreground">Filters active</span> : null}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => setFiltersOpen((prev) => !prev)}>
              <span className="flex items-center gap-2">
                <ChevronRight
                  className={
                    filtersOpen
                      ? "h-4 w-4 rotate-90 transition-transform"
                      : "h-4 w-4 rotate-0 transition-transform"
                  }
                />
                {filtersOpen ? "Hide filters" : "Show filters"}
              </span>
            </Button>
            <Button variant={hasFilters ? "default" : "outline"} size="sm" onClick={handleResetFilters} disabled={!hasFilters}>
              Reset
            </Button>
          </div>
        </div>

        {filtersOpen ? (
          <div className="grid grid-cols-1 gap-4 rounded-md border border-border bg-muted/30 p-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Area</label>
              <SearchableSelect
                placeholder={areasQuery.isLoading ? "Loading areas..." : "Select area"}
                options={areaOptions}
                value={areaFilter}
                onChange={setAreaFilter}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Balance</label>
              <Select
                options={balanceOptions}
                value={balanceFilter}
                onChange={(event) => setBalanceFilter(event.target.value as typeof balanceFilter)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Status</label>
              <Select
                options={statusOptions}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              />
            </div>
          </div>
        ) : null}
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
            <TableRow
              key={customer.id}
              className={`cursor-pointer ${customer.status === "pending_approval" ? "bg-orange-50 hover:bg-orange-100" : ""}`}
              onClick={() => openCustomerDialog(customer)}
            >
              <TableCell>{customer.name}</TableCell>
              <TableCell>{customer.phone}</TableCell>
              <TableCell>{customer.area || "-"}</TableCell>
              <TableCell>LKR {Number(customer.balance).toLocaleString()}</TableCell>
              <TableCell>
                {customer.status === "pending_approval"
                  ? "Pending Approval"
                  : customer.status === "rejected"
                    ? "Rejected"
                    : "Approved"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
        <Button variant="outline" size="sm" onClick={() => setPage((prev) => prev - 1)} disabled={page <= 1 || customersQuery.isLoading}>
          {"<"}
        </Button>
        <span>{`Rows ${startRow} - ${endRow} of ${total}`}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((prev) => prev + 1)}
          disabled={page >= totalPages || customersQuery.isLoading}
        >
          {">"}
        </Button>
      </div>

      <Dialog
        open={Boolean(selectedCustomerId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCustomerId(null);
            setIsEditing(false);
          }
        }}
        title="Customer details"
        description="Edit details and manage approval state."
      >
        {selectedCustomer ? (
          <div className="space-y-3">
            <Input
              placeholder="Name"
              value={editForm.name}
              disabled={!isEditing}
              onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <Input
              placeholder="Phone"
              value={editForm.phone}
              disabled={!isEditing}
              onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
            <Input
              placeholder="Address"
              value={editForm.address}
              disabled={!isEditing}
              onChange={(event) => setEditForm((prev) => ({ ...prev, address: event.target.value }))}
            />
            <SearchableSelect
              placeholder={areasQuery.isLoading ? "Loading areas..." : "Select Area"}
              options={(areasQuery.data || []).map((area) => ({ value: area.name, label: area.name }))}
              value={editForm.area || ""}
              disabled={!isEditing}
              onChange={(value) => setEditForm((prev) => ({ ...prev, area: value }))}
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="Credit limit"
              value={editForm.credit_limit}
              disabled={!isEditing}
              onChange={(event) => setEditForm((prev) => ({ ...prev, credit_limit: event.target.value }))}
            />

            {isAdminOrManager ? (
              <SearchableSelect
                placeholder="Select Sales Rep"
                options={(salesRepsQuery.data || []).map((rep) => ({ value: rep.id, label: rep.full_name }))}
                value={editForm.sales_rep_id}
                onChange={(value) => setEditForm((prev) => ({ ...prev, sales_rep_id: value }))}
                disabled={!isEditing}
              />
            ) : null}

            <div className="flex flex-wrap gap-2">
              {canEditSelected && !isEditing ? (
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              ) : null}

              {isEditing && isPendingSelected && canApproveSelected ? (
                <>
                  <Button
                    size="sm"
                    disabled={processingCustomerId === selectedCustomer.id}
                    onClick={handleSaveAndApprove}
                  >
                    Edit & Approve
                  </Button>
                  {canDeletePendingSelected ? (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={processingCustomerId === selectedCustomer.id}
                      onClick={() => handleDeletePendingCustomer(selectedCustomer.id)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </>
              ) : (
                <>
                  {canEditSelected && isEditing ? (
                    <Button
                      size="sm"
                      disabled={processingCustomerId === selectedCustomer.id}
                      onClick={handleSaveCustomer}
                    >
                      Save Changes
                    </Button>
                  ) : null}

                  {canApproveSelected ? (
                    <Button
                      size="sm"
                      disabled={processingCustomerId === selectedCustomer.id}
                      onClick={() => handleApproveFromCustomers(selectedCustomer.id)}
                    >
                      Approve
                    </Button>
                  ) : null}

                  {canDeletePendingSelected ? (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={processingCustomerId === selectedCustomer.id}
                      onClick={() => handleDeletePendingCustomer(selectedCustomer.id)}
                    >
                      Delete
                    </Button>
                  ) : null}

                  {canRemoveApprovedSelected ? (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={processingCustomerId === selectedCustomer.id}
                      onClick={() => handleRemoveApprovedCustomer(selectedCustomer.id)}
                    >
                      Remove Customer
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Customer not found.</p>
        )}
      </Dialog>

      <Dialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        title="Add customer"
        description="Admins and managers create customers immediately. Sales reps submit a request for review."
        showBottomClose={false}
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
          <SearchableSelect
            placeholder={areasQuery.isLoading ? "Loading areas..." : "Select Area"}
            options={(areasQuery.data || []).map((area) => ({ value: area.name, label: area.name }))}
            value={form.area || ""}
            onChange={(value) => setForm((prev) => ({ ...prev, area: value }))}
          />
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="Credit limit"
            value={form.credit_limit}
            onChange={(event) => setForm((prev) => ({ ...prev, credit_limit: event.target.value }))}
          />
          {isAdminOrManager ? (
            <SearchableSelect
              placeholder="Select Sales Rep"
              options={(salesRepsQuery.data || []).map((rep) => ({ value: rep.id, label: rep.full_name }))}
              value={form.sales_rep_id}
              onChange={(value) => setForm((prev) => ({ ...prev, sales_rep_id: value }))}
            />
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Submit"}
          </Button>
        </form>
      </Dialog>

      <Dialog
        open={isAddAreaOpen}
        onOpenChange={setIsAddAreaOpen}
        title="Add area"
        description="Create a new area to use in customer records."
        showBottomClose={false}
      >
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (isAreaSubmitting) return;
            setIsAreaSubmitting(true);
            const result = await createArea(areaName);
            setIsAreaSubmitting(false);

            if (!result.success) {
              toast({ title: "Failed to add area", description: result.error, variant: "error" });
              return;
            }

            toast({ title: "Area added", description: result.message, variant: "success" });
            setAreaName("");
            setIsAddAreaOpen(false);
            await areasQuery.refetch();
          }}
        >
          <Input
            placeholder="Area name"
            value={areaName}
            onChange={(event) => setAreaName(event.target.value)}
            required
          />
          <Button type="submit" disabled={isAreaSubmitting}>
            {isAreaSubmitting ? "Saving..." : "Save Area"}
          </Button>
        </form>
      </Dialog>
    </section>
  );
}
