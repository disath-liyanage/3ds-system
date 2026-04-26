"use client";

import type { CustomRole, User } from "@paintdist/shared";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { deleteCustomRole } from "@/app/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "@/lib/toast";

import { CreateRoleDialog } from "./CreateRoleDialog";
import { extractEnabledPermissionLabels } from "./permissions";

type RolesManagementClientProps = {
  roles: CustomRole[];
  currentUser: User;
};

export function RolesManagementClient({ roles, currentUser }: RolesManagementClientProps) {
  const router = useRouter();
  const [rows, setRows] = useState(roles);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [processingRoleId, setProcessingRoleId] = useState<string | null>(null);

  useEffect(() => {
    setRows(roles);
  }, [roles]);

  const permissions = usePermissions(currentUser);

  const sortedRoles = useMemo(
    () => [...rows].sort((a, b) => a.name.localeCompare(b.name)),
    [rows]
  );

  const handleRefresh = () => {
    router.refresh();
  };

  const handleDelete = async (role: CustomRole) => {
    if (!permissions.canManageUsers) return;

    const confirmed = window.confirm(`Delete ${role.name}? This action cannot be undone.`);
    if (!confirmed) return;

    setProcessingRoleId(role.id);
    const result = await deleteCustomRole(role.id);

    if (!result.success) {
      toast({ title: "Delete failed", description: result.error || "Could not delete role", variant: "error" });
      setProcessingRoleId(null);
      return;
    }

    toast({ title: "Role deleted", description: `${role.name} was removed.`, variant: "success" });
    setProcessingRoleId(null);
    handleRefresh();
  };

  if (!permissions.canManageUsers) {
    return (
      <div className="rounded-lg border border-border bg-white p-4 text-sm text-muted-foreground">
        You do not have permission to manage custom roles.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Custom Roles</h1>
          <p className="text-sm text-muted-foreground">Build role templates with explicit permission flags.</p>
        </div>
        <Button
          onClick={() => {
            setEditingRole(null);
            setIsDialogOpen(true);
          }}
        >
          New Role
        </Button>
      </div>

      {sortedRoles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">
          No custom roles yet. Create one to assign granular permissions.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedRoles.map((role) => {
            const isProcessing = processingRoleId === role.id;
            const permissionLabels = extractEnabledPermissionLabels(role);

            return (
              <Card key={role.id}>
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{role.name}</CardTitle>
                    <Badge className="bg-slate-200 text-slate-700">Custom</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{role.description || "No description provided."}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {permissionLabels.length > 0 ? (
                      permissionLabels.map((label) => (
                        <Badge key={label} variant="muted">
                          {label}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="warning">No permissions selected</Badge>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isProcessing}
                      onClick={() => {
                        setEditingRole(role);
                        setIsDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" disabled={isProcessing} onClick={() => handleDelete(role)}>
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateRoleDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingRole(null);
        }}
        initialRole={editingRole}
        onSaved={handleRefresh}
      />
    </section>
  );
}
