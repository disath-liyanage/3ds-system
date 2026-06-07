"use client";

import type { FormEvent } from "react";
import type { Product } from "@paintdist/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { usePaginatedProducts, useProducts } from "@/hooks/useProducts";
import { categoryOptions } from "@/lib/product-category-options";
import { toast } from "@/lib/toast";

function UnifiedSizeEditor({ 
  item, 
  priceIndex, 
  handleExistingSizeChange, 
  handleToggleRemoveSize 
}: { 
  item: ExistingSizeFormState; 
  priceIndex: number; 
  handleExistingSizeChange: (id: string, field: keyof ProductSizeFormState, value: string) => void; 
  handleToggleRemoveSize: (id: string) => void; 
}) {
  return (
    <div className="rounded-md border border-border/50 bg-muted/30 p-3">
      <div className="flex justify-between items-center mb-3">
         <p className="text-sm font-medium">Stock Entry {priceIndex + 1}</p>
         <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleToggleRemoveSize(item.id)}>
          {item.isRemoved ? "Undo" : "Remove"}
         </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`existing-product-price-${item.id}`} className="text-xs font-medium">Price</label>
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
          <label htmlFor={`existing-product-stock-${item.id}`} className="text-xs font-medium">Stock Qty</label>
          <Input id={`existing-product-stock-${item.id}`} required type="number" min={0} step="0.01" disabled={item.isRemoved} value={item.stock_qty} onChange={(event) => handleExistingSizeChange(item.id, "stock_qty", event.target.value)} />
        </div>
      </div>
    </div>
  );
}
type ProductFormState = {
  name: string;
  department: string;
  category: string;
  subCategory: string;
  unit: string;
  discount_type: "percent" | "amount";
  discount_value: string;
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
  price?: number;
  discount_type: "percent" | "amount";
  discount_value: number;
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
  department: "",
  category: "",
  subCategory: "",
  unit: "",
  discount_type: "percent",
  discount_value: "0",
  stock_qty: "0",
  low_stock_threshold: "10"
};

const initialProductSizeState: ProductSizeFormState = {
  unit: "",
  price: "0",
  stock_qty: "0",
  low_stock_threshold: "10"
};

const departmentOptions = [
  { value: "Import", label: "Import" },
  { value: "local", label: "local" },
  { value: "JB", label: "JB" },
  { value: "Dubai", label: "Dubai" }
];

function composeCategory(department: string, category: string, subCategory: string) {
  const head = `${department.trim()} / ${category.trim()}`;
  const sub = subCategory.trim();
  return sub ? `${head} / ${sub}` : head;
}

