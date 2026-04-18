"use client";

import { useFieldArray, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ReceiveNoteForm = {
  supplier_name: string;
  notes: string;
  items: Array<{
    product_id: string;
    qty: number;
    unit_cost: number;
  }>;
};

export default function NewReceiveNotePage() {
  const { control, register, handleSubmit } = useForm<ReceiveNoteForm>({
    defaultValues: {
      supplier_name: "",
      notes: "",
      items: [{ product_id: "", qty: 1, unit_cost: 0 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const onSubmit = async (values: ReceiveNoteForm) => {
    console.log("new receive note payload", values);
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">New Receive Note</h1>
        <p className="text-sm text-muted-foreground">Record supplier stock received into inventory.</p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Header</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Input placeholder="Supplier name" {...register("supplier_name")} />
            <Input placeholder="Notes" {...register("notes")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-4">
                <Input placeholder="Product UUID" {...register(`items.${index}.product_id`)} />
                <Input type="number" step="0.01" placeholder="Qty" {...register(`items.${index}.qty`)} />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Unit Cost"
                  {...register(`items.${index}.unit_cost`)}
                />
                <Button type="button" variant="ghost" onClick={() => remove(index)}>
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => append({ product_id: "", qty: 1, unit_cost: 0 })}
            >
              Add Item
            </Button>
          </CardContent>
        </Card>

        <Button type="submit">Save Receive Note</Button>
      </form>
    </section>
  );
}