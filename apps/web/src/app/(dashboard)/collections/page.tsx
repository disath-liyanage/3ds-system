import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const rows = [
  { id: "c1", collection_number: 3001, customer: "City Paint Mart", amount: "LKR 30,000", status: "pending" },
  { id: "c2", collection_number: 3002, customer: "Kandy Hardware", amount: "LKR 12,500", status: "validated" }
];

export default function CollectionsPage() {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Collections</h1>
          <p className="text-sm text-muted-foreground">Monitor pending and validated collections.</p>
        </div>
        <Button asChild>
          <Link href="/collections/new">Record Collection</Link>
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Collection #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.collection_number}</TableCell>
              <TableCell>{row.customer}</TableCell>
              <TableCell>{row.amount}</TableCell>
              <TableCell>
                <Badge variant={row.status === "validated" ? "success" : "warning"}>{row.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}