"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { createReceiveNote } from "@/app/actions/receive-notes";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useProducts } from "@/hooks/useProducts";

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

export default function NewReceiveNotePage() {
  const { permissions, isLoading } = useCurrentUserPermissions();
  const { data: products, isLoading: isProductsLoading } = useProducts();
  const costInputRef = useRef<HTMLInputElement | null>(null);
  const lastDiscountRef = useRef<number>(0);
  const { control, register, handleSubmit, setValue, trigger, getValues, resetField } =
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
        rep_sales_discount: undefined,
        rep_collection: undefined
      },
      items: []
    }
  });

  const watchedItems = useWatch({ control, name: "items" });
  const watchedDraft = useWatch({ control, name: "draft" });

  const productOptions = useMemo<SearchableSelectOption[]>(
    () =>
      (products ?? []).map((product) => ({
        value: product.id,
        label: `${product.name} · ${product.unit}`
      })),
    [products]
  );

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const onSubmit = async (values: ReceiveNoteForm) => {
    const result = await createReceiveNote({
      invoice_number: values.invoice_number,
      supplier_name: values.supplier_name,
      notes: values.notes,
      items: values.items
    });
    if (!result.success) {
      console.error("Failed to create GRN", result.error);
    }
  };

  const normalizeNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  useEffect(() => {
    const sellingPrice = normalizeNumber(watchedDraft?.selling_price);
    const discountPercent = normalizeNumber(watchedDraft?.item_discount_percent);
    const isDiscountApplied = discountPercent > 0 && sellingPrice > 0;

    if (isDiscountApplied && discountPercent !== lastDiscountRef.current) {
      const calculatedCost = sellingPrice - (sellingPrice * discountPercent) / 100;
      setValue("draft.product_cost", Number(calculatedCost.toFixed(2)), { shouldDirty: true });
      costInputRef.current?.focus();
    }

    lastDiscountRef.current = discountPercent;
  }, [setValue, watchedDraft?.item_discount_percent, watchedDraft?.selling_price]);

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

  const handleAddItem = async () => {
    const isValid = await trigger([
      "draft.product_id",
      "draft.qty",
      "draft.selling_price",
      "draft.product_cost"
    ]);

    if (!isValid) return;

    const draft = getValues("draft");

    if (!draft.product_id) return;

    append({
      product_id: draft.product_id,
      qty: normalizeNumber(draft.qty) || 0,
      free_qty: normalizeNumber(draft.free_qty) || 0,
      product_cost: normalizeNumber(draft.product_cost) || 0,
      selling_price: normalizeNumber(draft.selling_price) || 0,
      item_discount_percent: normalizeNumber(draft.item_discount_percent) || 0,
      rep_sales_discount: normalizeNumber(draft.rep_sales_discount) || 0,
      rep_collection: normalizeNumber(draft.rep_collection) || 0
    });

    resetField("draft.product_id");
    resetField("draft.qty");
    resetField("draft.free_qty");
    resetField("draft.product_cost");
    resetField("draft.selling_price");
    resetField("draft.item_discount_percent");
    resetField("draft.rep_sales_discount");
    resetField("draft.rep_collection");
  };

  if (!isLoading && !permissions?.canManageReceiveNotes) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">New GRN</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to create GRN.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">New GRN</h1>
        <p className="text-sm text-muted-foreground">Record supplier stock received into inventory.</p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Header</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Input placeholder="Invoice number" {...register("invoice_number")} />
            <Input placeholder="Supplier name" {...register("supplier_name")} />
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
                  <label className="text-xs font-semibold text-muted-foreground">Product</label>
                  <SearchableSelect
                    value={watchedDraft?.product_id ?? ""}
                    options={productOptions}
                    placeholder={isProductsLoading ? "Loading products..." : "Select product"}
                    disabled={isProductsLoading}
                    onChange={(value) => setValue("draft.product_id", value, { shouldDirty: true })}
                  />
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <Input
                    type="number"
                    step="1"
                    placeholder="Qty"
                    {...register("draft.qty", {
                      required: "Qty is required",
                      setValueAs: (value) => (value === "" ? undefined : Number(value))
                    })}
                  />
                  <Input
                    type="number"
                    step="1"
                    placeholder="Free qty"
                    {...register("draft.free_qty", {
                      setValueAs: (value) => (value === "" ? undefined : Number(value))
                    })}
                  />
                </div>

                <Input
                  ref={costInputRef}
                  type="number"
                  step="0.01"
                  placeholder="Cost"
                  {...register("draft.product_cost", {
                    required: "Cost is required",
                    setValueAs: (value) => (value === "" ? undefined : Number(value))
                  })}
                />

                <Input
                  type="number"
                  step="0.01"
                  placeholder="Selling price"
                  {...register("draft.selling_price", {
                    required: "Selling price is required",
                    setValueAs: (value) => (value === "" ? undefined : Number(value))
                  })}
                />

                <div className="border-t border-dashed border-border" />

                <Input
                  type="number"
                  step="0.01"
                  placeholder="Discount (%)"
                  {...register("draft.item_discount_percent", {
                    setValueAs: (value) => (value === "" ? undefined : Number(value))
                  })}
                />

                <div className="grid gap-2 md:grid-cols-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Sales rep discount"
                    {...register("draft.rep_sales_discount", {
                      setValueAs: (value) => (value === "" ? undefined : Number(value))
                    })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Sales rep collection discount"
                    {...register("draft.rep_collection", {
                      setValueAs: (value) => (value === "" ? undefined : Number(value))
                    })}
                  />
                </div>

                <Button type="button" variant="outline" onClick={handleAddItem}>
                  Add Item
                </Button>
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

        <Button type="submit">Add GRN</Button>
      </form>
    </section>
  );
}