import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const rows = [
  { id: "p1", name: "WeatherGuard", stock_qty: 8, threshold: 10, unit: "bucket" },
  { id: "p2", name: "QuickDry Enamel", stock_qty: 25, threshold: 10, unit: "tin" },
  { id: "p3", name: "Wall Sealer", stock_qty: 6, threshold: 8, unit: "can" }
];

export default function ProductsPage() {
  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Products</h1>
        <p className="text-sm text-muted-foreground">Monitor pricing and stock thresholds.</p>
      </header>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Level</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isLow = row.stock_qty <= row.threshold;
            return (
              <TableRow key={row.id}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.stock_qty}</TableCell>
                <TableCell>{row.unit}</TableCell>
                <TableCell>
                  <Badge variant={isLow ? "danger" : "success"}>{isLow ? "Low Stock" : "Healthy"}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}