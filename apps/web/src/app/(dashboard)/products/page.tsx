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

type ProductSizeFormState = {
  unit: string;
  price: string;
  stock_qty: string;
  low_stock_threshold: string;
};

type ExistingSizeFormState = ProductSizeFormState & {
  id: string;
  isRemoved?: boolean;
};

type ExistingSizeUpdate = {
  id: string;
  payload: ProductFormPayload;
};

type ExistingSizeDelete = {
  id: string;
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
  relatedProducts?: Product[];
  onSubmit: (
    payload: ProductFormPayload,
    productId?: string,
    extraSizes?: ProductFormPayload[],
    existingSizeEdits?: ExistingSizeUpdate[],
    existingSizeDeletes?: ExistingSizeDelete[]
  ) => Promise<{ success: boolean; error?: string }>;
  onDelete?: (productId: string) => Promise<{ success: boolean; error?: string }>;
};

const initialProductFormState: ProductFormState = {
  name: "",
  category: "",
  unit: "",
  price: "",
  stock_qty: "",
  low_stock_threshold: "10"
};

const initialProductSizeState: ProductSizeFormState = {
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

function normalizeProductName(value: string) {
  return value.trim().toLowerCase();
}

function normalizeUnit(value: string) {
  return value.trim().toLowerCase();
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

function ProductFormDialog({
  open,
  onOpenChange,
  mode,
  product,
  relatedProducts = [],
  onSubmit,
  onDelete
}: ProductFormDialogProps) {
  const [form, setForm] = useState<ProductFormState>(initialProductFormState);
  const [extraSizes, setExtraSizes] = useState<ProductSizeFormState[]>([]);
  const [existingSizes, setExistingSizes] = useState<ExistingSizeFormState[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const existingUnits = useMemo(() => {
    if (!existingSizes || existingSizes.length === 0) return [] as string[];
    return existingSizes
      .filter((item) => !item.isRemoved)
      .map((item) => item.unit)
      .filter((unit) => unit && unit.trim().length > 0)
      .map(normalizeUnit);
  }, [existingSizes]);

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && product) {
      setForm(toProductFormState(product));
    } else {
      setForm(initialProductFormState);
    }

    setExtraSizes([]);
    setExistingSizes(
      relatedProducts.map((item) => ({
        id: item.id,
        unit: item.unit,
        price: toNumber(item.price).toString(),
        stock_qty: toNumber(item.stock_qty).toString(),
        low_stock_threshold: toNumber(item.low_stock_threshold).toString(),
        isRemoved: false
      }))
    );
    setSubmitError(null);
    setIsSubmitting(false);
    setIsDeleteDialogOpen(false);
    setIsDeleting(false);
    setDeleteError(null);
  }, [mode, open, product, relatedProducts]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      setSubmitError(null);
      setIsSubmitting(false);
      setIsDeleteDialogOpen(false);
      setIsDeleting(false);
      setDeleteError(null);
    }
  };

  const handleDelete = async () => {
    if (!product || !onDelete) return;
    if (isDeleting) return;

    setIsDeleting(true);
    setDeleteError(null);

    const result = await onDelete(product.id);

    if (!result.success) {
      setDeleteError(result.error || "Failed to delete product");
      setIsDeleting(false);
      return;
    }

    setIsDeleteDialogOpen(false);
    handleOpenChange(false);
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

    const isMultiSizeEdit = isEditMode && existingSizes.filter((item) => !item.isRemoved).length > 1;

    if (!isMultiSizeEdit) {
      if (!unit) {
        setSubmitError("Unit is required");
        return;
      }
    }

    let payload: ProductFormPayload;

    if (isMultiSizeEdit) {
      const fallbackSize = existingSizes.find((item) => !item.isRemoved) || existingSizes[0];

      payload = {
        name,
        category,
        unit: fallbackSize?.unit ?? unit,
        price: toNumber(fallbackSize?.price ?? form.price),
        stock_qty: toNumber(fallbackSize?.stock_qty ?? form.stock_qty),
        low_stock_threshold: toNumber(fallbackSize?.low_stock_threshold ?? form.low_stock_threshold)
      };
    } else {
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

      payload = {
        name,
        category,
        unit,
        price: priceResult.value,
        stock_qty: stockResult.value,
        low_stock_threshold: thresholdResult.value
      };
    }

    let extraPayloads: ProductFormPayload[] | undefined;

    if (isEditMode && extraSizes.length > 0) {
      extraPayloads = [];
      const seenExtraUnits = new Set<string>();

      for (const [index, size] of extraSizes.entries()) {
        const extraUnit = size.unit.trim();
        const normalizedExtraUnit = normalizeUnit(extraUnit);

        if (!extraUnit) {
          setSubmitError(`Extra size ${index + 1}: Unit is required`);
          return;
        }

        if (existingUnits.includes(normalizedExtraUnit)) {
          setSubmitError(`Unit "${extraUnit}" already exists. Edit the existing unit instead.`);
          return;
        }

        if (seenExtraUnits.has(normalizedExtraUnit)) {
          setSubmitError(`Unit "${extraUnit}" is duplicated in the new sizes.`);
          return;
        }

        seenExtraUnits.add(normalizedExtraUnit);

        const extraPrice = parseNonNegativeNumber(size.price, `Extra size ${index + 1}: Price`);
        if (!extraPrice.ok) {
          setSubmitError(extraPrice.error);
          return;
        }

        const extraStock = parseNonNegativeNumber(size.stock_qty, `Extra size ${index + 1}: Stock quantity`);
        if (!extraStock.ok) {
          setSubmitError(extraStock.error);
          return;
        }

        const extraThreshold = parseNonNegativeNumber(
          size.low_stock_threshold,
          `Extra size ${index + 1}: Low stock threshold`
        );
        if (!extraThreshold.ok) {
          setSubmitError(extraThreshold.error);
          return;
        }

        extraPayloads.push({
          name,
          category,
          unit: extraUnit,
          price: extraPrice.value,
          stock_qty: extraStock.value,
          low_stock_threshold: extraThreshold.value
        });
      }
    }

    let existingSizeEdits: ExistingSizeUpdate[] | undefined;
    let existingSizeDeletes: ExistingSizeDelete[] | undefined;

    if (isEditMode && isMultiSizeEdit) {
      existingSizeEdits = [];
      existingSizeDeletes = [];

      const seenUnits = new Set<string>();

      for (const size of existingSizes) {
        const trimmedUnit = size.unit.trim();
        const normalizedUnit = normalizeUnit(trimmedUnit);

        if (size.isRemoved) {
          existingSizeDeletes.push({ id: size.id });
          continue;
        }

        if (!trimmedUnit) {
          setSubmitError("Unit is required");
          return;
        }

        if (seenUnits.has(normalizedUnit)) {
          setSubmitError(`Unit "${trimmedUnit}" is duplicated in the sizes.`);
          return;
        }

        seenUnits.add(normalizedUnit);

        const priceResult = parseNonNegativeNumber(size.price, "Price");
        if (!priceResult.ok) {
          setSubmitError(priceResult.error);
          return;
        }

        const stockResult = parseNonNegativeNumber(size.stock_qty, "Stock quantity");
        if (!stockResult.ok) {
          setSubmitError(stockResult.error);
          return;
        }

        const thresholdResult = parseNonNegativeNumber(size.low_stock_threshold, "Low stock threshold");
        if (!thresholdResult.ok) {
          setSubmitError(thresholdResult.error);
          return;
        }

        existingSizeEdits.push({
          id: size.id,
          payload: {
            name,
            category,
            unit: trimmedUnit,
            price: priceResult.value,
            stock_qty: stockResult.value,
            low_stock_threshold: thresholdResult.value
          }
        });
      }
    }

    setSubmitError(null);
    setIsSubmitting(true);

    const result = await onSubmit(payload, product?.id, extraPayloads, existingSizeEdits, existingSizeDeletes);

    if (!result.success) {
      if (result.error === "__duplicate__") {
        setIsSubmitting(false);
        return;
      }

      setSubmitError(result.error || `Failed to ${mode === "create" ? "add" : "update"} product`);
      setIsSubmitting(false);
      return;
    }

    handleOpenChange(false);
  };

  const handleExtraSizeChange = (index: number, field: keyof ProductSizeFormState, value: string) => {
    setExtraSizes((prev) => prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)));
  };

  const handleAddExtraSize = () => {
    setExtraSizes((prev) => [...prev, { ...initialProductSizeState }]);
  };

  const handleRemoveExtraSize = (index: number) => {
    setExtraSizes((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleExistingSizeChange = (id: string, field: keyof ProductSizeFormState, value: string) => {
    setExistingSizes((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleToggleRemoveSize = (id: string) => {
    setExistingSizes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRemoved: !item.isRemoved } : item))
    );
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

        {!(mode === "edit" && existingSizes.filter((item) => !item.isRemoved).length > 1) ? (
          <>
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
          </>
        ) : null}

        {isEditMode ? (
          <div className="space-y-3 rounded-md border border-border p-3">
            <p className="text-sm font-semibold">Existing sizes</p>
            {existingSizes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sizes found for this product.</p>
            ) : (
              <div className="space-y-3">
                {existingSizes.map((item, index) => (
                  <div key={item.id} className="space-y-3 rounded-md border border-border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Size {index + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleRemoveSize(item.id)}
                      >
                        {item.isRemoved ? "Undo remove" : "Remove"}
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label htmlFor={`existing-product-unit-${item.id}`} className="text-sm font-medium">
                          Unit
                        </label>
                        <Input
                          id={`existing-product-unit-${item.id}`}
                          required
                          disabled={item.isRemoved}
                          value={item.unit}
                          onChange={(event) => handleExistingSizeChange(item.id, "unit", event.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor={`existing-product-price-${item.id}`} className="text-sm font-medium">
                          Price in LKR
                        </label>
                        <Input
                          id={`existing-product-price-${item.id}`}
                          required
                          type="number"
                          min={0}
                          step="0.01"
                          disabled={item.isRemoved}
                          value={item.price}
                          onChange={(event) => handleExistingSizeChange(item.id, "price", event.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor={`existing-product-stock-${item.id}`} className="text-sm font-medium">
                          Stock Quantity
                        </label>
                        <Input
                          id={`existing-product-stock-${item.id}`}
                          required
                          type="number"
                          min={0}
                          step="0.01"
                          disabled={item.isRemoved}
                          value={item.stock_qty}
                          onChange={(event) => handleExistingSizeChange(item.id, "stock_qty", event.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor={`existing-product-threshold-${item.id}`} className="text-sm font-medium">
                          Low Stock Threshold
                        </label>
                        <Input
                          id={`existing-product-threshold-${item.id}`}
                          required
                          type="number"
                          min={0}
                          step="1"
                          disabled={item.isRemoved}
                          value={item.low_stock_threshold}
                          onChange={(event) => handleExistingSizeChange(item.id, "low_stock_threshold", event.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {isEditMode ? (
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Add size variants</p>
              <Button type="button" variant="outline" size="sm" onClick={handleAddExtraSize}>
                Add size
              </Button>
            </div>

            {extraSizes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No extra sizes added yet.</p>
            ) : (
              <div className="space-y-3">
                {extraSizes.map((size, index) => (
                  <div key={`extra-size-${index}`} className="space-y-3 rounded-md border border-border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Extra size {index + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveExtraSize(index)}
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label htmlFor={`extra-product-unit-${index}`} className="text-sm font-medium">
                          Unit
                        </label>
                        <Input
                          id={`extra-product-unit-${index}`}
                          required
                          value={size.unit}
                          onChange={(event) => handleExtraSizeChange(index, "unit", event.target.value)}
                          placeholder="e.g. 1L, 5L"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor={`extra-product-price-${index}`} className="text-sm font-medium">
                          Price in LKR
                        </label>
                        <Input
                          id={`extra-product-price-${index}`}
                          required
                          type="number"
                          min={0}
                          step="0.01"
                          value={size.price}
                          onChange={(event) => handleExtraSizeChange(index, "price", event.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor={`extra-product-stock-${index}`} className="text-sm font-medium">
                          Stock Quantity
                        </label>
                        <Input
                          id={`extra-product-stock-${index}`}
                          required
                          type="number"
                          min={0}
                          step="0.01"
                          value={size.stock_qty}
                          onChange={(event) => handleExtraSizeChange(index, "stock_qty", event.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor={`extra-product-threshold-${index}`} className="text-sm font-medium">
                          Low Stock Threshold
                        </label>
                        <Input
                          id={`extra-product-threshold-${index}`}
                          required
                          type="number"
                          min={0}
                          step="1"
                          value={size.low_stock_threshold}
                          onChange={(event) => handleExtraSizeChange(index, "low_stock_threshold", event.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (isEditMode ? "Saving changes..." : "Adding product...") : isEditMode ? "Save changes" : "Add product"}
        </Button>

        {isEditMode ? (
          <Button
            type="button"
            variant="danger"
            className="w-full"
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={isSubmitting}
          >
            Delete product
          </Button>
        ) : null}
      </form>

      {isEditMode ? (
        <Dialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          title="Delete product"
          description="This will permanently remove the product. This action cannot be undone."
        >
          <div className="space-y-3">
            {deleteError ? <p className="text-sm text-red-600">{deleteError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete product"}
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </Dialog>
  );
}

type MultiSizeProductDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payloads: ProductFormPayload[]) => Promise<{ success: boolean; error?: string }>;
};

function MultiSizeProductDialog({ open, onOpenChange, onSubmit }: MultiSizeProductDialogProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [sizes, setSizes] = useState<ProductSizeFormState[]>([initialProductSizeState]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setCategory("");
    setSizes([initialProductSizeState]);
    setSubmitError(null);
    setIsSubmitting(false);
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setSubmitError(null);
      setIsSubmitting(false);
    }
  };

  const handleSizeChange = (index: number, field: keyof ProductSizeFormState, value: string) => {
    setSizes((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleAddSize = () => {
    setSizes((prev) => [...prev, { ...initialProductSizeState }]);
  };

  const handleRemoveSize = (index: number) => {
    setSizes((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedCategory = category.trim();

    if (!trimmedName) {
      setSubmitError("Name is required");
      return;
    }

    if (!trimmedCategory) {
      setSubmitError("Category is required");
      return;
    }

    if (sizes.length === 0) {
      setSubmitError("Add at least one size");
      return;
    }

    const payloads: ProductFormPayload[] = [];

    for (const [index, size] of sizes.entries()) {
      const unit = size.unit.trim();

      if (!unit) {
        setSubmitError(`Size ${index + 1}: Unit is required`);
        return;
      }

      const priceResult = parseNonNegativeNumber(size.price, `Size ${index + 1}: Price`);
      if (!priceResult.ok) {
        setSubmitError(priceResult.error);
        return;
      }

      const stockResult = parseNonNegativeNumber(size.stock_qty, `Size ${index + 1}: Stock quantity`);
      if (!stockResult.ok) {
        setSubmitError(stockResult.error);
        return;
      }

      const thresholdResult = parseNonNegativeNumber(
        size.low_stock_threshold,
        `Size ${index + 1}: Low stock threshold`
      );
      if (!thresholdResult.ok) {
        setSubmitError(thresholdResult.error);
        return;
      }

      payloads.push({
        name: trimmedName,
        category: trimmedCategory,
        unit,
        price: priceResult.value,
        stock_qty: stockResult.value,
        low_stock_threshold: thresholdResult.value
      });
    }

    setSubmitError(null);
    setIsSubmitting(true);

    const result = await onSubmit(payloads);

    if (!result.success) {
      if (result.error === "__duplicate__") {
        setIsSubmitting(false);
        return;
      }

      setSubmitError(result.error || "Failed to add products");
      setIsSubmitting(false);
      return;
    }

    handleOpenChange(false);
  };

  const submitLabel = sizes.length > 1 ? "Add products" : "Add product";

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Add product"
      description="Add a product with one or more size and price variants."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label htmlFor="multi-product-name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="multi-product-name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. QuickDry Enamel"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="multi-product-category" className="text-sm font-medium">
            Category
          </label>
          <Input
            id="multi-product-category"
            required
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="e.g. Paints"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Sizes & pricing</p>
            <Button type="button" variant="outline" size="sm" onClick={handleAddSize}>
              Add size
            </Button>
          </div>

          <div className="space-y-3">
            {sizes.map((size, index) => (
              <div key={`size-${index}`} className="space-y-3 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Size {index + 1}</p>
                  {sizes.length > 1 ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveSize(index)}>
                      Remove
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor={`multi-product-unit-${index}`} className="text-sm font-medium">
                      Unit
                    </label>
                    <Input
                      id={`multi-product-unit-${index}`}
                      required
                      value={size.unit}
                      onChange={(event) => handleSizeChange(index, "unit", event.target.value)}
                      placeholder="e.g. 1L, 5L"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor={`multi-product-price-${index}`} className="text-sm font-medium">
                      Price in LKR
                    </label>
                    <Input
                      id={`multi-product-price-${index}`}
                      required
                      type="number"
                      min={0}
                      step="0.01"
                      value={size.price}
                      onChange={(event) => handleSizeChange(index, "price", event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor={`multi-product-stock-${index}`} className="text-sm font-medium">
                      Stock Quantity
                    </label>
                    <Input
                      id={`multi-product-stock-${index}`}
                      required
                      type="number"
                      min={0}
                      step="0.01"
                      value={size.stock_qty}
                      onChange={(event) => handleSizeChange(index, "stock_qty", event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor={`multi-product-threshold-${index}`} className="text-sm font-medium">
                      Low Stock Threshold
                    </label>
                    <Input
                      id={`multi-product-threshold-${index}`}
                      required
                      type="number"
                      min={0}
                      step="1"
                      value={size.low_stock_threshold}
                      onChange={(event) => handleSizeChange(index, "low_stock_threshold", event.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Adding..." : submitLabel}
        </Button>
      </form>
    </Dialog>
  );
}

type DuplicateProductDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onChooseRename: () => void;
  onChooseAddSizes: () => void;
};

function DuplicateProductDialog({ open, onOpenChange, product, onChooseRename, onChooseAddSizes }: DuplicateProductDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Product already exists"
      description={
        product
          ? `${product.name} already exists. Do you want to change the name or add another size to the existing product?`
          : "This product already exists. Do you want to change the name or add another size to the existing product?"
      }
    >
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onChooseRename}>
          Change name
        </Button>
        <Button onClick={onChooseAddSizes}>Add size to existing</Button>
      </div>
    </Dialog>
  );
}

export default function ProductsPage() {
  const { permissions, isLoading: isPermissionsLoading } = useCurrentUserPermissions();
  const {
    data: products = [],
    error,
    isLoading: isProductsLoading,
    createProduct,
    updateProduct,
    deleteProduct
  } = useProducts();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAddMultiDialogOpen, setIsAddMultiDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [duplicateProduct, setDuplicateProduct] = useState<Product | null>(null);

  const canManageProducts = permissions?.canManageProducts ?? false;
  const canAddProducts = canManageProducts;

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [products]
  );

  const relatedProducts = useMemo(() => {
    if (!editingProduct) return [] as Product[];
    const normalizedName = normalizeProductName(editingProduct.name);
    const normalizedCategory = normalizeProductName(editingProduct.category);
    return products.filter(
      (item) =>
        normalizeProductName(item.name) === normalizedName &&
        normalizeProductName(item.category) === normalizedCategory
    );
  }, [editingProduct, products]);

  const findExistingProductByName = (name: string) => {
    const normalizedName = normalizeProductName(name);
    return products.find((product) => normalizeProductName(product.name) === normalizedName) || null;
  };

  const handleCreateProduct = async (payload: ProductFormPayload) => {
    const existingProduct = findExistingProductByName(payload.name);
    if (existingProduct) {
      setDuplicateProduct(existingProduct);
      setIsDuplicateDialogOpen(true);
      return { success: false, error: "__duplicate__" };
    }

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

  const handleCreateMultiSizeProducts = async (payloads: ProductFormPayload[]) => {
    const primaryName = payloads[0]?.name ?? "";
    const existingProduct = findExistingProductByName(primaryName);

    if (existingProduct) {
      setDuplicateProduct(existingProduct);
      setIsDuplicateDialogOpen(true);
      return { success: false, error: "__duplicate__" };
    }

    try {
      for (const payload of payloads) {
        await createProduct.mutateAsync(payload);
      }

      toast({
        title: "Products added",
        description: `${payloads.length} product size${payloads.length === 1 ? "" : "s"} were added successfully.`,
        variant: "success"
      });

      return { success: true };
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : "Failed to add products";

      toast({
        title: "Create failed",
        description: message,
        variant: "error"
      });

      return { success: false, error: message };
    }
  };

  const handleUpdateProduct = async (
    payload: ProductFormPayload,
    productId?: string,
    extraSizes?: ProductFormPayload[],
    existingSizeEdits?: ExistingSizeUpdate[],
    existingSizeDeletes?: ExistingSizeDelete[]
  ) => {
    if (!productId) {
      return { success: false, error: "Product id is required" };
    }

    try {
      if (existingSizeEdits && existingSizeEdits.length > 0) {
        for (const edit of existingSizeEdits) {
          await updateProduct.mutateAsync({ id: edit.id, payload: edit.payload });
        }
      } else {
        await updateProduct.mutateAsync({ id: productId, payload });
      }

      if (existingSizeDeletes && existingSizeDeletes.length > 0) {
        for (const deletion of existingSizeDeletes) {
          await deleteProduct.mutateAsync(deletion.id);
        }
      }

      if (extraSizes && extraSizes.length > 0) {
        for (const extraPayload of extraSizes) {
          await createProduct.mutateAsync(extraPayload);
        }
      }

      toast({
        title: "Product updated",
        description: `${payload.name} was updated successfully.`,
        variant: "success"
      });

      if (existingSizeDeletes && existingSizeDeletes.length > 0) {
        toast({
          title: "Sizes removed",
          description: `${existingSizeDeletes.length} size${existingSizeDeletes.length === 1 ? "" : "s"} were removed.`,
          variant: "success"
        });
      }

      if (extraSizes && extraSizes.length > 0) {
        toast({
          title: "Extra sizes added",
          description: `${extraSizes.length} size${extraSizes.length === 1 ? "" : "s"} were added successfully.`,
          variant: "success"
        });
      }

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


  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteProduct.mutateAsync(productId);

      toast({
        title: "Product deleted",
        description: "The product was deleted successfully.",
        variant: "success"
      });

      return { success: true };
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : "Failed to delete product";

      toast({
        title: "Delete failed",
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

  const handleDuplicateRename = () => {
    setIsDuplicateDialogOpen(false);
  };

  const handleDuplicateAddSizes = () => {
    if (!duplicateProduct) {
      setIsDuplicateDialogOpen(false);
      return;
    }

    setIsDuplicateDialogOpen(false);
    setIsAddDialogOpen(false);
    setIsAddMultiDialogOpen(false);
    setEditingProduct(duplicateProduct);
    setIsEditDialogOpen(true);
  };

  const isLoading = isPermissionsLoading || isProductsLoading;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Products</h1>
            {canAddProducts ? <Button onClick={() => setIsAddMultiDialogOpen(true)}>Add Product</Button> : null}
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

      <MultiSizeProductDialog
        open={isAddMultiDialogOpen}
        onOpenChange={setIsAddMultiDialogOpen}
        onSubmit={handleCreateMultiSizeProducts}
      />

      <DuplicateProductDialog
        open={isDuplicateDialogOpen}
        onOpenChange={setIsDuplicateDialogOpen}
        product={duplicateProduct}
        onChooseRename={handleDuplicateRename}
        onChooseAddSizes={handleDuplicateAddSizes}
      />

      <ProductFormDialog
        open={isEditDialogOpen}
        onOpenChange={handleEditDialogChange}
        mode="edit"
        product={editingProduct}
        relatedProducts={relatedProducts}
        onSubmit={handleUpdateProduct}
        onDelete={handleDeleteProduct}
      />
    </section>
  );
}
