"use client";

import { type FormEvent, useMemo, useState } from "react";

import { createUser } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "@/lib/toast";

import type { CustomRoleSelectOption, UserRoleOption } from "./types";

type AddUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customRoles: CustomRoleSelectOption[];
  onCreated: () => void;
};

type AddUserFormState = {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  role: UserRoleOption;
  custom_role_id: string;
};

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Cashier" },
  { value: "sales_rep", label: "Sales Representative" },
  { value: "custom", label: "Custom" }
] as const;

const initialState: AddUserFormState = {
  full_name: "",
  email: "",
  password: "",
  phone: "",
  role: "sales_rep",
  custom_role_id: ""
};

export function AddUserDialog({ open, onOpenChange, customRoles, onCreated }: AddUserDialogProps) {
  const [form, setForm] = useState<AddUserFormState>(initialState);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const customRoleOptions = useMemo(
    () => customRoles.map((role) => ({ value: role.id, label: role.name })),
    [customRoles]
  );

  const resetForm = () => {
    setForm(initialState);
    setSubmitError(null);
    setIsSubmitting(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) resetForm();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    const result = await createUser({
      full_name: form.full_name,
      email: form.email,
      password: form.password,
      phone: form.phone,
      role: form.role,
      custom_role_id: form.role === "custom" ? form.custom_role_id : undefined
    });

    if (!result.success) {
      setSubmitError(result.error || "Failed to create user");
      setIsSubmitting(false);
      return;
    }

    toast({
      title: "User created",
      description: `${form.full_name} was added successfully.`,
      variant: "success"
    });

    onCreated();
    handleOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Add user"
      description="Create a new user and assign a system role."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label htmlFor="add-user-full-name" className="text-sm font-medium">
            Full Name
          </label>
          <Input
            id="add-user-full-name"
            required
            value={form.full_name}
            onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
            placeholder="e.g. Nimal Perera"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="add-user-email" className="text-sm font-medium">
            Email / Username
          </label>
          <Input
            id="add-user-email"
            required
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            placeholder="user@company.com"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="add-user-password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="add-user-password"
            required
            type="password"
            minLength={6}
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            placeholder="At least 6 characters"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="add-user-phone" className="text-sm font-medium">
            Phone
          </label>
          <Input
            id="add-user-phone"
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            placeholder="Optional"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="add-user-role" className="text-sm font-medium">
            Role
          </label>
          <SearchableSelect
            id="add-user-role"
            value={form.role}
            placeholder="Select role"
            options={roleOptions.map((option) => ({ value: option.value, label: option.label }))}
            onChange={(value) => {
              const nextRole = value as AddUserFormState["role"];
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
            <label htmlFor="add-user-custom-role" className="text-sm font-medium">
              Custom Role
            </label>
            <SearchableSelect
              id="add-user-custom-role"
              required
              value={form.custom_role_id}
              placeholder="Select custom role"
              options={customRoleOptions}
              onChange={(value) => setForm((prev) => ({ ...prev, custom_role_id: value }))}
            />
          </div>
        ) : null}

        {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating user..." : "Create user"}
        </Button>
      </form>
    </Dialog>
  );
}
