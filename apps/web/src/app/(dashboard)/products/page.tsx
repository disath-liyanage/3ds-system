"use client";

import type { FormEvent } from "react";
import type { Product } from "@paintdist/shared";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useProducts } from "@/hooks/useProducts";
import { toast } from "@/lib/toast";

type ProductFormState = {
  name: string;
  category: string;
  unit: string;
  price: string;
  stock_qty: string;
  low_stock_threshold: string;
};

type ProductFormPayload = {
  name: string;
  category: string;
  unit: string;
  price: number;
  stock_qty: number;
  low_stock_threshold: number;
};

type ParseNumberResult =
  | {
      ok: true;
      value: number;
    }
  | {
      ok: false;
      error: string;
    };

type ProductFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  product: Product | null;
  onSubmit: (payload: ProductFormPayload, productId?: string) => Promise<{ success: boolean; error?: string }>;
};

const initialProductFormState: ProductFormState = {
  name: "",
  category: "",
  unit: "",
  price: "",
  stock_qty: "",
  low_stock_threshold: "10"
};

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

function parseNonNegativeNumber(
  value: string,
  label: string
): ParseNumberResult {
  if (!value.trim()) {
    return { ok: false, error: `${label} is required` };
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { ok: false, error: `${label} must be a valid number` };
  }

  if (parsed < 0) {
    return { ok: false, error: `${label} cannot be negative` };
  }

  return { ok: true, value: parsed };
}

function toProductFormState(product: Product): ProductFormState {
  return {
    name: product.name,
    category: product.category,
    unit: product.unit,
    price: toNumber(product.price).toString(),
    stock_qty: toNumber(product.stock_qty).toString(),
    low_stock_threshold: toNumber(product.low_stock_threshold).toString()
  };
}

function ProductFormDialog({ open, onOpenChange, mode, product, onSubmit }: ProductFormDialogProps) {
  const [form, setForm] = useState<ProductFormState>(initialProductFormState);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && product) {
      setForm(toProductFormState(product));
    } else {
      setForm(initialProductFormState);
    }

    setSubmitError(null);
    setIsSubmitting(false);
  }, [mode, open, product]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      setSubmitError(null);
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (mode === "edit" && !product) {
      setSubmitError("No product selected");
      return;
    }

    const name = form.name.trim();
    const category = form.category.trim();
    const unit = form.unit.trim();

    if (!name) {
      setSubmitError("Name is required");
      return;
    }

    if (!category) {
      setSubmitError("Category is required");
      return;
    }

    if (!unit) {
      setSubmitError("Unit is required");
      return;
    }

    const priceResult = parseNonNegativeNumber(form.price, "Price");
    if (!priceResult.ok) {
      setSubmitError(priceResult.error);
      return;
    }

    const stockResult = parseNonNegativeNumber(form.stock_qty, "Stock quantity");
    if (!stockResult.ok) {
      setSubmitError(stockResult.error);
      return;
    }

    const thresholdResult = parseNonNegativeNumber(form.low_stock_threshold, "Low stock threshold");
    if (!thresholdResult.ok) {
      setSubmitError(thresholdResult.error);
      return;
    }

    const payload: ProductFormPayload = {
      name,
      category,
      unit,
      price: priceResult.value,
      stock_qty: stockResult.value,
      low_stock_threshold: thresholdResult.value
    };

    setSubmitError(null);
    setIsSubmitting(true);

    const result = await onSubmit(payload, product?.id);

    if (!result.success) {
      setSubmitError(result.error || `Failed to ${mode === "create" ? "add" : "update"} product`);
      setIsSubmitting(false);
      return;
    }

    handleOpenChange(false);
  };

  const isEditMode = mode === "edit";

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={isEditMode ? "Edit product" : "Add product"}
      description={
        isEditMode
          ? "Update product details, pricing, and stock thresholds."
          : "Add a new product with pricing and stock details."
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label htmlFor={`${mode}-product-name`} className="text-sm font-medium">
            Name
          </label>
          <Input
            id={`${mode}-product-name`}
            required
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="e.g. QuickDry Enamel"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor={`${mode}-product-category`} className="text-sm font-medium">
            Category
          </label>
          <Input
            id={`${mode}-product-category`}
            required
            value={form.category}
            onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
            placeholder="e.g. Paints"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor={`${mode}-product-unit`} className="text-sm font-medium">
            Unit
          </label>
          <Input
            id={`${mode}-product-unit`}
            required
            value={form.unit}
            onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))}
            placeholder="e.g. can, litre, kg"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor={`${mode}-product-price`} className="text-sm font-medium">
            Price in LKR
          </label>
          <Input
            id={`${mode}-product-price`}
            required
            type="number"
            min={0}
            step="0.01"
            value={form.price}
            onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor={`${mode}-product-stock`} className="text-sm font-medium">
            Stock Quantity
          </label>
          <Input
            id={`${mode}-product-stock`}
            required
            type="number"
            min={0}
            step="0.01"
            value={form.stock_qty}
            onChange={(event) => setForm((prev) => ({ ...prev, stock_qty: event.target.value }))}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor={`${mode}-product-threshold`} className="text-sm font-medium">
            Low Stock Threshold
          </label>
          <Input
            id={`${mode}-product-threshold`}
            required
            type="number"
            min={0}
            step="1"
            value={form.low_stock_threshold}
            onChange={(event) => setForm((prev) => ({ ...prev, low_stock_threshold: event.target.value }))}
          />
        </div>

        {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (isEditMode ? "Saving changes..." : "Adding product...") : isEditMode ? "Save changes" : "Add product"}
        </Button>
      </form>
    </Dialog>
  );
}

