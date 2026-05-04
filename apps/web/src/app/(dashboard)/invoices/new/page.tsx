"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { createInvoice } from "@/app/actions/invoices";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useProducts } from "@/hooks/useProducts";
import { useCustomers } from "@/hooks/useCustomers";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type InvoiceForm = {
  customer_id: string;
  payment_method: "cash" | "credit";
  draft: {
    product_id: string;
    qty?: number;
    unit_price?: number;
  };
  items: Array<{
    product_id: string;
    qty: number;
    unit_price: number;
  }>;
};

const emptyDraft = {
  product_id: "",
  qty: undefined,
  unit_price: undefined
};

export default function NewInvoicePage() {
  const router = useRouter();
  const { permissions, isLoading: isPermissionsLoading } = useCurrentUserPermissions();
  const { data: products, isLoading: isProductsLoading } = useProducts();
  const { data: customers, isLoading: isCustomersLoading } = useCustomers();
  
  const [addAttempted, setAddAttempted] = useState(false);

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
      draft: emptyDraft,
      items: []
    }
  });

  const watchedItems = useWatch({ control, name: "items" });
  const watchedCustomerId = useWatch({ control, name: "customer_id" });
  const watchedDraft = useWatch({ control, name: "draft" });
  const draftErrors = formState.errors?.draft;

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

  const { append, remove } = useFieldArray({
    control,
    name: "items"
  });

  // When a product is selected in the draft, automatically fill in its default selling price
  useEffect(() => {
    const productId = watchedDraft?.product_id;
    if (!productId) return;

    const product = products?.find((p) => p.id === productId);
    if (product && watchedDraft.unit_price === undefined) {
      setValue("draft.unit_price", Number(product.price), { shouldDirty: true });
    }
  }, [watchedDraft?.product_id, products, setValue, watchedDraft?.unit_price]);

  const hasDraftData = (draft: InvoiceForm["draft"]) =>
    Boolean(draft.product_id || draft.qty || draft.unit_price);

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
    router.push("/invoices");
  };

  const handleAddItem = async () => {
    setAddAttempted(true);
    const isValid = await trigger(["draft.product_id", "draft.qty", "draft.unit_price"]);

    if (!isValid) return;

    const draft = getValues("draft");
    if (!draft.product_id) return;

    append({
      product_id: draft.product_id,
      qty: Number(draft.qty) || 0,
      unit_price: Number(draft.unit_price) || 0
    });

    resetField("draft", { defaultValue: emptyDraft });
    setAddAttempted(false);
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
        const unitPrice = Number(item?.unit_price) || 0;
        const total = qty * unitPrice;
        return {
          productId: item?.product_id ?? "",
          qty,
          unitPrice,
          total
        };
      }),
    [watchedItems]
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
    <section className="space-y-6 max-w-4xl">
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

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground">Payment Method</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="credit"
                    {...register("payment_method")}
                    className="accent-primary"
                  />
                  <span className="text-sm">Credit</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="cash"
                    {...register("payment_method")}
                    className="accent-primary"
                  />
                  <span className="text-sm">Cash</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-border p-4 bg-muted/20">
              <div className="grid gap-3 md:grid-cols-4 items-end">
                <div className="space-y-1 md:col-span-2">
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

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Qty</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Qty"
                    {...register("draft.qty", {
                      validate: (value) =>
                        shouldValidateDraft() && (value === undefined || value <= 0) ? "Qty is required" : true,
                      setValueAs: (value) => (value === "" ? undefined : Number(value))
                    })}
                    className={cn(addAttempted && draftErrors?.qty ? "border-red-400 focus:ring-red-400/40" : "")}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Unit Price</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Price"
                    {...register("draft.unit_price", {
                      validate: (value) =>
                        shouldValidateDraft() && (value === undefined || value < 0) ? "Price is required" : true,
                      setValueAs: (value) => (value === "" ? undefined : Number(value))
                    })}
                    className={cn(addAttempted && draftErrors?.unit_price ? "border-red-400 focus:ring-red-400/40" : "")}
                  />
                </div>
              </div>
              <div className="mt-3">
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  Add Item
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Added Items</h3>
              {itemSummaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items added yet.</p>
              ) : (
                <div className="border rounded-md divide-y">
                  {itemSummaries.map((item, index) => {
                    const productLabel =
                      productOptions.find((option) => option.value === item.productId)?.label ||
                      "Unknown product";

                    return (
                      <div key={`${item.productId}-${index}`} className="p-3 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{productLabel}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.qty} x LKR {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm font-semibold">
                            LKR {item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => remove(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="p-4 bg-muted/10 flex justify-between items-center font-bold">
                    <span>Grand Total:</span>
                    <span className="text-lg">LKR {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
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
