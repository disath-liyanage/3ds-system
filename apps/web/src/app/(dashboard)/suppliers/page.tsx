"use client";

import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useMemo, useState } from "react";

import { createSupplier, updateSupplier } from "@/app/actions/suppliers";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type SupplierRow = {
  id: string;
  name: string;
  phone: string;
  address: string;
  created_at: string;
};

const SUPPLIERS_QUERY_KEY = ["suppliers"] as const;

export default function SuppliersPage() {
  const { permissions, isLoading } = useCurrentUserPermissions();
  const canManageReceiveNotes = permissions?.canManageReceiveNotes ?? false;
  const supabase = useMemo(() => createClient(), []);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [editForm, setEditForm] = useState({ name: "", phone: "", address: "" });

  const suppliersQuery = useQuery({
    queryKey: SUPPLIERS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, phone, address, created_at")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data || []) as SupplierRow[];
    },
    enabled: canManageReceiveNotes
  });

  const selectedSupplier =
    (suppliersQuery.data || []).find((supplier) => supplier.id === selectedSupplierId) || null;

  if (!isLoading && !canManageReceiveNotes) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Suppliers</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to view suppliers.</p>
      </section>
    );
  }

  const handleAddSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    const result = await createSupplier({
      name: form.name,
      phone: form.phone,
      address: form.address
    });
    setIsSubmitting(false);

    if (!result.success) {
      toast({ title: "Failed to add supplier", description: result.error, variant: "error" });
      return;
    }

    toast({ title: "Supplier added", description: result.message, variant: "success" });
    setForm({ name: "", phone: "", address: "" });
    setIsAddOpen(false);
    await suppliersQuery.refetch();
  };

  const handleOpenEdit = (supplier: SupplierRow) => {
    setSelectedSupplierId(supplier.id);
    setEditForm({
      name: supplier.name,
      phone: supplier.phone,
      address: supplier.address
    });
  };

  const handleSaveSupplier = async () => {
    if (!selectedSupplierId || isUpdating) return;

    setIsUpdating(true);
    const result = await updateSupplier(selectedSupplierId, {
      name: editForm.name,
      phone: editForm.phone,
      address: editForm.address
    });
    setIsUpdating(false);

    if (!result.success) {
      toast({ title: "Update failed", description: result.error, variant: "error" });
      return;
    }

    toast({ title: "Supplier updated", description: result.message, variant: "success" });
    setSelectedSupplierId(null);
    await suppliersQuery.refetch();
  };

  return (
    <section className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Manage suppliers for GRN entries.</p>
        </div>
        {canManageReceiveNotes ? <Button onClick={() => setIsAddOpen(true)}>Add Supplier</Button> : null}
      </header>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(suppliersQuery.data || []).map((supplier) => (
            <TableRow key={supplier.id}>
              <TableCell>{supplier.name}</TableCell>
              <TableCell>{supplier.phone}</TableCell>
              <TableCell>{supplier.address}</TableCell>
              <TableCell>
                <Button size="sm" variant="outline" onClick={() => handleOpenEdit(supplier)}>
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        title="Add supplier"
        description="Add a supplier to use in GRN entries."
      >
        <form className="space-y-3" onSubmit={handleAddSupplier}>
          <Input
            placeholder="Supplier name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
          <Input
            placeholder="Phone number"
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
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Add Supplier"}
          </Button>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(selectedSupplierId)}
        onOpenChange={(open) => {
          if (!open) setSelectedSupplierId(null);
        }}
        title="Edit supplier"
        description={selectedSupplier ? `Editing ${selectedSupplier.name}` : ""}
      >
        {selectedSupplier ? (
          <div className="space-y-3">
            <Input
              placeholder="Supplier name"
              value={editForm.name}
              onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <Input
              placeholder="Phone number"
              value={editForm.phone}
              onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
              required
            />
            <Input
              placeholder="Address"
              value={editForm.address}
              onChange={(event) => setEditForm((prev) => ({ ...prev, address: event.target.value }))}
              required
            />
            <Button type="button" disabled={isUpdating} onClick={handleSaveSupplier}>
              {isUpdating ? "Saving..." : "Save changes"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Supplier not found.</p>
        )}
      </Dialog>
    </section>
  );
}