function splitCategory(value: string) {
  const trimmedValue = value.trim();
  const parts = trimmedValue.split("/").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { department: "", category: "", subCategory: "" };
  }

  const knownDepartments = new Set(departmentOptions.map((option) => option.value));
  const head = parts[0] ?? "";

  if (knownDepartments.has(head)) {
    return {
      department: head,
      category: parts[1] ?? "",
      subCategory: parts.slice(2).join(" / ").trim()
    };
  }

  return {
    department: "local",
    category: head,
    subCategory: parts.slice(1).join(" / ").trim()
  };
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
        <div className="light-surface absolute z-20 mt-2 w-full rounded-md border border-border bg-white shadow-lg">
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
  const { department, category, subCategory } = splitCategory(product.category);
  return {
    name: product.name,
    department,
    category,
    subCategory,
    unit: product.unit,
    discount_type: product.discount_type === "percent" ? "percent" : "amount",
    discount_value: toNumber(product.discount_value).toString(),
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
  const [pendingRemoveSizeId, setPendingRemoveSizeId] = useState<string | null>(null);

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
    const department = form.department.trim();
    const category = form.category.trim();
    const subCategory = form.subCategory.trim();
    const unit = form.unit.trim();

    if (!name) {
      setSubmitError("Name is required");
      return;
    }

    if (!department) {
      setSubmitError("Department is required");
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
    const composedCategory = composeCategory(department, category, subCategory);

    if (isMultiSizeEdit) {
      const fallbackSize = existingSizes.find((item) => !item.isRemoved) || existingSizes[0];
      const discountValueResult = parseNonNegativeNumber(form.discount_value, "Discount value");
      if (!discountValueResult.ok) {
        setSubmitError(discountValueResult.error);
        return;
      }
      if (form.discount_type === "percent" && discountValueResult.value > 100) {
        setSubmitError("Discount percentage cannot exceed 100");
        return;
      }

      payload = {
        name,
        category: composedCategory,
        unit: fallbackSize?.unit ?? unit,
        price: toNumber(fallbackSize?.price ?? product?.price),
        discount_type: form.discount_type,
        discount_value: discountValueResult.value,
        stock_qty: toNumber(fallbackSize?.stock_qty ?? form.stock_qty),
        low_stock_threshold: toNumber(fallbackSize?.low_stock_threshold ?? form.low_stock_threshold)
      };
    } else {
      const discountValueResult = parseNonNegativeNumber(form.discount_value, "Discount value");
      if (!discountValueResult.ok) {
        setSubmitError(discountValueResult.error);
        return;
      }
      if (form.discount_type === "percent" && discountValueResult.value > 100) {
        setSubmitError("Discount percentage cannot exceed 100");
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
        discount_type: form.discount_type,
        discount_value: discountValueResult.value,
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

        const extraStock = parseNonNegativeNumber(size.stock_qty, `Extra size ${index + 1}: Stock quantity`);
        if (!extraStock.ok) { setSubmitError(extraStock.error); return; }

        const extraPrice = parseNonNegativeNumber(size.price, `Extra size ${index + 1}: Price`);
        if (!extraPrice.ok) { setSubmitError(extraPrice.error); return; }

        const extraThreshold = parseNonNegativeNumber(size.low_stock_threshold, `Extra size ${index + 1}: Low stock`);
        if (!extraThreshold.ok) { setSubmitError(extraThreshold.error); return; }

        extraPayloads.push({
          name, category: composedCategory, unit: extraUnit,
          price: extraPrice.value,
          discount_type: form.discount_type,
          discount_value: toNumber(form.discount_value),
          stock_qty: extraStock.value, low_stock_threshold: extraThreshold.value
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

        const stockResult = parseNonNegativeNumber(size.stock_qty, "Stock quantity");
        if (!stockResult.ok) { setSubmitError(stockResult.error); return; }

        const priceResult = parseNonNegativeNumber(size.price, "Price");
        if (!priceResult.ok) { setSubmitError(priceResult.error); return; }

        const thresholdResult = parseNonNegativeNumber(size.low_stock_threshold, "Low stock threshold");
        if (!thresholdResult.ok) { setSubmitError(thresholdResult.error); return; }

        if (size.id.startsWith("new-")) {
          extraPayloads.push({
            name, category: composedCategory, unit: trimmedUnit,
            price: priceResult.value,
            discount_type: form.discount_type,
            discount_value: toNumber(form.discount_value),
            stock_qty: stockResult.value, low_stock_threshold: thresholdResult.value
          });
        } else {
          existingSizeEdits.push({
            id: size.id,
            payload: {
              name, category: composedCategory, unit: trimmedUnit,
              price: priceResult.value,
              discount_type: form.discount_type,
              discount_value: toNumber(form.discount_value),
              stock_qty: stockResult.value, low_stock_threshold: thresholdResult.value
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

  const handleConfirmToggleRemoveSize = (id: string) => {
    const current = existingSizes.find((item) => item.id === id);
    if (!current) return;
    if (current.isRemoved) {
      handleToggleRemoveSize(id);
      return;
    }
    setPendingRemoveSizeId(id);
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

  const isEditMode = mode === "edit";

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={isEditMode ? "Edit product" : "Add p roduct"}
      description={
        isEditMode
          ? "Update product details, discount, and stock thresholds."
          : "Add a new product with discount and stock details."
      }
      maxWidthClassName="max-w-5xl"
      stickyHeader
      showBottomClose={false}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
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
            <label htmlFor={`${mode}-product-department`} className="text-sm font-medium">
              Department
            </label>
            <SearchableSelect
              id={`${mode}-product-department`}
              value={form.department}
              options={departmentOptions}
              placeholder="Select department"
              onChange={(value) => setForm((prev) => ({ ...prev, department: value, category: "" }))}
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
              placeholder="Select category"
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
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor={`${mode}-product-discount-type`} className="text-sm font-medium">
              Discount Type
            </label>
            <select
              id={`${mode}-product-discount-type`}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.discount_type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  discount_type: event.target.value === "percent" ? "percent" : "amount"
                }))
              }
            >
              <option value="percent">Percentage (%)</option>
              <option value="amount">Fixed Amount (Rs.)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor={`${mode}-product-discount-value`} className="text-sm font-medium">
              Discount Value
            </label>
            <Input
              id={`${mode}-product-discount-value`}
              required
              type="number"
              min={0}
              step="1"
              value={form.discount_value}
              onChange={(event) => setForm((prev) => ({ ...prev, discount_value: event.target.value }))}
              placeholder={form.discount_type === "percent" ? "e.g. 10" : "e.g. 50"}
            />
          </div>
        </div>

        {!isEditMode ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
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
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock for this size</p>
                        {sizes.map((item, priceIndex) => (
                          <UnifiedSizeEditor 
                            key={item.id} 
                            item={item} 
                            priceIndex={priceIndex} 
                            handleExistingSizeChange={handleExistingSizeChange} 
                            handleToggleRemoveSize={handleConfirmToggleRemoveSize} 
                          />
                        ))}
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

        {isEditMode ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="danger"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isSubmitting}
            >
              Delete product
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving changes..." : "Save changes"}
            </Button>
          </div>
        ) : (
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Adding product..." : "Add product"}
          </Button>
        )}
      </form>

      {isEditMode ? (
        <Dialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          title="Delete product"
          description="This will permanently remove the product. This action cannot be undone."
          maxWidthClassName="max-w-xl"
          showBottomClose={false}
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

      <Dialog
        open={pendingRemoveSizeId !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingRemoveSizeId(null);
        }}
        title="Remove this price?"
        description="This price entry will be removed when you save changes."
        maxWidthClassName="max-w-lg"
        showBottomClose={false}
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="danger"
            onClick={() => {
              if (!pendingRemoveSizeId) return;
              handleToggleRemoveSize(pendingRemoveSizeId);
              setPendingRemoveSizeId(null);
            }}
          >
            Remove
          </Button>
          <Button variant="outline" onClick={() => setPendingRemoveSizeId(null)}>
            Cancel
          </Button>
        </div>
      </Dialog>
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
  const [department, setDepartment] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState("0");
  const [sizes, setSizes] = useState<ProductSizeFormState[]>([initialProductSizeState]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDepartment("");
    setCategory("");
    setSubCategory("");
    setDiscountType("percent");
    setDiscountValue("0");
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
    const trimmedDepartment = department.trim();
    const trimmedCategory = category.trim();
    const trimmedSubCategory = subCategory.trim();

    if (!trimmedName) {
      setSubmitError("Name is required");
      return;
    }

    if (!trimmedDepartment) {
      setSubmitError("Department is required");
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
    const discountValueResult = parseNonNegativeNumber(discountValue, "Discount value");
    if (!discountValueResult.ok) {
      setSubmitError(discountValueResult.error);
      return;
    }
    if (discountType === "percent" && discountValueResult.value > 100) {
      setSubmitError("Discount percentage cannot exceed 100");
      return;
    }

    const payloads: ProductFormPayload[] = [];

    for (const [index, size] of sizes.entries()) {
      const unit = size.unit.trim();

      if (!unit) {
        setSubmitError(`Size ${index + 1}: Unit is required`);
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
        category: composeCategory(trimmedDepartment, trimmedCategory, trimmedSubCategory),
        unit,
        discount_type: discountType,
        discount_value: discountValueResult.value,
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

  const submitLabel = sizes.length > 1 ? "Add Products" : "Add Product";

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Add Product"
      description="Add a product with one or more size variants."
      maxWidthClassName="max-w-5xl"
      stickyHeader
      showBottomClose={false}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
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
            <label htmlFor="multi-product-department" className="text-sm font-medium">
              Department
            </label>
            <SearchableSelect
              id="multi-product-department"
              value={department}
              options={departmentOptions}
              placeholder="Select department"
              onChange={(value) => {
                setDepartment(value);
                setCategory("");
              }}
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
              placeholder="Select category"
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
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="multi-product-discount-type" className="text-sm font-medium">
              Discount Type
            </label>
            <select
              id="multi-product-discount-type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={discountType}
              onChange={(event) => setDiscountType(event.target.value === "percent" ? "percent" : "amount")}
            >
              <option value="percent">Percentage (%)</option>
              <option value="amount">Fixed Amount (Rs.)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="multi-product-discount-value" className="text-sm font-medium">
              Discount Value
            </label>
            <Input
              id="multi-product-discount-value"
              required
              type="number"
              min={0}
              step="0.01"
              value={discountValue}
              onChange={(event) => setDiscountValue(event.target.value)}
              placeholder={discountType === "percent" ? "e.g. 10" : "e.g. 50"}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Sizes & stock</p>
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
                <div className="grid gap-4 md:grid-cols-2">
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
      showBottomClose={false}
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

const PAGE_SIZE = 50;

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [page, setPage] = useState(1);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  const canManageProducts = permissions?.canManageProducts ?? false;
  const canAddProducts = canManageProducts;
  const pagedProductsQuery = usePaginatedProducts({
    page,
    pageSize: PAGE_SIZE,
    query: query.trim() || undefined,
    statusFilter,
    departmentFilter,
    categoryFilter,
    minPrice: minPrice === "" ? undefined : Number(minPrice),
    maxPrice: maxPrice === "" ? undefined : Number(maxPrice)
  });
  const pagedProducts = pagedProductsQuery.data?.rows ?? [];
  const totalProducts = pagedProductsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
  const startRow = totalProducts === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endRow = totalProducts === 0 ? 0 : Math.min(page * PAGE_SIZE, totalProducts);

  const hasFilters =
    statusFilter !== "all" ||
    departmentFilter !== "all" ||
    categoryFilter !== "all" ||
    minPrice !== "" ||
    maxPrice !== "";

  const resetFilters = () => {
    setStatusFilter("all");
    setDepartmentFilter("all");
    setCategoryFilter("all");
    setMinPrice("");
    setMaxPrice("");
    setPage(1);
  };

  const departmentFilterOptions = useMemo(() => {
    const departmentSet = new Set<string>();
    for (const product of products) {
      const { department } = splitCategory(product.category);
      if (department) departmentSet.add(department);
    }
    return ["all", ...Array.from(departmentSet).sort((a, b) => a.localeCompare(b))];
  }, [products]);

  const categoryFilterOptions = useMemo(() => {
    const categorySet = new Set<string>();
    for (const product of products) {
      const { category } = splitCategory(product.category);
      if (category) categorySet.add(category);
    }
    return ["all", ...Array.from(categorySet).sort((a, b) => a.localeCompare(b))];
  }, [products]);

  useEffect(() => {
    if (!isProductsLoading && products.length > 0) {
      const editId = localStorage.getItem("open_edit_product_id");
      if (editId) {
        const prod = products.find(p => p.id === editId);
        if (prod) {
          setEditingProduct(prod);
          setIsEditDialogOpen(true);
        }
        localStorage.removeItem("open_edit_product_id");
      }
    }
  }, [isProductsLoading, products]);

  useEffect(() => {
    if (!isStatusDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!statusDropdownRef.current || statusDropdownRef.current.contains(event.target as Node)) return;
      setIsStatusDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isStatusDropdownOpen]);

  useEffect(() => {
    const statusParam = searchParams.get("status");
    if (statusParam === "low_stock") {
      setStatusFilter("low_stock");
      setFiltersOpen(true);
    }
  }, [searchParams]);

  const sortedProducts = useMemo(() => {
    let list = [...pagedProducts];
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
  }, [pagedProducts, sortState]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, departmentFilter, categoryFilter, minPrice, maxPrice]);

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
  const statusOptions: Array<{ value: string; label: string; variant: "default" | "success" | "danger" | "warning" }> = [
    { value: "all", label: "All", variant: "default" },
    { value: "in_stock", label: "In Stock", variant: "success" },
    { value: "out_of_stock", label: "Out of Stock", variant: "danger" },
    { value: "low_stock", label: "Low Stock", variant: "warning" }
  ];
  const selectedStatusOption = statusOptions.find((option) => option.value === statusFilter) || statusOptions[0];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">Track inventory levels and pricing in real time.</p>
        </div>
        {canAddProducts ? <Button onClick={() => setIsAddMultiDialogOpen(true)}>Add Product</Button> : null}
      </div>

      {error ? <p className="text-sm text-red-600">Failed to load products: {error.message}</p> : null}

      {isLoading ? (
        <div className="glass-panel p-4 text-sm text-muted-foreground">Loading products...</div>
      ) : (
        <div className="space-y-3">
          <div className="glass-panel flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 items-center gap-3">
                <div className="relative flex-1 lg:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="glass-search  pl-10"
                />
                </div>
                {hasFilters ? <span className="text-xs text-muted-foreground">Filters active</span> : null}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={() => setFiltersOpen((prev) => !prev)}>
                  <span className="flex items-center gap-2">
                    <ChevronRight
                      className={
                        filtersOpen
                          ? "h-4 w-4 rotate-90 transition-transform"
                          : "h-4 w-4 rotate-0 transition-transform"
                      }
                    />
                    {filtersOpen ? "Hide filters" : "Show filters"}
                  </span>
                </Button>
                <Button variant={hasFilters ? "default" : "outline"} size="sm" onClick={resetFilters} disabled={!hasFilters}>
                  Reset
                </Button>
              </div>
            </div>

            {filtersOpen ? (
              <div className="glass-panel flex flex-wrap items-end gap-3 p-4">
                <div className="w-full space-y-1 sm:w-[170px]">
                  <label className="text-xs font-semibold text-muted-foreground">Status</label>
                  <div ref={statusDropdownRef} className="relative">
                    <Button
                      type="button"
                      variant="outline"
                    className="flex h-10 w-full items-center justify-between px-3"
                      onClick={() => setIsStatusDropdownOpen((prev) => !prev)}
                    >
                      <Badge variant={selectedStatusOption.variant}>{selectedStatusOption.label}</Badge>
                      <ChevronRight
                        className={
                          isStatusDropdownOpen
                            ? "h-4 w-4 rotate-90 transition-transform"
                            : "h-4 w-4 rotate-0 transition-transform"
                        }
                      />
                    </Button>
                    {isStatusDropdownOpen ? (
                      <div className="light-surface absolute z-20 mt-2 w-full rounded-md border border-border bg-white py-1 shadow-lg">
                        {statusOptions.map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            variant="ghost"
                            className="h-auto w-full justify-start px-3 py-2 text-left"
                            onClick={() => {
                              setStatusFilter(option.value);
                              setIsStatusDropdownOpen(false);
                            }}
                          >
                            <Badge variant={option.variant}>{option.label}</Badge>
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="w-full space-y-1 sm:w-[240px]">
                  <label className="text-xs font-semibold text-muted-foreground">Department</label>
                  <select
                    className="glass-field flex h-10 w-full px-3 py-2 text-sm"
                    value={departmentFilter}
                    onChange={(event) => setDepartmentFilter(event.target.value)}
                  >
                    {departmentFilterOptions.map((option) => (
                      <option key={option} value={option}>
                        {option === "all" ? "All departments" : option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-full space-y-1 sm:w-[240px]">
                  <label className="text-xs font-semibold text-muted-foreground">Category</label>
                  <select
                    className="glass-field flex h-10 w-full px-3 py-2 text-sm"
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                  >
                    {categoryFilterOptions.map((option) => (
                      <option key={option} value={option}>
                        {option === "all" ? "All categories" : option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-full space-y-1 sm:w-[120px]">
                  <label className="text-xs font-semibold text-muted-foreground">Min Price (LKR)</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={minPrice}
                    onChange={(event) => setMinPrice(event.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="w-full space-y-1 sm:w-[120px]">
                  <label className="text-xs font-semibold text-muted-foreground">Max Price (LKR)</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={maxPrice}
                    onChange={(event) => setMaxPrice(event.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            ) : null}
          </div>

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
                  <Button type="button" variant="ghost" size="sm" className="h-auto p-0 font-semibold hover:bg-transparent" onClick={() => handleSort("name")}>
                    Name{getSortLabel("name")}
                  </Button>
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead>
                  <Button type="button" variant="ghost" size="sm" className="h-auto p-0 font-semibold hover:bg-transparent" onClick={() => handleSort("unit")}>
                    Unit{getSortLabel("unit")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button type="button" variant="ghost" size="sm" className="h-auto p-0 font-semibold hover:bg-transparent" onClick={() => handleSort("price")}>
                    Price (LKR){getSortLabel("price")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button type="button" variant="ghost" size="sm" className="h-auto p-0 font-semibold hover:bg-transparent" onClick={() => handleSort("stock")}>
                    Stock Qty{getSortLabel("stock")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button type="button" variant="ghost" size="sm" className="h-auto p-0 font-semibold hover:bg-transparent" onClick={() => handleSort("status")}>
                    Status{getSortLabel("status")}
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
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
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => prev - 1)}
              aria-label="Previous page"
              disabled={page <= 1 || pagedProductsQuery.isLoading}
              className="h-9 w-9 rounded-full p-0 bg-white/80 text-muted-foreground shadow-sm backdrop-blur-sm hover:border-brand hover:text-brand"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>{`Rows ${startRow} - ${endRow} of ${totalProducts}`}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => prev + 1)}
              aria-label="Next page"
              disabled={page >= totalPages || pagedProductsQuery.isLoading}
              className="h-9 w-9 rounded-full p-0 bg-white/80 text-muted-foreground shadow-sm backdrop-blur-sm hover:border-brand hover:text-brand"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
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
