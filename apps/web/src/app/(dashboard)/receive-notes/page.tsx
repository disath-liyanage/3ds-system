"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useReceiveNotes } from "@/hooks/useReceiveNotes";
import { toast } from "@/lib/toast";

export default function ReceiveNotesPage() {
  const { permissions, isLoading } = useCurrentUserPermissions();
  const canManageReceiveNotes = permissions?.canManageReceiveNotes ?? false;
  const { data: receiveNotes, isLoading: isReceiveNotesLoading, deleteReceiveNote } = useReceiveNotes();

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("Delete this GRN? This cannot be undone.");
    if (!confirmed) return;

    try {
      await deleteReceiveNote.mutateAsync(id);
      toast({ title: "GRN deleted", variant: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete GRN";
      toast({ title: "Delete failed", description: message, variant: "error" });
    }
  };

  if (!isLoading && !canManageReceiveNotes) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">GRN</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to access GRN.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">GRN</h1>
          <p className="text-sm text-muted-foreground">GRN log from suppliers.</p>
        </div>
        {canManageReceiveNotes ? (
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/suppliers">View Suppliers</Link>
            </Button>
            <Button asChild>
              <Link href="/receive-notes/new">New GRN</Link>
            </Button>
          </div>
        ) : null}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>GRN #</TableHead>
            <TableHead>Invoice #</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Received At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isReceiveNotesLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-sm text-muted-foreground">
                Loading GRNs...
              </TableCell>
            </TableRow>
          ) : (receiveNotes ?? []).length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-sm text-muted-foreground">
                No GRNs recorded yet.
              </TableCell>
            </TableRow>
          ) : (
            (receiveNotes ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.rn_number}</TableCell>
                <TableCell>{row.invoice_number}</TableCell>
                <TableCell>{row.supplier_name}</TableCell>
                <TableCell>{new Date(row.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/receive-notes/${row.id}`}>Edit</Link>
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(row.id)}
                      disabled={deleteReceiveNote.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </section>
  );
}