export default function ProductsPage() {
  const { permissions, isLoading: isPermissionsLoading } = useCurrentUserPermissions();
  const { data: products = [], error, isLoading: isProductsLoading, createProduct, updateProduct } = useProducts();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const canManageProducts = permissions?.canManageProducts ?? false;
  const canAddProducts = canManageProducts;

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [products]
  );

  const handleCreateProduct = async (payload: ProductFormPayload) => {
    try {
      await createProduct.mutateAsync(payload);

      toast({
        title: "Product added",
        description: `${payload.name} was added successfully.`,
        variant: "success"
      });

      return { success: true };
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : "Failed to add product";

      toast({
        title: "Create failed",
        description: message,
        variant: "error"
      });

      return { success: false, error: message };
    }
  };

  const handleUpdateProduct = async (payload: ProductFormPayload, productId?: string) => {
    if (!productId) {
      return { success: false, error: "Product id is required" };
    }

    try {
      await updateProduct.mutateAsync({ id: productId, payload });

      toast({
        title: "Product updated",
        description: `${payload.name} was updated successfully.`,
        variant: "success"
      });

      return { success: true };
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : "Failed to update product";

      toast({
        title: "Update failed",
        description: message,
        variant: "error"
      });

      return { success: false, error: message };
    }
  };

  const handleEditDialogChange = (open: boolean) => {
    setIsEditDialogOpen(open);
    if (!open) {
      setEditingProduct(null);
    }
  };

  const isLoading = isPermissionsLoading || isProductsLoading;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Products</h1>
            {canAddProducts ? <Button onClick={() => setIsAddDialogOpen(true)}>Add Product</Button> : null}
          </div>
          <p className="text-sm text-muted-foreground">Track inventory levels and pricing in real time.</p>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">Failed to load products: {error.message}</p> : null}

      {isLoading ? (
        <div className="rounded-md border border-border bg-white p-4 text-sm text-muted-foreground">Loading products...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Price (LKR)</TableHead>
              <TableHead>Stock Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              sortedProducts.map((product) => {
                const stockStatus = getStockStatus(product.stock_qty, product.low_stock_threshold);

                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>{product.unit}</TableCell>
                    <TableCell>{formatCurrencyLKR(product.price)}</TableCell>
                    <TableCell>{formatQuantity(product.stock_qty)}</TableCell>
                    <TableCell>
                      <Badge variant={stockStatus.variant}>{stockStatus.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {canManageProducts ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updateProduct.isPending}
                          onClick={() => {
                            setEditingProduct(product);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      )}

      <ProductFormDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        mode="create"
        product={null}
        onSubmit={handleCreateProduct}
      />

      <ProductFormDialog
        open={isEditDialogOpen}
        onOpenChange={handleEditDialogChange}
        mode="edit"
        product={editingProduct}
        onSubmit={handleUpdateProduct}
      />
    </section>
  );
}
