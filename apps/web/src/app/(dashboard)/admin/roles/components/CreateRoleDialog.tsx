"use client";

import type { CustomRole } from "@paintdist/shared";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { createCustomRole, updateCustomRole } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";

import { defaultPermissions, permissionGroups, type PermissionKey } from "./permissions";

type RoleFormState = {
  name: string;
  description: string;
  permissions: Record<PermissionKey, boolean>;
};

type CreateRoleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  initialRole?: CustomRole | null;
};

const initialState: RoleFormState = {
  name: "",
  description: "",
  permissions: defaultPermissions
};

function mapRoleToState(role: CustomRole): RoleFormState {
  return {
    name: role.name,
    description: role.description || "",
    permissions: {
      perm_create_orders: role.perm_create_orders,
      perm_approve_orders: role.perm_approve_orders,
      perm_view_all_orders: role.perm_view_all_orders,
      perm_record_collections: role.perm_record_collections,
      perm_validate_collections: role.perm_validate_collections,
      perm_manage_products: role.perm_manage_products,
      perm_manage_customers: role.perm_manage_customers,
      perm_create_invoices: role.perm_create_invoices,
      perm_manage_receive_notes: role.perm_manage_receive_notes,
      perm_view_reports: role.perm_view_reports,
      perm_export_reports: role.perm_export_reports,
      perm_manage_users: role.perm_manage_users,
      perm_view_users: role.perm_view_users
    }
  };
}

export function CreateRoleDialog({ open, onOpenChange, onSaved, initialRole }: CreateRoleDialogProps) {
  const isEditMode = Boolean(initialRole);
  const [form, setForm] = useState<RoleFormState>(initialState);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (initialRole) {
      setForm(mapRoleToState(initialRole));
      setSubmitError(null);
      return;
    }

    setForm(initialState);
    setSubmitError(null);
  }, [initialRole, open]);

  const selectedCount = useMemo(
    () => Object.values(form.permissions).filter(Boolean).length,
    [form.permissions]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    const payload = {
      name: form.name,
      description: form.description,
      ...form.permissions
    };

    const result = initialRole
      ? await updateCustomRole(initialRole.id, payload)
      : await createCustomRole(payload);

    if (!result.success) {
      setSubmitError(result.error || "Failed to save role");
      setIsSubmitting(false);
      return;
    }

    toast({
      title: isEditMode ? "Role updated" : "Role created",
      description: `${form.name} saved successfully.`,
      variant: "success"
    });

    setIsSubmitting(false);
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditMode ? "Edit custom role" : "Create custom role"}
      description="Define the role and select exactly which capabilities it should have."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label htmlFor="custom-role-name" className="text-sm font-medium">
            Role Name
          </label>
          <Input
            id="custom-role-name"
            required
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="e.g. Credit Controller"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="custom-role-description" className="text-sm font-medium">
            Description
          </label>
          <textarea
            id="custom-role-description"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            rows={3}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-primary/40"
            placeholder="Optional"
          />
        </div>

        <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Permissions</p>
            <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
          </div>

          <div className="grid gap-4">
            {permissionGroups.map((group) => (
              <div key={group.title} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {group.items.map((item) => (
                    <label key={item.key} className="flex items-center gap-2 rounded border border-border bg-white px-2 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={form.permissions[item.key]}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            permissions: {
                              ...prev.permissions,
                              [item.key]: event.target.checked
                            }
                          }))
                        }
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Saving role..." : isEditMode ? "Save changes" : "Create role"}
        </Button>
      </form>
    </Dialog>
  );
}
