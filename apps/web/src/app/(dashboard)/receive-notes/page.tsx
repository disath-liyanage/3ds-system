"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";

const rows = [
  { id: "rn1", rn_number: 9001, supplier: "Asian Paints", received_at: "2026-04-18" },
  { id: "rn2", rn_number: 9002, supplier: "Nippon Coatings", received_at: "2026-04-17" }
];

export default function ReceiveNotesPage() {
  const { permissions, isLoading } = useCurrentUserPermissions();
  const canManageReceiveNotes = permissions?.canManageReceiveNotes ?? false;

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
            <TableHead>Supplier</TableHead>
            <TableHead>Received At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.rn_number}</TableCell>
              <TableCell>{row.supplier}</TableCell>
              <TableCell>{row.received_at}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}