"use client";

import { useMemo } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useProducts } from "@/hooks/useProducts";

type ReceiveNoteForm = {
  invoice_number: string;
  supplier_name: string;
  notes: string;
  items: Array<{
    product_id: string;
    qty: number;
    product_cost: number;
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
          product_cost: 0,
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
    console.log("new receive note payload", values);
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
          <CardContent className="space-y-3">
            <div className="hidden gap-2 text-xs font-semibold text-muted-foreground md:grid md:grid-cols-12">
              <div className="md:col-span-4">Product</div>
              <div className="md:col-span-1">Qty</div>
              <div className="md:col-span-2">Product cost</div>
              <div className="md:col-span-2">Item discount price</div>
              <div className="md:col-span-2">Sales discount for rep</div>
              <div className="md:col-span-1">Collection for rep</div>
            </div>
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-12">
                <div className="md:col-span-4">
                  <SearchableSelect
                    value={watchedItems?.[index]?.product_id ?? ""}
                    options={productOptions}
                    placeholder={isProductsLoading ? "Loading products..." : "Select product"}
                    disabled={isProductsLoading}
                    onChange={(value) => setValue(`items.${index}.product_id`, value)}
                  />
                </div>
                <Input
                  className="md:col-span-1"
                  type="number"
                  step="0.01"
                  placeholder="Qty"
                  {...register(`items.${index}.qty`)}
                />
                <Input
                  className="md:col-span-2"
                  type="number"
                  step="0.01"
                  placeholder="Product cost"
                  {...register(`items.${index}.product_cost`)}
                />
                <Input
                  className="md:col-span-2"
                  type="number"
                  step="0.01"
                  placeholder="Item discount price"
                  {...register(`items.${index}.item_discount_price`)}
                />
                <Input
                  className="md:col-span-2"
                  type="number"
                  step="0.01"
                  placeholder="Sales discount for rep"
                  {...register(`items.${index}.rep_sales_discount`)}
                />
                <Input
                  className="md:col-span-1"
                  type="number"
                  step="0.01"
                  placeholder="Collection for rep"
                  {...register(`items.${index}.rep_collection`)}
                />
                <Button type="button" variant="ghost" onClick={() => remove(index)}>
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                append({
                  product_id: "",
                  qty: 1,
                  product_cost: 0,
                  item_discount_price: 0,
                  rep_sales_discount: 0,
                  rep_collection: 0
                })
              }
            >
              Add Item
            </Button>
          </CardContent>
        </Card>

        <Button type="submit">Add GRN</Button>
      </form>
    </section>
  );
}