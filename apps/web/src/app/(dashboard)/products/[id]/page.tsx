"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProducts } from "@/hooks/useProducts";
import { useProductStockByPrice } from "@/hooks/useProductStockByPrice";

function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrencyLKR(value: number | string) {
  const amount = toNumber(value);
  return `LKR ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatQuantity(value: number | string) {
  const quantity = toNumber(value);
  return Number.isInteger(quantity) ? quantity.toString() : quantity.toFixed(2);
}

function getStockStatus(stockQty: number | string, lowStockThreshold: number | string) {
  const stock = toNumber(stockQty);
  const threshold = toNumber(lowStockThreshold);

  if (stock <= 0) {
    return { label: "Out of Stock", variant: "danger" as const };
  }

  if (stock <= threshold) {
    return { label: "Low Stock", variant: "warning" as const };
  }

  return { label: "In Stock", variant: "success" as const };
}

export default function ProductStockDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { data: products, isLoading: isProductsLoading } = useProducts();
  const {
    data: stockByPrice,
    isLoading: isStockLoading,
    isError: isStockError
  } = useProductStockByPrice(productId);

  const product = useMemo(
    () => (products ?? []).find((item) => item.id === productId) ?? null,
    [products, productId]
  );

  const stockStatus = product ? getStockStatus(product.stock_qty, product.low_stock_threshold) : null;

  const isLoading = isProductsLoading || isStockLoading;

  if (!productId) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Product stock</h1>
        <p className="text-sm text-muted-foreground">Missing product id.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Product stock</h1>
          <p className="text-sm text-muted-foreground">Track price-level inventory for a single product.</p>
        </div>
        <div className="flex gap-2">
          {product && (
            <Button
              variant="default"
              onClick={() => {
                localStorage.setItem("open_edit_product_id", product.id);
                router.push("/products");
              }}
            >
              Edit product
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/products">Back to products</Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-md border border-border bg-white p-4 text-sm text-muted-foreground">
          Loading product...
        </div>
      ) : product ? (
        <Card>
          <CardHeader>
            <CardTitle>{product.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Category:</span>
              <span>{product.category}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Unit:</span>
              <span>{product.unit}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Total stock:</span>
              <span>{formatQuantity(product.stock_qty)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Status:</span>
              {stockStatus ? (
                <Badge variant={stockStatus.variant}>{stockStatus.label}</Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border border-border bg-white p-4 text-sm text-muted-foreground">
          Product not found.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Stock by selling price</CardTitle>
        </CardHeader>
        <CardContent>
          {isStockError ? (
            <p className="text-sm text-red-600">Failed to load price-level stock.</p>
          ) : stockByPrice && stockByPrice.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Selling Price</TableHead>
                  <TableHead>Received Qty</TableHead>
                  <TableHead>Free Qty</TableHead>
                  <TableHead>Total Qty</TableHead>
                  <TableHead>Last Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockByPrice.map((row) => (
                  <TableRow key={`${row.selling_price}`}>
                    <TableCell>{formatCurrencyLKR(row.selling_price)}</TableCell>
                    <TableCell>{formatQuantity(row.received_qty)}</TableCell>
                    <TableCell>{formatQuantity(row.free_qty)}</TableCell>
                    <TableCell className="font-medium">{formatQuantity(row.total_qty)}</TableCell>
                    <TableCell>
                      {row.last_received_at ? new Date(row.last_received_at).toLocaleDateString() : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No GRN stock entries yet.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
