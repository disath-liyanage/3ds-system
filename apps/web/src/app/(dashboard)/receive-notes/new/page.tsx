"use client";

import { useMemo } from "react";
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
  items: Array<{
    product_id: string;
    qty: number;
    free_qty: number;
    product_cost: number;
    selling_price: number;
    item_discount_price: number;
    rep_sales_discount: number;
    rep_collection: number;
  }>;
};

export default function NewReceiveNotePage() {
  const { permissions, isLoading } = useCurrentUserPermissions();
  const { data: products, isLoading: isProductsLoading } = useProducts();
  const { control, register, handleSubmit, setValue } = useForm<ReceiveNoteForm>({
    defaultValues: {
      invoice_number: "",
      supplier_name: "",
      notes: "",
      items: [
        {
          product_id: "",
          qty: 1,
          free_qty: 0,
          product_cost: 0,
          selling_price: 0,
          item_discount_price: 0,
          rep_sales_discount: 0,
          rep_collection: 0
        }
      ]
    }
  });

  const watchedItems = useWatch({ control, name: "items" });

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
    const result = await createReceiveNote(values);
    if (!result.success) {
      console.error("Failed to create GRN", result.error);
    }
  };

  const normalizeNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const itemSummaries = useMemo(
    () =>
      (watchedItems ?? []).map((item) => {
        const qty = normalizeNumber(item?.qty);
        const freeQty = normalizeNumber(item?.free_qty);
        const sellingPrice = normalizeNumber(item?.selling_price);
        const discount = normalizeNumber(item?.item_discount_price);
        const unitCost = Math.max(sellingPrice - discount, 0);
        const totalQty = qty + freeQty;

        return {
          productId: item?.product_id ?? "",
          qty,
          freeQty,
          totalQty,
          sellingPrice,
          discount,
          unitCost
        };
      }),
    [watchedItems]
  );

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
          <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="space-y-3">
              {fields.map((field, index) => {
                const summary = itemSummaries[index];
                const unitCost = summary?.unitCost ?? 0;

                return (
                  <div key={field.id} className="space-y-3 rounded-md border border-border p-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Product</label>
                      <SearchableSelect
                        value={watchedItems?.[index]?.product_id ?? ""}
                        options={productOptions}
                        placeholder={isProductsLoading ? "Loading products..." : "Select product"}
                        disabled={isProductsLoading}
                        onChange={(value) => setValue(`items.${index}.product_id`, value)}
                      />
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <Input
                        type="number"
                        step="1"
                        placeholder="Qty"
                        {...register(`items.${index}.qty`, { valueAsNumber: true })}
                      />
                      <Input
                        type="number"
                        step="1"
                        placeholder="Free qty"
                        {...register(`items.${index}.free_qty`, { valueAsNumber: true })}
                      />
                    </div>

                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Cost"
                      {...register(`items.${index}.product_cost`, { valueAsNumber: true })}
                    />

                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Selling price"
                      {...register(`items.${index}.selling_price`, { valueAsNumber: true })}
                    />

                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Discount price if available"
                      {...register(`items.${index}.item_discount_price`, { valueAsNumber: true })}
                    />

                    <Input
                      readOnly
                      value={unitCost}
                      placeholder="Unit cost"
                      className="bg-muted/40"
                    />

                    <div className="grid gap-2 md:grid-cols-2">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Sales rep discount"
                        {...register(`items.${index}.rep_sales_discount`, { valueAsNumber: true })}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Sales rep collection discount"
                        {...register(`items.${index}.rep_collection`, { valueAsNumber: true })}
                      />
                    </div>

                    <Button type="button" variant="ghost" onClick={() => remove(index)}>
                      Remove
                    </Button>
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  append({
                    product_id: "",
                    qty: 1,
                    free_qty: 0,
                    product_cost: 0,
                    selling_price: 0,
                    item_discount_price: 0,
                    rep_sales_discount: 0,
                    rep_collection: 0
                  })
                }
              >
                Add Item
              </Button>
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
                          Selling: {item.sellingPrice} | Discount: {item.discount} | Unit cost: {item.unitCost}
                        </div>
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