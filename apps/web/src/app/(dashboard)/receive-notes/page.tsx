import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const rows = [
  { id: "rn1", rn_number: 9001, supplier: "Asian Paints", received_at: "2026-04-18" },
  { id: "rn2", rn_number: 9002, supplier: "Nippon Coatings", received_at: "2026-04-17" }
];

export default function ReceiveNotesPage() {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Receive Notes</h1>
          <p className="text-sm text-muted-foreground">Stock intake log from suppliers.</p>
        </div>
        <Button asChild>
          <Link href="/receive-notes/new">New Receive Note</Link>
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>RN #</TableHead>
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