"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import { updateUser } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/toast";

import type { AdminUserRow, CustomRoleSelectOption, UserRoleOption } from "./types";

type EditUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUserRow | null;
  customRoles: CustomRoleSelectOption[];
  onUpdated: () => void;
};

type EditUserFormState = {
  full_name: string;
  phone: string;
  role: UserRoleOption;
  custom_role_id: string;
  is_active: boolean;
};

const baseRoleOptions = [
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Cashier" },
  { value: "sales_rep", label: "Sales Representative" },
  { value: "custom", label: "Custom" }
] as const;

const initialState: EditUserFormState = {
  full_name: "",
  phone: "",
  role: "manager",
  custom_role_id: "",
  is_active: true
};

export function EditUserDialog({ open, onOpenChange, user, customRoles, onUpdated }: EditUserDialogProps) {
  const [form, setForm] = useState<EditUserFormState>(initialState);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !open) return;

    setForm({
      full_name: user.full_name,
      phone: user.phone || "",
      role: user.role,
      custom_role_id: user.custom_role_id || "",
      is_active: user.is_active
    });
    setSubmitError(null);
  }, [open, user]);

  const roleOptions = useMemo(() => {
    const options = baseRoleOptions.map((option) => ({
      value: option.value,
      label: option.label
    }));

    if (user?.role === "admin") {
      return [{ value: "admin", label: "Admin" }, ...options];
    }

    return options;
  }, [user?.role]);

  const customRoleOptions = useMemo(
    () => customRoles.map((role) => ({ value: role.id, label: role.name })),
    [customRoles]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      setSubmitError("No user selected");
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    const result = await updateUser(user.id, {
      full_name: form.full_name,
      phone: form.phone,
      role: form.role,
      custom_role_id: form.role === "custom" ? form.custom_role_id : undefined,
      is_active: form.is_active
    });

    if (!result.success) {
      setSubmitError(result.error || "Failed to update user");
      setIsSubmitting(false);
      return;
    }

    toast({
      title: "User updated",
      description: `${form.full_name} was updated successfully.`,
      variant: "success"
    });

    setIsSubmitting(false);
    onUpdated();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit user"
      description="Update profile details, role assignment, and account status."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label htmlFor="edit-user-full-name" className="text-sm font-medium">
            Full Name
          </label>
          <Input
            id="edit-user-full-name"
            required
            value={form.full_name}
            onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="edit-user-email" className="text-sm font-medium">
            Email
          </label>
          <Input id="edit-user-email" value={user?.email || ""} disabled />
        </div>

        <div className="space-y-1">
          <label htmlFor="edit-user-phone" className="text-sm font-medium">
            Phone
          </label>
          <Input
            id="edit-user-phone"
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            placeholder="Optional"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="edit-user-role" className="text-sm font-medium">
            Role
          </label>
          <Select
            id="edit-user-role"
            value={form.role}
            options={roleOptions}
            onChange={(event) => {
              const nextRole = event.target.value as UserRoleOption;
              setForm((prev) => ({
                ...prev,
                role: nextRole,
                custom_role_id: nextRole === "custom" ? prev.custom_role_id : ""
              }));
            }}
          />
        </div>

        {form.role === "custom" ? (
          <div className="space-y-1">
            <label htmlFor="edit-user-custom-role" className="text-sm font-medium">
              Custom Role
            </label>
            <Select
              id="edit-user-custom-role"
              required
              value={form.custom_role_id}
              placeholder="Select custom role"
              options={customRoleOptions}
              onChange={(event) => setForm((prev) => ({ ...prev, custom_role_id: event.target.value }))}
            />
          </div>
        ) : null}

        <div className="space-y-1">
          <label htmlFor="edit-user-status" className="text-sm font-medium">
            Status
          </label>
          <Select
            id="edit-user-status"
            value={form.is_active ? "active" : "inactive"}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" }
            ]}
            onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.value === "active" }))}
          />
        </div>

        {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Saving changes..." : "Save changes"}
        </Button>
      </form>
    </Dialog>
  );
}
