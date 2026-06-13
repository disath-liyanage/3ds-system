"use client";

import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CirclePlus, MapPinned, Save, Search } from "lucide-react";

import {
  createArea,
  createCustomer,
  getAreas,
  getSalesReps
} from "@/app/actions/customers";
import { Badge } from "@/components/ui/badge";
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
  credit_limit: number | null;
  balance: number;
  status: "pending_approval" | "active" | "rejected";
  created_by: string | null;
  sales_rep_id: string | null;
};

const CUSTOMERS_QUERY_KEY = ["customers"] as const;
const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;
const NOTIFICATIONS_UNREAD_QUERY_KEY = ["notifications-unread-count"] as const;
const PAGE_SIZE = 50;

function getCustomerStatusBadge(status: CustomerRow["status"]) {
  if (status === "pending_approval") return { label: "Pending", variant: "warning" as const };
  if (status === "rejected") return { label: "Rejected", variant: "danger" as const };
  return { label: "Approved", variant: "success" as const };
}

function toTitleCaseWords(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[A-Za-z][A-Za-z']*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

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
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    area: "",
    credit_limit: "",
    sales_rep_id: ""
  });

  const router = useRouter();
  const { permissions, isLoading, user } = useCurrentUserPermissions();
  const supabase = useMemo(() => createClient(), []);

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
        .order("name", { ascending: true });
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
    const normalizedName = toTitleCaseWords(form.name);
    const normalizedAddress = toTitleCaseWords(form.address);
    setForm((prev) => ({ ...prev, name: normalizedName, address: normalizedAddress }));
    const creditLimit = form.credit_limit.trim() === "" ? null : Number(form.credit_limit);
    if (creditLimit !== null && (!Number.isFinite(creditLimit) || creditLimit < 0)) {
      toast({ title: "Validation error", description: "Credit limit must be a valid non-negative number.", variant: "error" });
      setIsSubmitting(false);
      return;
    }

    const result = await createCustomer({
      name: normalizedName,
      phone: form.phone,
      address: normalizedAddress,
      area: form.area,
      credit_limit: creditLimit,
      sales_rep_id: form.sales_rep_id || undefined
    });
    setIsSubmitting(false);

    if (!result.success) {
      toast({ title: "Failed to add customer", description: result.error, variant: "error" });
      return;
    }

    toast({ title: "Customer submitted", description: result.message, variant: "success" });
    setForm({ name: "", phone: "", address: "", area: "", credit_limit: "", sales_rep_id: "" });
    setIsAddOpen(false);
    await customersQuery.refetch();
  };

  const openCustomerDialog = (customer: CustomerRow) => {
    router.push(`/customers/${customer.id}`);
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
              <MapPinned className="mr-2 h-4 w-4" />
              Add Area
            </Button>
          ) : null}
          {canAddCustomers ? <Button onClick={() => setIsAddOpen(true)}>Add Customer</Button> : null}
        </div>
      </header>

      <div className="glass-panel flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="glass-search  pl-10"
            />
            </div>
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
          <div className="glass-panel grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
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
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${customer.status === "pending_approval" ? "bg-brand-light/70 hover:bg-brand-light" : ""}`}
              onClick={() => openCustomerDialog(customer)}
            >
              <TableCell>{customer.name}</TableCell>
              <TableCell>{customer.phone}</TableCell>
              <TableCell>{customer.area || "-"}</TableCell>
              <TableCell>LKR {Number(customer.balance).toLocaleString()}</TableCell>
              <TableCell>
                {(() => {
                  const badge = getCustomerStatusBadge(customer.status);
                  return <Badge variant={badge.variant}>{badge.label}</Badge>;
                })()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPage((prev) => prev - 1)}
          aria-label="Previous page"
          disabled={page <= 1 || customersQuery.isLoading}
          className="h-9 w-9 rounded-full p-0 bg-white/80 text-muted-foreground shadow-sm backdrop-blur-sm hover:border-brand hover:text-brand"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span>{`Rows ${startRow} - ${endRow} of ${total}`}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPage((prev) => prev + 1)}
          aria-label="Next page"
          disabled={page >= totalPages || customersQuery.isLoading}
          className="h-9 w-9 rounded-full p-0 bg-white/80 text-muted-foreground shadow-sm backdrop-blur-sm hover:border-brand hover:text-brand"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Dialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        title="Add customer"
        description="Admins and managers create customers immediately. Sales reps submit a request for review."
        maxWidthClassName="max-w-3xl"
        stickyHeader
        showBottomClose={false}
      >
        <form className="space-y-4" onSubmit={handleAddCustomer}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="add-customer-name" className="text-sm font-medium">Name</label>
              <Input
                id="add-customer-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="add-customer-phone" className="text-sm font-medium">Phone</label>
              <Input
                id="add-customer-phone"
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label htmlFor="add-customer-address" className="text-sm font-medium">Address</label>
              <Input
                id="add-customer-address"
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="add-customer-area" className="text-sm font-medium">Area</label>
              <SearchableSelect
                id="add-customer-area"
                placeholder={areasQuery.isLoading ? "Loading areas..." : "Select Area"}
                options={(areasQuery.data || []).map((area) => ({ value: area.name, label: area.name }))}
                value={form.area || ""}
                onChange={(value) => setForm((prev) => ({ ...prev, area: value }))}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="add-customer-credit-limit" className="text-sm font-medium">Credit Limit</label>
              <Input
                id="add-customer-credit-limit"
                type="number"
                min={0}
                step="0.01"
                placeholder="Blank for unlimited"
                value={form.credit_limit}
                onChange={(event) => setForm((prev) => ({ ...prev, credit_limit: event.target.value }))}
              />
            </div>
            {isAdminOrManager ? (
              <div className="space-y-1 md:col-span-2">
                <label htmlFor="add-customer-sales-rep" className="text-sm font-medium">Sales Rep</label>
                <SearchableSelect
                  id="add-customer-sales-rep"
                  placeholder="Select Sales Rep"
                  options={(salesRepsQuery.data || []).map((rep) => ({ value: rep.id, label: rep.full_name }))}
                  value={form.sales_rep_id}
                  onChange={(value) => setForm((prev) => ({ ...prev, sales_rep_id: value }))}
                />
              </div>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            <CirclePlus className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving changes..." : "Add Customer"}
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
            <Save className="mr-2 h-4 w-4" />
            {isAreaSubmitting ? "Saving..." : "Save Area"}
          </Button>
        </form>
      </Dialog>
    </section>
  );
}
