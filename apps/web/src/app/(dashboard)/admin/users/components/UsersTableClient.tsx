"use client";

import type { User } from "@paintdist/shared";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { deleteUser, updateUser } from "@/app/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "@/lib/toast";

import { AddUserDialog } from "./AddUserDialog";
import { EditUserDialog } from "./EditUserDialog";
import type { AdminUserRow, CustomRoleSelectOption } from "./types";

type UsersTableClientProps = {
  users: AdminUserRow[];
  customRoles: CustomRoleSelectOption[];
  currentUser: User;
};

function getRoleBadgeMeta(user: AdminUserRow) {
  if (user.role === "admin") {
    return { label: "Admin", className: "bg-purple-100 text-purple-700" };
  }

  if (user.role === "manager") {
    return { label: "Manager", className: "bg-teal-100 text-teal-700" };
  }

  if (user.role === "cashier") {
    return { label: "Cashier", className: "bg-[#FFE7E1] text-[#D1654A]" };
  }

  if (user.role === "sales_rep") {
    return { label: "Sales Rep", className: "bg-blue-100 text-blue-700" };
  }

  return {
    label: user.custom_role?.name ? `Custom: ${user.custom_role.name}` : "Custom",
    className: "bg-slate-200 text-slate-700"
  };
}

export function UsersTableClient({ users, customRoles, currentUser }: UsersTableClientProps) {
  const router = useRouter();
  const [rows, setRows] = useState(users);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserRow | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  useEffect(() => {
    setRows(users);
  }, [users]);

  const permissions = usePermissions(currentUser);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [rows]
  );

  const handleRefresh = () => {
    router.refresh();
  };

  const handleToggleActive = async (user: AdminUserRow) => {
    if (!permissions.canManageUsers) return;

    setProcessingUserId(user.id);

    const result = await updateUser(user.id, {
      full_name: user.full_name,
      phone: user.phone || "",
      role: user.role,
      custom_role_id: user.role === "custom" ? user.custom_role_id || undefined : undefined,
      is_active: !user.is_active
    });

    if (!result.success) {
      toast({ title: "Update failed", description: result.error || "Could not update user status", variant: "error" });
      setProcessingUserId(null);
      return;
    }

    toast({
      title: user.is_active ? "User deactivated" : "User activated",
      description: `${user.full_name} account status was updated.`,
      variant: "success"
    });

    setProcessingUserId(null);
    handleRefresh();
  };

  const handleDelete = async (user: AdminUserRow) => {
    if (!permissions.canManageUsers) return;

    const confirmed = window.confirm(`Delete ${user.full_name}? This action cannot be undone.`);
    if (!confirmed) return;

    setProcessingUserId(user.id);
    const result = await deleteUser(user.id);

    if (!result.success) {
      toast({ title: "Delete failed", description: result.error || "Could not delete user", variant: "error" });
      setProcessingUserId(null);
      return;
    }

    toast({ title: "User deleted", description: `${user.full_name} was removed.`, variant: "success" });
    setProcessingUserId(null);
    handleRefresh();
  };

  if (!permissions.canViewUsers) {
    return (
      <div className="rounded-lg border border-border bg-white p-4 text-sm text-muted-foreground">
        You do not have permission to view users.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground">Create users, assign roles, and control account access.</p>
        </div>
        {permissions.canManageUsers ? (
          <Button onClick={() => setIsAddDialogOpen(true)}>Add User</Button>
        ) : null}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((user) => {
            const roleMeta = getRoleBadgeMeta(user);
            const isProcessing = processingUserId === user.id;
            const isSelf = user.id === currentUser.id;

            return (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.full_name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge className={roleMeta.className}>{roleMeta.label}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.is_active ? "success" : "danger"}>
                    {user.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isProcessing || !permissions.canManageUsers}
                      onClick={() => {
                        setEditingUser(user);
                        setIsEditDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isProcessing || !permissions.canManageUsers}
                      onClick={() => handleToggleActive(user)}
                    >
                      {user.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={isProcessing || isSelf || !permissions.canManageUsers}
                      onClick={() => handleDelete(user)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AddUserDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        customRoles={customRoles}
        onCreated={handleRefresh}
      />

      <EditUserDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        user={editingUser}
        customRoles={customRoles}
        onUpdated={handleRefresh}
      />
    </section>
  );
}
