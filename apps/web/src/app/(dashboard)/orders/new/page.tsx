"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";

const orderItemSchema = z.object({
  product_id: z.string().min(1, "Product is required"),
  qty: z.coerce.number().positive(),
  unit_price: z.coerce.number().nonnegative()
});

const newOrderSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1)
});

type NewOrderInput = z.infer<typeof newOrderSchema>;

export default function NewOrderPage() {
  const { permissions, isLoading } = useCurrentUserPermissions();

  const {
    control,
    register,
    handleSubmit,
    formState: { isSubmitting }
  } = useForm<NewOrderInput>({
    resolver: zodResolver(newOrderSchema),
    defaultValues: {
      customer_id: "",
      notes: "",
      items: [{ product_id: "", qty: 1, unit_price: 0 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const onSubmit = async (values: NewOrderInput) => {
    console.log("new order payload", values);
  };

  if (!isLoading && !permissions?.canCreateOrders) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">New Order</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to create orders.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">New Order</h1>
        <p className="text-sm text-muted-foreground">Capture customer and product line items.</p>
      </header>

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Order Header</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Customer ID</label>
              <Input placeholder="Customer UUID" {...register("customer_id")} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Notes</label>
              <Input placeholder="Special instructions" {...register("notes")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ product_id: "", qty: 1, unit_price: 0 })}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Line
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-4">
                <Input placeholder="Product UUID" {...register(`items.${index}.product_id`)} />
                <Input type="number" step="0.01" placeholder="Qty" {...register(`items.${index}.qty`)} />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Unit Price"
                  {...register(`items.${index}.unit_price`)}
                />
                <Button type="button" variant="ghost" onClick={() => remove(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button type="submit" disabled={isSubmitting}>
          Save Order
        </Button>
      </form>
    </section>
  );
}