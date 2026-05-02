"use client";

import { type FormEvent, useState } from "react";

import { createSupplier } from "@/app/actions/suppliers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { toast } from "@/lib/toast";

export default function NewSupplierPage() {
  const { permissions, isLoading } = useCurrentUserPermissions();
  const canManageReceiveNotes = permissions?.canManageReceiveNotes ?? false;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: ""
  });

  if (!isLoading && !canManageReceiveNotes) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Add Supplier</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to add suppliers.</p>
      </section>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    const result = await createSupplier({
      name: form.name,
      address: form.address,
      phone: form.phone
    });
    setIsSubmitting(false);

    if (!result.success) {
      toast({ title: "Failed to add supplier", description: result.error, variant: "error" });
      return;
    }

    toast({ title: "Supplier added", description: result.message, variant: "success" });
    setForm({ name: "", address: "", phone: "" });
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Add Supplier</h1>
        <p className="text-sm text-muted-foreground">Add a supplier to use in GRN entries.</p>
      </header>

      <form className="max-w-xl space-y-4" onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Supplier details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
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
          </CardContent>
        </Card>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Add Supplier"}
        </Button>
      </form>
    </section>
  );
}
