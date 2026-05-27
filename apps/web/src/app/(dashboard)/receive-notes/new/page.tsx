"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { Select } from "@/components/ui/select";
import {
  createReceiveNote,
  getLatestReceiveNoteProductCosts,
  getLatestReceiveNoteProductDefaults
} from "@/app/actions/receive-notes";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useProducts } from "@/hooks/useProducts";
import { useSuppliers } from "@/hooks/useSuppliers";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type ReceiveNoteForm = {
  invoice_number: string;
  supplier_name: string;
  notes: string;
  draft: {
    product_id: string;
    qty?: number;
    free_qty?: number;
    product_cost?: number;
    selling_price?: number;
    item_discount_percent?: number;
    item_discount_amount?: number;
    rep_sales_discount?: number;
    rep_collection?: number;
  };
  items: Array<{
    product_id: string;
    qty: number;
    free_qty: number;
    product_cost: number;
    selling_price: number;
    item_discount_percent: number;
    rep_sales_discount: number;
    rep_collection: number;
  }>;
};

const draftFieldOrder = [
  "draft.qty",
  "draft.free_qty",
  "draft.product_cost",
  "draft.selling_price",
  "draft.item_discount_percent",
  "draft.item_discount_amount",
  "draft.rep_sales_discount",
  "draft.rep_collection"
] as const;

