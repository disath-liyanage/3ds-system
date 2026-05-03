"use client";

import type { FormEvent } from "react";
import type { Product } from "@paintdist/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useProducts } from "@/hooks/useProducts";
import { useProductStockByPrice } from "@/hooks/useProductStockByPrice";
import { toast } from "@/lib/toast";
import { updateProductGRNPrices, updateProductGRNStock } from "@/app/actions/update-grn-prices";

function UnifiedSizeEditor({ 
  item, 
  priceIndex, 
  handleExistingSizeChange, 
  handleToggleRemoveSize 
}: { 
  item: ExistingSizeFormState; 
  priceIndex: number; 
  handleExistingSizeChange: (id: string, field: "price" | "stock_qty" | "low_stock_threshold" | "unit", value: string) => void; 
  handleToggleRemoveSize: (id: string) => void; 
}) {
  const { data: stockByPrice, isLoading, refetch } = useProductStockByPrice(item.id.startsWith("new-") ? undefined : item.id);
  const [editingPrice, setEditingPrice] = useState<Record<number, string>>({});
  const [editingStock, setEditingStock] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (oldPrice: number) => {
    setIsSaving(true);
    let success = true;

    const newPriceStr = editingPrice[oldPrice];
    if (newPriceStr !== undefined) {
      const newPrice = Number(newPriceStr);
      if (!isNaN(newPrice) && newPrice !== oldPrice) {
        const result = await updateProductGRNPrices([{ productId: item.id, oldSellingPrice: oldPrice, newSellingPrice: newPrice }]);
        if (!result.success) {
          toast.error(result.error || "Failed to update price");
          success = false;
        }
      }
    }

    const newStockStr = editingStock[oldPrice];
    if (newStockStr !== undefined) {
      const newStock = Number(newStockStr);
      const oldStock = stockByPrice?.find(r => r.selling_price === oldPrice)?.total_qty || 0;
      if (!isNaN(newStock) && newStock !== oldStock) {
        const targetPrice = newPriceStr && success ? Number(newPriceStr) : oldPrice;
        const result = await updateProductGRNStock(item.id, targetPrice, newStock);
        if (!result.success) {
          toast.error(result.error || "Failed to update stock");
          success = false;
        }
      }
    }

    if (success && (newPriceStr !== undefined || newStockStr !== undefined)) {
      toast.success("Updated successfully");
      setEditingPrice(prev => { const n = {...prev}; delete n[oldPrice]; return n; });
      setEditingStock(prev => { const n = {...prev}; delete n[oldPrice]; return n; });
      await refetch();
    }
    
    setIsSaving(false);
  };

  if (item.id.startsWith("new-") || (!isLoading && (!stockByPrice || stockByPrice.length === 0))) {
    return (
      <div className="rounded-md border border-border/50 bg-muted/30 p-3">
        <div className="flex justify-between items-center mb-3">
           <p className="text-sm font-medium">Price {priceIndex + 1}</p>
           <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleToggleRemoveSize(item.id)}>
            {item.isRemoved ? "Undo" : "Remove"}
           </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor={`existing-product-price-${item.id}`} className="text-xs font-medium">Price in LKR</label>
            <Input id={`existing-product-price-${item.id}`} required type="number" min={0} step="0.01" disabled={item.isRemoved} value={item.price} onChange={(event) => handleExistingSizeChange(item.id, "price", event.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor={`existing-product-stock-${item.id}`} className="text-xs font-medium">Stock Qty</label>
            <Input id={`existing-product-stock-${item.id}`} required type="number" min={0} step="0.01" disabled={item.isRemoved} value={item.stock_qty} onChange={(event) => handleExistingSizeChange(item.id, "stock_qty", event.target.value)} />
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="text-xs text-muted-foreground mt-2">Loading pricing...</div>;

  return (
    <div className="space-y-3">
      {stockByPrice?.map((row, index) => {
        const currentEditingPrice = editingPrice[row.selling_price] ?? row.selling_price.toString();
        const currentEditingStock = editingStock[row.selling_price] ?? row.total_qty.toString();
        const isChanged = currentEditingPrice !== row.selling_price.toString() || currentEditingStock !== row.total_qty.toString();

        return (
          <div key={row.selling_price} className="rounded-md border border-border/50 bg-muted/30 p-3">
            <div className="flex justify-between items-center mb-3">
               <p className="text-sm font-medium">Price {priceIndex + 1 + index}</p>
               {index === 0 && (
                 <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleToggleRemoveSize(item.id)}>
                  {item.isRemoved ? "Undo" : "Remove"}
                 </Button>
               )}
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs font-medium">Price in LKR</label>
                <Input className="bg-white text-xs h-9" type="number" min={0} step="0.01" disabled={item.isRemoved} value={currentEditingPrice} onChange={e => setEditingPrice(prev => ({...prev, [row.selling_price]: e.target.value}))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Stock Qty</label>
                <Input className="bg-white text-xs h-9" type="number" min={0} step="0.01" disabled={item.isRemoved} value={currentEditingStock} onChange={e => setEditingStock(prev => ({...prev, [row.selling_price]: e.target.value}))} />
              </div>
              <Button type="button" size="sm" className="h-9" variant={isChanged ? "default" : "secondary"} disabled={!isChanged || isSaving || item.isRemoved} onClick={() => handleSave(row.selling_price)}>Save</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
type ProductFormState = {
  name: string;
  category: string;
  subCategory: string;
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
  originalGroupKey?: string;
};

type ExistingSizeUpdate = {
  id: string;
  payload: ProductFormPayload;
};

type ExistingSizeDelete = {
  id: string;
};

type SortKey = "name" | "unit" | "price" | "stock" | "status";

type SortState = {
  key: SortKey;
  direction: "asc" | "desc";
} | null;

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

type SearchableSelectOption = {
  value: string;
  label: string;
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
  subCategory: "",
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

const categoryOptions = [
  { value: "Hardware", label: "Hardware" },
  { value: "Cash", label: "Cash" },
  { value: "Bathware", label: "Bathware" },
  { value: "Fast moving", label: "Fast moving" },
  { value: "Pantry Cupboard", label: "Pantry Cupboard"}
];

function composeCategory(category: string, subCategory: string) {
  return `${category.trim()} / ${subCategory.trim()}`;
}

function splitCategory(value: string) {
  const trimmedValue = value.trim();
  const parts = trimmedValue.split("/");
  if (parts.length < 2) {
    return { category: trimmedValue, subCategory: "" };
  }

  const category = parts[0]?.trim() ?? "";
  const subCategory = parts.slice(1).join("/").trim();
  return { category, subCategory };
}

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

function getStockStatusRank(label: string) {
  switch (label) {
    case "Out of Stock":
      return 0;
    case "Low Stock":
      return 1;
    case "In Stock":
      return 2;
    default:
      return 3;
  }
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

type SearchableSelectProps = {
  id?: string;
  value: string;
  options: SearchableSelectOption[];
  placeholder?: string;
  onChange: (value: string) => void;
};

function SearchableSelect({ id, value, options, placeholder, onChange }: SearchableSelectProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;

    return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  useEffect(() => {
    if (selectedOption) {
      setQuery(selectedOption.label);
    }
  }, [selectedOption]);

  useEffect(() => {
    if (!isOpen) return;
    setHighlightedIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current || containerRef.current.contains(event.target as Node)) return;
      setIsOpen(false);
      if (selectedOption) {
        setQuery(selectedOption.label);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedOption]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setQuery(nextValue);
    setIsOpen(true);

    if (selectedOption && nextValue !== selectedOption.label) {
      onChange("");
    }
  };

  const handleSelect = (option: SearchableSelectOption) => {
    onChange(option.value);
    setQuery(option.label);
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setIsOpen(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % Math.max(filteredOptions.length, 1));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + Math.max(filteredOptions.length, 1)) % Math.max(filteredOptions.length, 1));
    }

    if (event.key === "Enter") {
      if (!isOpen) return;
      event.preventDefault();
      const option = filteredOptions[highlightedIndex];
      if (option) {
        handleSelect(option);
      }
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      if (selectedOption) {
        setQuery(selectedOption.label);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={query}
        placeholder={placeholder}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {isOpen ? (
        <div className="absolute z-20 mt-2 w-full rounded-md border border-border bg-white shadow-lg">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No matches found.</div>
          ) : (
            <div className="max-h-56 overflow-auto py-1">
              {filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  className={`cursor-pointer px-3 py-2 text-sm transition ${
                    index === highlightedIndex ? "bg-muted" : ""
                  }`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(option)}
                >
                  {option.label}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function toProductFormState(product: Product): ProductFormState {
  const { category, subCategory } = splitCategory(product.category);
  return {
    name: product.name,
    category,
    subCategory,
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
        isRemoved: false,
        originalGroupKey: normalizeUnit(item.unit)
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
    const subCategory = form.subCategory.trim();
    const unit = form.unit.trim();

    if (!name) {
      setSubmitError("Name is required");
      return;
    }

    if (!category) {
      setSubmitError("Category is required");
      return;
    }

    if (!subCategory) {
      setSubmitError("Sub category is required");
      return;
    }

    const isMultiSizeEdit = isEditMode;

    if (!isMultiSizeEdit) {
      if (!unit) {
        setSubmitError("Unit is required");
        return;
      }
    }

    let payload: ProductFormPayload;
    const composedCategory = composeCategory(category, subCategory);

    if (isMultiSizeEdit) {
      const fallbackSize = existingSizes.find((item) => !item.isRemoved) || existingSizes[0];

      payload = {
        name,
        category: composedCategory,
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
        category: composedCategory,
        unit,
        price: priceResult.value,
        stock_qty: stockResult.value,
        low_stock_threshold: thresholdResult.value
      };
    }

    let extraPayloads: ProductFormPayload[] | undefined;
    let existingSizeEdits: ExistingSizeUpdate[] | undefined;
    let existingSizeDeletes: ExistingSizeDelete[] | undefined;

    if (isEditMode) {
      extraPayloads = [];
      existingSizeEdits = [];
      existingSizeDeletes = [];

      const finalGroupUnits = new Set<string>();

      for (const [groupKey, group] of Object.entries(groupedSizes)) {
        if (group.sizes.every(s => s.isRemoved)) continue;
        const currentUnit = group.sizes[0]?.unit.trim();
        if (!currentUnit) {
          setSubmitError("Unit is required");
          return;
        }
        const finalUnit = normalizeUnit(currentUnit);
        if (finalGroupUnits.has(finalUnit)) {
          setSubmitError(`Unit "${currentUnit}" is duplicated. You cannot have multiple groups with the same unit.`);
          return;
        }
        finalGroupUnits.add(finalUnit);
      }

      for (const [index, size] of extraSizes.entries()) {
        const extraUnit = size.unit.trim();
        if (!extraUnit) {
          setSubmitError(`Extra size ${index + 1}: Unit is required`);
          return;
        }
        const finalUnit = normalizeUnit(extraUnit);
        if (finalGroupUnits.has(finalUnit)) {
          setSubmitError(`Unit "${extraUnit}" already exists. Edit the existing unit instead.`);
          return;
        }
        finalGroupUnits.add(finalUnit);

        const extraPrice = parseNonNegativeNumber(size.price, `Extra size ${index + 1}: Price`);
        if (!extraPrice.ok) { setSubmitError(extraPrice.error); return; }

        const extraStock = parseNonNegativeNumber(size.stock_qty, `Extra size ${index + 1}: Stock quantity`);
        if (!extraStock.ok) { setSubmitError(extraStock.error); return; }

        const extraThreshold = parseNonNegativeNumber(size.low_stock_threshold, `Extra size ${index + 1}: Low stock`);
        if (!extraThreshold.ok) { setSubmitError(extraThreshold.error); return; }

        extraPayloads.push({
          name, category: composedCategory, unit: extraUnit,
          price: extraPrice.value, stock_qty: extraStock.value, low_stock_threshold: extraThreshold.value
        });
      }

      for (const size of existingSizes) {
        const trimmedUnit = size.unit.trim();

        if (size.isRemoved) {
          if (!size.id.startsWith("new-")) {
            existingSizeDeletes.push({ id: size.id });
          }
          continue;
        }

        const priceResult = parseNonNegativeNumber(size.price, "Price");
        if (!priceResult.ok) { setSubmitError(priceResult.error); return; }

        const stockResult = parseNonNegativeNumber(size.stock_qty, "Stock quantity");
        if (!stockResult.ok) { setSubmitError(stockResult.error); return; }

        const thresholdResult = parseNonNegativeNumber(size.low_stock_threshold, "Low stock threshold");
        if (!thresholdResult.ok) { setSubmitError(thresholdResult.error); return; }

        if (size.id.startsWith("new-")) {
          extraPayloads.push({
            name, category: composedCategory, unit: trimmedUnit,
            price: priceResult.value, stock_qty: stockResult.value, low_stock_threshold: thresholdResult.value
          });
        } else {
          existingSizeEdits.push({
            id: size.id,
            payload: {
              name, category: composedCategory, unit: trimmedUnit,
              price: priceResult.value, stock_qty: stockResult.value, low_stock_threshold: thresholdResult.value
            }
          });
        }
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

  const groupedSizes = useMemo(() => {
    const groups: Record<string, { originalUnit: string; sizes: ExistingSizeFormState[] }> = {};
    for (const size of existingSizes) {
      const key = size.originalGroupKey || normalizeUnit(size.unit);
      if (!groups[key]) {
        groups[key] = { originalUnit: key, sizes: [] };
      }
      groups[key].sizes.push(size);
    }
    return groups;
  }, [existingSizes]);

  const handleGroupUnitChange = (originalUnitKey: string, newUnitValue: string) => {
    setExistingSizes((prev) =>
      prev.map((size) => {
        if (size.originalGroupKey === originalUnitKey) {
          return { ...size, unit: newUnitValue };
        }
        return size;
      })
    );
  };

  const handleGroupToggleRemove = (originalUnitKey: string, willRemove: boolean) => {
    setExistingSizes((prev) =>
      prev.map((size) => {
        if (size.originalGroupKey === originalUnitKey) {
          return { ...size, isRemoved: willRemove };
        }
        return size;
      })
    );
  };

  const handleAddPriceToGroup = (groupKey: string, currentUnit: string) => {
    setExistingSizes((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${Math.random()}`,
        unit: currentUnit,
        price: "",
        stock_qty: "",
        low_stock_threshold: "10",
        isRemoved: false,
        originalGroupKey: groupKey
      }
    ]);
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
          <SearchableSelect
            id={`${mode}-product-category`}
            value={form.category}
            options={categoryOptions}
            placeholder="Select department"
            onChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor={`${mode}-product-sub-category`} className="text-sm font-medium">
            Sub category
          </label>
          <Input
            id={`${mode}-product-sub-category`}
            required
            value={form.subCategory}
            onChange={(event) => setForm((prev) => ({ ...prev, subCategory: event.target.value }))}
            placeholder="e.g. Screws"
          />
        </div>

        {!isEditMode ? (
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
              <div className="space-y-4">
                {Object.entries(groupedSizes).map(([originalUnitKey, group], groupIndex) => {
                  const sizes = group.sizes;
                  const currentUnit = sizes[0]?.unit || "";
                  const isAllRemoved = sizes.every((s) => s.isRemoved);

                  return (
                    <div key={originalUnitKey} className="space-y-3 rounded-md border border-border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Size {groupIndex + 1}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleGroupToggleRemove(originalUnitKey, !isAllRemoved)}
                        >
                          {isAllRemoved ? "Undo remove size" : "Remove size"}
                        </Button>
                      </div>
                      
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label htmlFor={`existing-group-unit-${originalUnitKey}`} className="text-sm font-medium">
                            Unit
                          </label>
                          <Input
                            id={`existing-group-unit-${originalUnitKey}`}
                            required
                            disabled={isAllRemoved}
                            value={currentUnit}
                            onChange={(event) => handleGroupUnitChange(originalUnitKey, event.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor={`existing-group-lowstock-${originalUnitKey}`} className="text-sm font-medium">
                            Low Stock
                          </label>
                          <Input
                            id={`existing-group-lowstock-${originalUnitKey}`}
                            required
                            type="number"
                            min={0}
                            step="1"
                            disabled={isAllRemoved}
                            value={sizes[0]?.low_stock_threshold || ""}
                            onChange={(event) => {
                              // We can safely update it directly in the parent form state
                              const val = event.target.value;
                              handleExistingSizeChange(sizes[0].id, "low_stock_threshold", val);
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-3 pt-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prices \u0026 Stock for this size</p>
                        {sizes.map((item, priceIndex) => (
                          <UnifiedSizeEditor 
                            key={item.id} 
                            item={item} 
                            priceIndex={priceIndex} 
                            handleExistingSizeChange={handleExistingSizeChange} 
                            handleToggleRemoveSize={handleToggleRemoveSize} 
                          />
                        ))}
                        
                        <div className="flex justify-end pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isAllRemoved}
                            onClick={() => handleAddPriceToGroup(originalUnitKey, currentUnit)}
                          >
                            Add Price
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
  const [subCategory, setSubCategory] = useState("");
  const [sizes, setSizes] = useState<ProductSizeFormState[]>([initialProductSizeState]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setCategory("");
    setSubCategory("");
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
    const trimmedSubCategory = subCategory.trim();

    if (!trimmedName) {
      setSubmitError("Name is required");
      return;
    }

    if (!trimmedCategory) {
      setSubmitError("Category is required");
      return;
    }

    if (!trimmedSubCategory) {
      setSubmitError("Sub category is required");
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
        category: composeCategory(trimmedCategory, trimmedSubCategory),
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
          <SearchableSelect
            id="multi-product-category"
            value={category}
            options={categoryOptions}
            placeholder="Select department"
            onChange={setCategory}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="multi-product-sub-category" className="text-sm font-medium">
            Sub category
          </label>
          <Input
            id="multi-product-sub-category"
            required
            value={subCategory}
            onChange={(event) => setSubCategory(event.target.value)}
            placeholder="e.g. Screws"
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
  const router = useRouter();
  const { permissions, isLoading: isPermissionsLoading } = useCurrentUserPermissions();
  const {
    data: products = [],
    error,
    isLoading: isProductsLoading,
    createProduct,
    updateProduct,
    deleteProduct
  } = useProducts();

  const [isAddMultiDialogOpen, setIsAddMultiDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [duplicateProduct, setDuplicateProduct] = useState<Product | null>(null);
  const [sortState, setSortState] = useState<SortState>(null);

  const canManageProducts = permissions?.canManageProducts ?? false;
  const canAddProducts = canManageProducts;

  const sortedProducts = useMemo(() => {
    const list = [...products];

    if (!sortState) {
      return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    const direction = sortState.direction === "asc" ? 1 : -1;

    return list.sort((a, b) => {
      switch (sortState.key) {
        case "name":
          return a.name.localeCompare(b.name) * direction;
        case "unit":
          return a.unit.localeCompare(b.unit) * direction;
        case "price":
          return (toNumber(a.price) - toNumber(b.price)) * direction;
        case "stock":
          return (toNumber(a.stock_qty) - toNumber(b.stock_qty)) * direction;
        case "status": {
          const statusA = getStockStatusRank(getStockStatus(a.stock_qty, a.low_stock_threshold).label);
          const statusB = getStockStatusRank(getStockStatus(b.stock_qty, b.low_stock_threshold).label);
          return (statusA - statusB) * direction;
        }
        default:
          return 0;
      }
    });
  }, [products, sortState]);

  const handleSort = (key: SortKey) => {
    setSortState((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const resetSort = () => {
    setSortState(null);
  };

  const getSortLabel = (key: SortKey) => {
    if (sortState?.key !== key) return "";
    return sortState.direction === "asc" ? " \u2191" : " \u2193";
  };

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
        <div className="space-y-3">
          {sortState ? (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={resetSort}>
                Reset sort
              </Button>
            </div>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button type="button" className="font-semibold" onClick={() => handleSort("name")}>
                    Name{getSortLabel("name")}
                  </button>
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead>
                  <button type="button" className="font-semibold" onClick={() => handleSort("unit")}>
                    Unit{getSortLabel("unit")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="font-semibold" onClick={() => handleSort("price")}>
                    Price (LKR){getSortLabel("price")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="font-semibold" onClick={() => handleSort("stock")}>
                    Stock Qty{getSortLabel("stock")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="font-semibold" onClick={() => handleSort("status")}>
                    Status{getSortLabel("status")}
                  </button>
                </TableHead>
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
                    <TableRow
                      key={product.id}
                      className="cursor-pointer transition hover:bg-muted/50"
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/products/${product.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(`/products/${product.id}`);
                        }
                      }}
                    >
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
                            onClick={(event) => {
                              event.stopPropagation();
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
        </div>
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
