"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";

import { createInvoice } from "@/app/actions/invoices";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { Select } from "@/components/ui/select";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useProducts } from "@/hooks/useProducts";
import { useProductStockByPrice } from "@/hooks/useProductStockByPrice";
import { useCustomers } from "@/hooks/useCustomers";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type InvoiceForm = {
  customer_id: string;
  payment_method: "cash" | "credit";
  notes?: string;
  draft: {
    product_id: string;
    qty?: number;
    free_qty?: number;
    unit_price?: number;
    unit_cost?: number;
    discount_type?: "percent" | "amount";
    discount_value?: number;
  };
  items: Array<{
    product_id: string;
    qty: number;
    free_qty?: number;
    unit_price: number;
    unit_cost: number;
    discount_type?: "percent" | "amount";
    discount_value?: number;
  }>;
};

const emptyDraft = {
  product_id: "",
  qty: undefined,
  free_qty: undefined,
  unit_price: undefined,
  unit_cost: undefined,
  discount_type: "percent" as const,
  discount_value: undefined
};

export default function NewInvoicePage() {
  const router = useRouter();
  const { permissions, isLoading: isPermissionsLoading } = useCurrentUserPermissions();
  const { data: products, isLoading: isProductsLoading } = useProducts();
  const { data: customers, isLoading: isCustomersLoading } = useCustomers();

  const queryClient = useQueryClient();
  const [addAttempted, setAddAttempted] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    trigger,
    getValues,
    resetField,
    formState
  } = useForm<InvoiceForm>({
    defaultValues: {
      customer_id: "",
      payment_method: "credit",
      notes: "",
      draft: emptyDraft,
      items: []
    }
  });

  const watchedItems = useWatch({ control, name: "items" });
  const watchedCustomerId = useWatch({ control, name: "customer_id" });
  const watchedPaymentMethod = useWatch({ control, name: "payment_method" });
  const watchedDraft = useWatch({ control, name: "draft" });
  const draftErrors = formState.errors?.draft;

  const { data: stockByPrice, isLoading: isStockLoading } = useProductStockByPrice(watchedDraft?.product_id);

  const availableQty = useMemo(() => {
    if (!watchedDraft?.product_id) return null;
    if (isStockLoading || !stockByPrice || stockByPrice.length === 0) return 0;
    
    if (watchedDraft.unit_price !== undefined) {
      const bucket = stockByPrice.find((b) => b.selling_price === watchedDraft.unit_price);
      return bucket ? bucket.total_qty : 0;
    }
    
    return stockByPrice.reduce((sum, b) => sum + b.total_qty, 0);
  }, [stockByPrice, watchedDraft?.product_id, watchedDraft?.unit_price, isStockLoading]);

  const discountTypeOptions = useMemo(
    () => [
      { value: "percent", label: "%" },
      { value: "amount", label: "LKR" }
    ],
    []
  );

  const getDiscountPerUnit = useCallback((
    unitPrice: number,
    discountType: "percent" | "amount",
    discountValue: number
  ) => {
    if (!discountValue) return 0;
    if (discountType === "percent") return (unitPrice * discountValue) / 100;
    return discountValue;
  }, []);

  const shouldValidateDraft = () => addAttempted || Boolean(getValues("draft.product_id"));

  const productOptions = useMemo<SearchableSelectOption[]>(
    () =>
      (products ?? []).map((product) => ({
        value: product.id,
        label: `${product.name} · ${product.unit}`
      })),
    [products]
  );

  const customerOptions = useMemo<SearchableSelectOption[]>(
    () =>
      (customers ?? []).map((customer) => ({
        value: customer.id,
        label: `${customer.name} · ${customer.phone}`
      })),
    [customers]
  );

  const { append, remove, update } = useFieldArray({
    control,
    name: "items"
  });

  // When a product is selected in the draft and no price is set, determine price modal behavior
  useEffect(() => {
    if (watchedDraft?.product_id && watchedDraft?.unit_price === undefined && !isStockLoading) {
      if (stockByPrice && stockByPrice.length === 1) {
        const bucket = stockByPrice[0];
        setValue("draft.unit_price", bucket.selling_price, { shouldValidate: true, shouldDirty: true });
        setValue("draft.unit_cost", bucket.unit_cost);
        setIsPriceModalOpen(false);

        // Focus Qty field
        setTimeout(() => {
          const qtyInput = document.querySelector('input[name="draft.qty"]') as HTMLInputElement;
          if (qtyInput) {
            qtyInput.focus();
          }
        }, 0);
      } else if (stockByPrice) {
        setIsPriceModalOpen(true);
      }
    }
  }, [watchedDraft?.product_id, watchedDraft?.unit_price, isStockLoading, stockByPrice, setValue]);

  const hasDraftData = (draft: InvoiceForm["draft"]) =>
    Boolean(
      draft.product_id ||
      draft.qty ||
      draft.free_qty ||
      draft.unit_price ||
      draft.discount_value
    );

  const onSubmit = async (values: InvoiceForm) => {
    if (hasDraftData(values.draft)) {
      setAddAttempted(true);
      window.alert("Please add the pending item or reset the fields before saving the invoice.");
      return;
    }

    if (values.items.length === 0) {
      window.alert("Please add at least one item to the invoice.");
      return;
    }

    const result = await createInvoice({
      customer_id: values.customer_id,
      payment_method: values.payment_method,
      notes: values.notes?.trim() || undefined,
      items: values.items
    });

    if (!result.success) {
      toast({
        title: "Failed to create invoice",
        description: result.error || "Please try again.",
        variant: "error"
      });
      return;
    }

    toast({ title: "Invoice created successfully", variant: "success" });
    await queryClient.invalidateQueries({ queryKey: ["invoices"] });
    await queryClient.invalidateQueries({ queryKey: ["products"] });
    router.push("/invoices");
  };

  const handleAddItem = async () => {
    setAddAttempted(true);
    const isValid = await trigger([
      "draft.product_id",
      "draft.qty",
      "draft.unit_price",
      "draft.free_qty",
      "draft.discount_value",
      "draft.discount_type"
    ]);

    if (!isValid) return;

    const draft = getValues("draft");
    if (!draft.product_id) return;

    const draftQty = Number(draft.qty) || 0;
    const draftFreeQty = Number(draft.free_qty) || 0;
    const draftPrice = Number(draft.unit_price) || 0;
    const draftCost = Number(draft.unit_cost) || 0;
    const draftDiscountType = draft.discount_type || "percent";
    const draftDiscountValue = Number(draft.discount_value) || 0;
    const discountPerUnit = getDiscountPerUnit(draftPrice, draftDiscountType, draftDiscountValue);
    const effectiveUnitPrice = draftPrice - discountPerUnit;

    if (draftFreeQty < 0) {
      window.alert("Free qty cannot be negative.");
      return;
    }

    if (draftDiscountValue < 0) {
      window.alert("Discount cannot be negative.");
      return;
    }

    if (draftDiscountType === "percent" && draftDiscountValue > 100) {
      window.alert("Discount percent cannot exceed 100%.");
      return;
    }

    if (discountPerUnit > draftPrice) {
      window.alert("Discount cannot exceed the unit price.");
      return;
    }

    if (effectiveUnitPrice < draftCost) {
      window.alert("Cannot bill undercost. The entered unit price is below the registered cost for this product bucket.");
      return;
    }

    const existingIndex = watchedItems.findIndex(
      (item) =>
        item.product_id === draft.product_id &&
        item.unit_price === draftPrice &&
        (item.discount_type || "percent") === draftDiscountType &&
        Number(item.discount_value) === draftDiscountValue
    );

    if (editingIndex !== null) {
      const mergeIndex = watchedItems.findIndex(
        (item, index) =>
          index !== editingIndex &&
          item.product_id === draft.product_id &&
          item.unit_price === draftPrice &&
          (item.discount_type || "percent") === draftDiscountType &&
          Number(item.discount_value) === draftDiscountValue
      );

      if (mergeIndex >= 0) {
        update(mergeIndex, {
          ...watchedItems[mergeIndex],
          qty: watchedItems[mergeIndex].qty + draftQty,
          free_qty: (Number(watchedItems[mergeIndex].free_qty) || 0) + draftFreeQty
        });
        remove(editingIndex);
      } else {
        update(editingIndex, {
          product_id: draft.product_id,
          qty: draftQty,
          free_qty: draftFreeQty,
          unit_price: draftPrice,
          unit_cost: draftCost,
          discount_type: draftDiscountType,
          discount_value: draftDiscountValue
        });
      }
      setEditingIndex(null);
    } else if (existingIndex >= 0) {
      update(existingIndex, {
        ...watchedItems[existingIndex],
        qty: watchedItems[existingIndex].qty + draftQty,
        free_qty: (Number(watchedItems[existingIndex].free_qty) || 0) + draftFreeQty
      });
    } else {
      append({
        product_id: draft.product_id,
        qty: draftQty,
        free_qty: draftFreeQty,
        unit_price: draftPrice,
        unit_cost: draftCost,
        discount_type: draftDiscountType,
        discount_value: draftDiscountValue
      });
    }

    resetField("draft", { defaultValue: emptyDraft });
    setAddAttempted(false);
  };

  const handleEditItem = (index: number) => {
    if (hasDraftData(getValues("draft"))) {
      window.alert("Please add the pending item or reset the fields before editing an added item.");
      return;
    }

    const item = watchedItems[index];
    if (!item) return;

    setValue("draft.product_id", item.product_id, { shouldDirty: true });
    setValue("draft.qty", item.qty, { shouldDirty: true });
    setValue("draft.free_qty", item.free_qty || 0, { shouldDirty: true });
    setValue("draft.unit_price", item.unit_price, { shouldDirty: true });
    setValue("draft.unit_cost", item.unit_cost, { shouldDirty: true });
    setValue("draft.discount_type", item.discount_type || "percent", { shouldDirty: true });
    setValue("draft.discount_value", item.discount_value || 0, { shouldDirty: true });
    setEditingIndex(index);
  };

  const handleCancelEdit = () => {
    resetField("draft", { defaultValue: emptyDraft });
    setEditingIndex(null);
    setAddAttempted(false);
  };

  const handleRemoveItem = (index: number) => {
    remove(index);
    if (editingIndex === index) {
      handleCancelEdit();
    } else if (editingIndex !== null && index < editingIndex) {
      setEditingIndex(editingIndex - 1);
    }
  };

  const onSubmitInvalid = () => {
    if (formState.errors.customer_id) {
      window.alert("Please select a customer.");
    }
  };

  const itemSummaries = useMemo(
    () =>
      (watchedItems ?? []).map((item) => {
        const qty = Number(item?.qty) || 0;
        const freeQty = Number(item?.free_qty) || 0;
        const unitPrice = Number(item?.unit_price) || 0;
        const discountType = item?.discount_type || "percent";
        const discountValue = Number(item?.discount_value) || 0;
        const discountPerUnit = getDiscountPerUnit(unitPrice, discountType, discountValue);
        const effectiveUnitPrice = unitPrice - discountPerUnit;
        const total = qty * Math.max(0, effectiveUnitPrice);
        return {
          productId: item?.product_id ?? "",
          qty,
          freeQty,
          unitPrice,
          discountType,
          discountValue,
          total
        };
      }),
    [getDiscountPerUnit, watchedItems]
  );

  const grandTotal = itemSummaries.reduce((sum, item) => sum + item.total, 0);

  if (isPermissionsLoading) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">New Invoice</h1>
        <p className="text-sm text-muted-foreground">Loading permissions...</p>
      </section>
    );
  }

  if (!permissions?.canCreateInvoices) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">New Invoice</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to create invoices.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6 w-full max-w-6xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold">New Invoice</h1>
        <p className="text-sm text-muted-foreground">Create a direct invoice for a customer.</p>
      </header>

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit, onSubmitInvalid)}>
        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Invoice Number</label>
              <Input disabled value="Auto-generated upon save" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Customer</label>
              <SearchableSelect
                value={watchedCustomerId ?? ""}
                options={customerOptions}
                placeholder={isCustomersLoading ? "Loading customers..." : "Select customer"}
                disabled={isCustomersLoading}
                className={cn(
                  formState.submitCount > 0 && formState.errors.customer_id
                    ? "border-red-400 focus:ring-red-400/40"
                    : ""
                )}
                onChange={(value) => setValue("customer_id", value, { shouldDirty: true })}
              />
              <input
                type="hidden"
                {...register("customer_id", {
                  required: "Customer is required",
                  validate: (value) =>
                    customerOptions.some((option) => option.value === value) || "Please select a customer"
                })}
              />
            </div>

            <div className="space-y-1 md:col-span-1">
              <label className="text-xs font-semibold text-muted-foreground">Payment Method</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={watchedPaymentMethod === "credit" ? "default" : "outline"}
                  onClick={() => setValue("payment_method", "credit", { shouldDirty: true })}
                >
                  Credit
                </Button>
                <Button
                  type="button"
                  variant={watchedPaymentMethod === "cash" ? "default" : "outline"}
                  onClick={() => setValue("payment_method", "cash", { shouldDirty: true })}
                >
                  Cash
                </Button>
              </div>
              <input type="hidden" {...register("payment_method")} />
            </div>

            <div className="space-y-1 md:col-span-1">
              <label className="text-xs font-semibold text-muted-foreground">Notes</label>
              <Input
                placeholder="Add invoice notes (optional)"
                {...register("notes")}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="space-y-3">
              <div className="space-y-3 rounded-md border border-border p-4">
                {editingIndex !== null && (
                  <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                    <div className="text-xs font-semibold text-primary">Editing item #{editingIndex + 1}</div>
                    <Button type="button" size="sm" variant="ghost" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Product</label>
                  <SearchableSelect
                    value={watchedDraft?.product_id ?? ""}
                    options={productOptions}
                    placeholder={isProductsLoading ? "Loading products..." : "Select product"}
                    disabled={isProductsLoading}
                    className={cn(
                      addAttempted && draftErrors?.product_id
                        ? "border-red-400 focus:ring-red-400/40"
                        : ""
                    )}
                    onChange={(value) => setValue("draft.product_id", value, { shouldDirty: true })}
                  />
                  <input
                    type="hidden"
                    {...register("draft.product_id", {
                      validate: (value) => (shouldValidateDraft() && !value ? "Product is required" : true)
                    })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-muted-foreground">Qty</label>
                      {availableQty !== null && (
                        <span className="text-[10px] text-muted-foreground font-medium">Available: {availableQty}</span>
                      )}
                    </div>
                    <Input
                      type="number"
                      step="1"
                      placeholder="Qty"
                      {...register("draft.qty", {
                        validate: (value) =>
                          shouldValidateDraft() && (value === undefined || value <= 0) ? "Qty is required" : true,
                        setValueAs: (value) => (value === "" ? undefined : Number(value))
                      })}
                      className={cn(addAttempted && draftErrors?.qty ? "border-red-400 focus:ring-red-400/40" : "")}
                    />
                  </div>

                    <div className="space-y-1 relative">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-muted-foreground">Free Qty</label>
                      <span className="text-[10px] text-transparent select-none">Available: 0</span>
                    </div>
                    <Input
                      type="number"
                      step="1"
                      placeholder="Free"
                      {...register("draft.free_qty", {
                        validate: (value) => (value === undefined || value >= 0 ? true : "Free qty must be 0 or more"),
                        setValueAs: (value) => (value === "" ? undefined : Number(value))
                      })}
                      className={cn(addAttempted && draftErrors?.free_qty ? "border-red-400 focus:ring-red-400/40" : "")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1 relative">
                    <label className="text-xs font-semibold text-muted-foreground">Unit Price</label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="1"
                        placeholder="Price"
                        {...register("draft.unit_price", {
                          validate: (value) =>
                            shouldValidateDraft() && (value === undefined || value < 0) ? "Price is required" : true,
                          setValueAs: (value) => (value === "" ? undefined : Number(value))
                        })}
                        className={cn(addAttempted && draftErrors?.unit_price ? "border-red-400 focus:ring-red-400/40" : "", "pr-20")}
                      />
                      {watchedDraft?.product_id && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1 h-8 px-2 text-xs text-primary"
                          onClick={() => setIsPriceModalOpen(true)}
                        >
                          Buckets
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Discount</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0"
                        {...register("draft.discount_value", {
                          validate: (value) => (value === undefined || value >= 0 ? true : "Discount must be 0 or more"),
                          setValueAs: (value) => (value === "" ? undefined : Number(value))
                        })}
                        className={cn(addAttempted && draftErrors?.discount_value ? "border-red-400 focus:ring-red-400/40" : "")}
                      />
                      <Select
                        {...register("draft.discount_type")}
                        options={discountTypeOptions}
                        className="w-24"
                      />
                    </div>
                  </div>
                </div>

                <Dialog
                  open={isPriceModalOpen}
                  onOpenChange={setIsPriceModalOpen}
                  title="Select Price Bucket"
                >
                  <div className="py-2">
                    {isStockLoading ? (
                      <p className="text-sm text-muted-foreground">Loading stock details...</p>
                    ) : !stockByPrice || stockByPrice.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No receive history found for this product.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {stockByPrice.map((bucket) => (
                          <button
                            key={bucket.selling_price}
                            type="button"
                            onClick={() => {
                              setValue("draft.unit_price", bucket.selling_price, { shouldValidate: true, shouldDirty: true });
                              setValue("draft.unit_cost", bucket.unit_cost);
                              setIsPriceModalOpen(false);

                              // Focus Qty field
                              setTimeout(() => {
                                const qtyInput = document.querySelector('input[name="draft.qty"]') as HTMLInputElement;
                                if (qtyInput) {
                                  qtyInput.focus();
                                }
                              }, 0);
                            }}
                            className="flex flex-col items-start px-4 py-3 border rounded-lg bg-muted/20 hover:bg-muted/60 transition text-left"
                          >
                            <span className="font-semibold text-primary text-base">LKR {bucket.selling_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            <span className="text-xs text-muted-foreground mt-1">Stock Received: {bucket.total_qty}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Dialog>

                <Button type="button" variant="outline" onClick={handleAddItem}>
                  Add Item
                </Button>
              </div>
            </div>

            <div className="space-y-3 rounded-md border border-border p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Added products</div>
                <div className="text-sm font-bold text-primary">
                  Total: LKR {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              {itemSummaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items added yet.</p>
              ) : (
                <div className="space-y-3">
                  {itemSummaries.map((item, index) => {
                    const productLabel =
                      productOptions.find((option) => option.value === item.productId)?.label ||
                      "Unknown product";

                    return (
                        <div
                          key={`${item.productId}-${index}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleEditItem(index)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleEditItem(index);
                            }
                          }}
                          className={cn(
                            "rounded-md border border-border p-3 flex flex-col gap-2 transition hover:bg-muted/40",
                            editingIndex === index ? "border-primary/60 bg-primary/5" : "cursor-pointer"
                          )}
                        >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-sm font-semibold">{productLabel}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {item.qty} x LKR {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              {item.freeQty > 0 ? ` · Free ${item.freeQty}` : ""}
                              {item.discountValue > 0
                                ? ` · Discount ${
                                    item.discountType === "percent"
                                      ? `${item.discountValue}%`
                                      : `LKR ${item.discountValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                                  }`
                                : ""}
                            </div>
                          </div>
                          <div className="text-sm font-semibold">
                            LKR {item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                          <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 text-red-500 hover:text-red-600 hover:bg-transparent"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRemoveItem(index);
                              }}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? "Saving..." : "Save Invoice"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}