export default function NewReceiveNotePage() {
  const router = useRouter();
  const { permissions, isLoading } = useCurrentUserPermissions();
  const { data: products, isLoading: isProductsLoading } = useProducts();
  const { data: suppliers, isLoading: isSuppliersLoading } = useSuppliers();
  const preloadRequestRef = useRef(0);
  const lastDiscountRef = useRef<number>(0);
  const [addAttempted, setAddAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [discountInputMode, setDiscountInputMode] = useState<"percent" | "amount">("percent");
  const [latestCostsByProduct, setLatestCostsByProduct] = useState<Record<string, number>>({});
  const [productSearchMode, setProductSearchMode] = useState<"all" | "name" | "price">("all");
  const { control, register, handleSubmit, setValue, trigger, getValues, resetField, formState } =
    useForm<ReceiveNoteForm>({
    defaultValues: {
      invoice_number: "",
      supplier_name: "",
      notes: "",
      draft: {
        product_id: "",
        qty: undefined,
        free_qty: undefined,
        product_cost: undefined,
        selling_price: undefined,
        item_discount_percent: undefined,
        item_discount_amount: undefined,
        rep_sales_discount: undefined,
        rep_collection: undefined
      },
      items: []
    }
  });

  const watchedItems = useWatch({ control, name: "items" });
  const watchedSupplierName = useWatch({ control, name: "supplier_name" });
  const watchedDraft = useWatch({ control, name: "draft" });
  const draftErrors = formState.errors?.draft;
  const shouldValidateDraft = () => addAttempted || Boolean(getValues("draft.product_id"));
  const handleDraftFieldEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;

    event.preventDefault();

    const currentName = event.currentTarget.name;
    const currentIndex = draftFieldOrder.indexOf(currentName as (typeof draftFieldOrder)[number]);
    if (currentIndex === -1) return;

    const nextFieldName = draftFieldOrder.slice(currentIndex + 1).find((fieldName) => {
      const field = document.querySelector(`input[name="${fieldName}"]`) as HTMLInputElement | null;
      return Boolean(field && !field.disabled);
    });

    if (!nextFieldName) return;

    const nextField = document.querySelector(`input[name="${nextFieldName}"]`) as HTMLInputElement | null;
    nextField?.focus();
    nextField?.select();
  };
  const costField = register("draft.product_cost", {
    validate: (value) =>
      shouldValidateDraft() && value === undefined ? "Cost is required" : true,
    setValueAs: (value) => (value === "" ? undefined : Number(value))
  });

  const productOptions = useMemo<SearchableSelectOption[]>(
    () =>
      (products ?? []).map((product) => ({
        value: product.id,
        label: `${product.name} · ${product.unit}`,
        subLabel:
          product.id in latestCostsByProduct
            ? `Cost: LKR ${Number(latestCostsByProduct[product.id] || 0).toFixed(2)}`
            : undefined
      })),
    [latestCostsByProduct, products]
  );

  const productSearchLabel =
    productSearchMode === "name" ? "Product Name" : productSearchMode === "price" ? "Product Price" : "Product";
  const productSearchPlaceholder = isProductsLoading
    ? "Loading products..."
    : productSearchMode === "name"
      ? "Searching for the Product name"
      : productSearchMode === "price"
        ? "Searching for the Product price"
        : "Select product";
  const cycleProductSearchMode = () => {
    setProductSearchMode((prev) => (prev === "all" ? "name" : prev === "name" ? "price" : "all"));
  };

  const supplierOptions = useMemo<SearchableSelectOption[]>(
    () =>
      (suppliers ?? []).map((supplier) => ({
        value: supplier.name,
        label: `${supplier.name} · ${supplier.phone}`
      })),
    [suppliers]
  );

  const { append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const hasDraftData = (draft: ReceiveNoteForm["draft"]) =>
    Boolean(
      draft.product_id ||
        draft.qty ||
        draft.free_qty ||
        draft.product_cost ||
        draft.selling_price ||
        draft.item_discount_percent ||
        draft.item_discount_amount ||
        draft.rep_sales_discount ||
        draft.rep_collection
    );

  const onSubmit = async (values: ReceiveNoteForm) => {
    if (isSubmitting) return;

    if (hasDraftData(values.draft)) {
      setAddAttempted(true);
      window.alert("Please add the item or reset the fields before submitting.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createReceiveNote({
        invoice_number: values.invoice_number,
        supplier_name: values.supplier_name,
        notes: values.notes,
        items: values.items
      });
      if (!result.success) {
        console.error("Failed to create GRN", result.error);
        toast({
          title: "Failed to add GRN",
          description: result.error || "Please try again.",
          variant: "error"
        });
        return;
      }

      toast({ title: "GRN added successfully", variant: "success" });
      router.push("/receive-notes");
    } finally {
      setIsSubmitting(false);
    }
  };

  const normalizeNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const applyProductDefaults = async (productId: string) => {
    const requestId = ++preloadRequestRef.current;
    const result = await getLatestReceiveNoteProductDefaults(productId);
    if (requestId !== preloadRequestRef.current) return;

    if (!result.success) {
      toast({
        title: "Failed to load latest GRN values",
        description: result.error || "Please try again.",
        variant: "error"
      });
      return;
    }

    if (!result.data) {
      setValue("draft.product_cost", undefined, { shouldDirty: true });
      setValue("draft.selling_price", undefined, { shouldDirty: true });
      setValue("draft.item_discount_percent", undefined, { shouldDirty: true });
      setValue("draft.item_discount_amount", undefined, { shouldDirty: true });
      setValue("draft.rep_sales_discount", undefined, { shouldDirty: true });
      setValue("draft.rep_collection", undefined, { shouldDirty: true });
      return;
    }

    setValue("draft.product_cost", result.data.product_cost || undefined, { shouldDirty: true });
    setValue("draft.selling_price", result.data.selling_price || undefined, { shouldDirty: true });
    setValue("draft.item_discount_percent", result.data.item_discount_percent || undefined, { shouldDirty: true });
    setValue("draft.rep_sales_discount", result.data.rep_sales_discount || undefined, { shouldDirty: true });
    setValue("draft.rep_collection", result.data.rep_collection || undefined, { shouldDirty: true });

    if (discountInputMode === "amount") {
      const sellingPrice = result.data.selling_price || 0;
      const discountPercent = result.data.item_discount_percent || 0;
      const discountAmount =
        sellingPrice > 0 ? Number(((sellingPrice * discountPercent) / 100).toFixed(2)) : undefined;
      setValue("draft.item_discount_amount", discountAmount, { shouldDirty: true });
    }
  };

  useEffect(() => {
    const productIds = (products ?? []).map((product) => product.id).filter(Boolean);
    if (productIds.length === 0) {
      setLatestCostsByProduct({});
      return;
    }

    let isMounted = true;
    const loadLatestCosts = async () => {
      const result = await getLatestReceiveNoteProductCosts(productIds);
      if (!isMounted) return;
      if (!result.success) return;
      setLatestCostsByProduct(result.data);
    };

    loadLatestCosts();
    return () => {
      isMounted = false;
    };
  }, [products]);

  useEffect(() => {
    const sellingPrice = normalizeNumber(watchedDraft?.selling_price);
    const discountPercent = normalizeNumber(watchedDraft?.item_discount_percent);
    const isDiscountApplied = discountPercent > 0 && sellingPrice > 0;

    if (isDiscountApplied && discountPercent !== lastDiscountRef.current) {
      const calculatedCost = sellingPrice - (sellingPrice * discountPercent) / 100;
      setValue("draft.product_cost", Number(calculatedCost.toFixed(2)), { shouldDirty: true });
    }

    lastDiscountRef.current = discountPercent;
  }, [setValue, watchedDraft?.item_discount_percent, watchedDraft?.selling_price]);

  useEffect(() => {
    if (discountInputMode !== "amount") return;
    const sellingPrice = normalizeNumber(watchedDraft?.selling_price);
    const discountAmount = normalizeNumber(getValues("draft.item_discount_amount"));
    const discountPercent =
      sellingPrice > 0 ? Number(((discountAmount / sellingPrice) * 100).toFixed(4)) : 0;
    setValue("draft.item_discount_percent", discountPercent, { shouldDirty: true });
  }, [discountInputMode, watchedDraft?.selling_price, getValues, setValue]);

  const itemSummaries = useMemo(
    () =>
      (watchedItems ?? []).map((item) => {
        const qty = normalizeNumber(item?.qty);
        const freeQty = normalizeNumber(item?.free_qty);
        const sellingPrice = normalizeNumber(item?.selling_price);
        const discountPercent = normalizeNumber(item?.item_discount_percent);
        const totalQty = qty + freeQty;

        return {
          productId: item?.product_id ?? "",
          qty,
          freeQty,
          totalQty,
          sellingPrice,
          discountPercent,
          cost: normalizeNumber(item?.product_cost)
        };
      }),
    [watchedItems]
  );
  const grandTotal = useMemo(
    () => itemSummaries.reduce((sum, item) => sum + item.qty * item.cost, 0),
    [itemSummaries]
  );
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 2 }).format(value);

  const handleAddItem = async () => {
    setAddAttempted(true);
    const isValid = await trigger([
      "draft.product_id",
      "draft.qty",
      "draft.selling_price",
      "draft.product_cost"
    ]);

    if (!isValid) return;

    const draft = getValues("draft");

    if (!draft.product_id) return;

    const sellingPrice = normalizeNumber(draft.selling_price);
    const discountPercent =
      discountInputMode === "amount"
        ? sellingPrice > 0
          ? Number(((normalizeNumber(draft.item_discount_amount) / sellingPrice) * 100).toFixed(4))
          : 0
        : normalizeNumber(draft.item_discount_percent);

    append({
      product_id: draft.product_id,
      qty: normalizeNumber(draft.qty) || 0,
      free_qty: normalizeNumber(draft.free_qty) || 0,
      product_cost: normalizeNumber(draft.product_cost) || 0,
      selling_price: normalizeNumber(draft.selling_price) || 0,
      item_discount_percent: discountPercent || 0,
      rep_sales_discount: normalizeNumber(draft.rep_sales_discount) || 0,
      rep_collection: normalizeNumber(draft.rep_collection) || 0
    });

    resetField("draft", {
      defaultValue: {
        product_id: "",
        qty: undefined,
        free_qty: undefined,
        product_cost: undefined,
        selling_price: undefined,
        item_discount_percent: undefined,
        item_discount_amount: undefined,
        rep_sales_discount: undefined,
        rep_collection: undefined
      }
    });
    setAddAttempted(false);
  };

  const handleResetDraft = () => {
    resetField("draft", {
      defaultValue: {
        product_id: "",
        qty: undefined,
        free_qty: undefined,
        product_cost: undefined,
        selling_price: undefined,
        item_discount_percent: undefined,
        item_discount_amount: undefined,
        rep_sales_discount: undefined,
        rep_collection: undefined
      }
    });
    setDiscountInputMode("percent");
    setAddAttempted(false);
  };

  const onSubmitInvalid = () => {
    if (formState.errors.invoice_number || formState.errors.supplier_name) {
      window.alert("Please enter invoice number and supplier name.");
    }
  };

  if (!isLoading && !permissions?.canManageReceiveNotes) {
    return (
      <section className="space-y-4">
        <PageHeader title="New GRN" description="You do not have permission to create GRN." />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader title="New GRN" description="Record supplier stock received into inventory." />

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit, onSubmitInvalid)}>
        <Card>
          <CardHeader>
            <CardTitle>Header</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Invoice number"
              {...register("invoice_number", { required: "Invoice number is required" })}
              className={cn(
                formState.submitCount > 0 && formState.errors.invoice_number
                  ? "border-red-400 focus:ring-red-400/40"
                  : ""
              )}
            />
            <div>
              <SearchableSelect
                value={watchedSupplierName ?? ""}
                options={supplierOptions}
                placeholder={isSuppliersLoading ? "Loading suppliers..." : "Select supplier"}
                disabled={isSuppliersLoading}
                className={cn(
                  formState.submitCount > 0 && formState.errors.supplier_name
                    ? "border-red-400 focus:ring-red-400/40"
                    : ""
                )}
                onChange={(value) => setValue("supplier_name", value, { shouldDirty: true })}
              />
              <input
                type="hidden"
                {...register("supplier_name", {
                  required: "Supplier name is required",
                  validate: (value) =>
                    supplierOptions.some((option) => option.value === value) || "Please select a supplier"
                })}
              />
            </div>
            <Input placeholder="Notes" {...register("notes")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-3 rounded-md border border-border p-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">{productSearchLabel}</label>
                  <SearchableSelect
                    value={watchedDraft?.product_id ?? ""}
                    options={productOptions}
                    placeholder={productSearchPlaceholder}
                    disabled={isProductsLoading}
                    searchMode={productSearchMode}
                    onCycleSearchMode={cycleProductSearchMode}
                    className={cn(
                      addAttempted && draftErrors?.product_id
                        ? "border-red-400 focus:ring-red-400/40"
                        : ""
                    )}
                    onChange={(value) => {
                      setValue("draft.product_id", value, { shouldDirty: true });
                      if (value) {
                        void applyProductDefaults(value);
                      }
                    }}
                  />
                  <input
                    type="hidden"
                    {...register("draft.product_id", {
                      validate: (value) =>
                        shouldValidateDraft() && !value ? "Product is required" : true
                    })}
                  />
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Qty</label>
                    <Input
                      type="number"
                      step="1"
                      placeholder="Qty"
                      onKeyDown={handleDraftFieldEnter}
                      {...register("draft.qty", {
                        validate: (value) =>
                          shouldValidateDraft() && value === undefined ? "Qty is required" : true,
                        setValueAs: (value) => (value === "" ? undefined : Number(value))
                      })}
                      className={cn(
                        addAttempted && draftErrors?.qty ? "border-red-400 focus:ring-red-400/40" : ""
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Free Qty</label>
                    <Input
                      type="number"
                      step="1"
                      placeholder="Free qty"
                      onKeyDown={handleDraftFieldEnter}
                      {...register("draft.free_qty", {
                        setValueAs: (value) => (value === "" ? undefined : Number(value))
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Cost</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Cost"
                    onKeyDown={handleDraftFieldEnter}
                    {...costField}
                    className={cn(
                      addAttempted && draftErrors?.product_cost ? "border-red-400 focus:ring-red-400/40" : ""
                    )}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Selling Price</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Selling price"
                    onKeyDown={handleDraftFieldEnter}
                    {...register("draft.selling_price", {
                      validate: (value) =>
                        shouldValidateDraft() && value === undefined
                          ? "Selling price is required"
                          : true,
                      setValueAs: (value) => (value === "" ? undefined : Number(value))
                    })}
                    className={cn(
                      addAttempted && draftErrors?.selling_price ? "border-red-400 focus:ring-red-400/40" : ""
                    )}
                  />
                </div>

                <div className="border-t border-dashed border-border" />

                <div className="grid gap-2 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Discount Type</label>
                    <Select
                      value={discountInputMode}
                      options={[
                        { value: "percent", label: "Percentage (%)" },
                        { value: "amount", label: "Amount" }
                      ]}
                      onChange={(event) => {
                        const nextMode = event.target.value as "percent" | "amount";
                        if (nextMode === "amount") {
                          const sellingPrice = normalizeNumber(getValues("draft.selling_price"));
                          const discountPercent = normalizeNumber(getValues("draft.item_discount_percent"));
                          const discountAmount =
                            sellingPrice > 0 ? Number(((sellingPrice * discountPercent) / 100).toFixed(2)) : undefined;
                          setValue("draft.item_discount_amount", discountAmount, { shouldDirty: true });
                        }
                        setDiscountInputMode(nextMode);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Discount {discountInputMode === "percent" ? "(%)" : "Amount"}
                    </label>
                    {discountInputMode === "percent" ? (
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Discount (%)"
                        onKeyDown={handleDraftFieldEnter}
                        {...register("draft.item_discount_percent", {
                          setValueAs: (value) => (value === "" ? undefined : Number(value))
                        })}
                      />
                    ) : (
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="Discount amount"
                        onKeyDown={handleDraftFieldEnter}
                        value={watchedDraft?.item_discount_amount ?? ""}
                        onChange={(event) => {
                          const amountText = event.target.value;
                          const parsedAmount = amountText === "" ? undefined : Number(amountText);
                          setValue("draft.item_discount_amount", parsedAmount, { shouldDirty: true });

                          const sellingPrice = normalizeNumber(getValues("draft.selling_price"));
                          const discountAmount =
                            parsedAmount !== undefined && Number.isFinite(parsedAmount) ? parsedAmount : 0;
                          const discountPercent =
                            sellingPrice > 0 ? Number(((discountAmount / sellingPrice) * 100).toFixed(4)) : 0;
                          setValue("draft.item_discount_percent", discountPercent, { shouldDirty: true });
                        }}
                      />
                    )}
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Sales Rep Discount</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Sales rep discount"
                      onKeyDown={handleDraftFieldEnter}
                      {...register("draft.rep_sales_discount", {
                        setValueAs: (value) => (value === "" ? undefined : Number(value))
                      })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Rep Collection Discount</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Sales rep collection discount"
                      onKeyDown={handleDraftFieldEnter}
                      {...register("draft.rep_collection", {
                        setValueAs: (value) => (value === "" ? undefined : Number(value))
                      })}
                    />
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <Button type="button" variant="outline" onClick={handleAddItem}>
                    Add Item
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleResetDraft}>
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-md border border-border p-4">
              <div className="text-sm font-semibold">Added products</div>
              {itemSummaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items added yet.</p>
              ) : (
                <div className="space-y-3">
                  {itemSummaries.map((item, index) => {
                    const productLabel =
                      productOptions.find((option) => option.value === item.productId)?.label ||
                      "Unknown product";

                    return (
                      <div key={`${item.productId}-${index}`} className="rounded-md border border-border p-3">
                        <div className="text-sm font-semibold">{productLabel}</div>
                        <div className="text-xs text-muted-foreground">
                          Qty: {item.qty} + Free: {item.freeQty} = {item.totalQty}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Selling: {item.sellingPrice} | Discount: {item.discountPercent}% | Cost: {item.cost}
                        </div>
                        <Button type="button" variant="ghost" onClick={() => remove(index)}>
                          Remove
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Add GRN"}
        </Button>
        <div className="text-right text-base font-semibold">Total Amount: {formatCurrency(grandTotal)}</div>
      </form>
    </section>
  );
}
