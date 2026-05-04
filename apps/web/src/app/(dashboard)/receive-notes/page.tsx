"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useReceiveNotes } from "@/hooks/useReceiveNotes";
import { toast } from "@/lib/toast";

import { useRouter } from "next/navigation";

export default function ReceiveNotesPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { permissions, isLoading } = useCurrentUserPermissions();
  const canManageReceiveNotes = permissions?.canManageReceiveNotes ?? false;
  const canViewReceiveNotes = permissions?.canViewReceiveNotes ?? false;
  const { data: receiveNotes, isLoading: isReceiveNotesLoading } = useReceiveNotes();

  const filtered = useMemo(() => {
    const list = receiveNotes ?? [];
    if (!query) return list;
    const q = query.toLowerCase();
    return list.filter((row) =>
      `${row.rn_number} ${row.invoice_number} ${row.supplier_name}`.toLowerCase().includes(q)
    );
  }, [receiveNotes, query]);

  if (!isLoading && !canViewReceiveNotes) {
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

      <div className="max-w-sm">
        <Input placeholder="Search GRNs..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>GRN #</TableHead>
            <TableHead>Invoice #</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Received At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isReceiveNotesLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="text-sm text-muted-foreground">
                Loading GRNs...
              </TableCell>
            </TableRow>
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-sm text-muted-foreground">
                No GRNs found.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((row) => (
              <TableRow 
                key={row.id}
                className="cursor-pointer transition hover:bg-muted/50"
                onClick={() => router.push(`/receive-notes/${row.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(`/receive-notes/${row.id}`);
                  }
                }}
                tabIndex={0}
              >
                <TableCell>{row.rn_number}</TableCell>
                <TableCell>{row.invoice_number}</TableCell>
                <TableCell>{row.supplier_name}</TableCell>
                <TableCell>{new Date(row.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </section>
  );
}