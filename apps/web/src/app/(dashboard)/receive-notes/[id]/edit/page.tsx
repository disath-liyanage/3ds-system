"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { deleteReceiveNote, updateReceiveNote } from "@/app/actions/receive-notes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useProducts } from "@/hooks/useProducts";
import { useReceiveNote } from "@/hooks/useReceiveNote";
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

const emptyDraft = {
  product_id: "",
  qty: undefined,
  free_qty: undefined,
  product_cost: undefined,
  selling_price: undefined,
  item_discount_percent: undefined,
  rep_sales_discount: undefined,
  rep_collection: undefined
};

export default function EditReceiveNotePage() {
  const router = useRouter();
  const params = useParams();
  const receiveNoteId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { permissions, isLoading } = useCurrentUserPermissions();
  const { data: products, isLoading: isProductsLoading } = useProducts();
  const { data: suppliers, isLoading: isSuppliersLoading } = useSuppliers();
  const {
    data: receiveNote,
    isLoading: isReceiveNoteLoading,
    isError: isReceiveNoteError
  } = useReceiveNote(receiveNoteId);
  const costInputRef = useRef<HTMLInputElement | null>(null);
  const lastDiscountRef = useRef<number>(0);
  const productDefaultsRef = useRef(
    new Map<
      string,
      {
        sellingPrice?: number;
        cost?: number;
        discountPercent?: number;
        repSalesDiscount?: number;
        repCollection?: number;
      }
    >()
  );
  const [addAttempted, setAddAttempted] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    setValue,
    trigger,
    getValues,
    resetField,
    formState,
    reset
  } = useForm<ReceiveNoteForm>({
    defaultValues: {
      invoice_number: "",
      supplier_name: "",
      notes: "",
      draft: emptyDraft,
      items: []
    }
  });

  const watchedItems = useWatch({ control, name: "items" });
  const watchedSupplierName = useWatch({ control, name: "supplier_name" });
  const watchedDraft = useWatch({ control, name: "draft" });
  const draftErrors = formState.errors?.draft;
  const shouldValidateDraft = () => addAttempted || Boolean(getValues("draft.product_id"));
  const costField = register("draft.product_cost", {
    validate: (value) => (shouldValidateDraft() && value === undefined ? "Cost is required" : true),
    setValueAs: (value) => (value === "" ? undefined : Number(value))
  });

  const productOptions = useMemo<SearchableSelectOption[]>(
    () =>
      (products ?? []).map((product) => ({
        value: product.id,
        label: `${product.name} · ${product.unit}`
      })),
    [products]
  );

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

  useEffect(() => {
    if (!receiveNote) return;

    reset({
      invoice_number: receiveNote.invoice_number ?? "",
      supplier_name: receiveNote.supplier_name ?? "",
      notes: receiveNote.notes ?? "",
      draft: emptyDraft,
      items: (receiveNote.receive_note_items ?? []).map((item) => ({
        product_id: item.product_id,
        qty: Number(item.qty) || 0,
        free_qty: Number(item.free_qty) || 0,
        product_cost: Number(item.unit_cost) || 0,
        selling_price: Number(item.selling_price) || 0,
        item_discount_percent: Number(item.item_discount_percent) || 0,
        rep_sales_discount: Number(item.rep_sales_discount) || 0,
        rep_collection: Number(item.rep_collection) || 0
      }))
    });
    setAddAttempted(false);
  }, [receiveNote, reset]);

  const hasDraftData = (draft: ReceiveNoteForm["draft"]) =>
    Boolean(
      draft.product_id ||
        draft.qty ||
        draft.free_qty ||
        draft.product_cost ||
        draft.selling_price ||
        draft.item_discount_percent ||
        draft.rep_sales_discount ||
        draft.rep_collection
    );

  const onSubmit = async (values: ReceiveNoteForm) => {
    if (!receiveNoteId) return;

    if (hasDraftData(values.draft)) {
      setAddAttempted(true);
      window.alert("Please add the item or reset the fields before submitting.");
      return;
    }

    const result = await updateReceiveNote(receiveNoteId, {
      invoice_number: values.invoice_number,
      supplier_name: values.supplier_name,
      notes: values.notes,
      items: values.items
    });

    if (!result.success) {
      toast({
        title: "Failed to update GRN",
        description: result.error || "Please try again.",
        variant: "error"
      });
      return;
    }

    toast({ title: "GRN updated successfully", variant: "success" });
    router.push(`/receive-notes/${receiveNoteId}`);
  };

  const handleDelete = async () => {
    if (!receiveNoteId) return;
    const confirmed = window.confirm("Delete this GRN? This cannot be undone.");
    if (!confirmed) return;

    const result = await deleteReceiveNote(receiveNoteId);
    if (!result.success) {
      toast({
        title: "Failed to delete GRN",
        description: result.error || "Please try again.",
        variant: "error"
      });
      return;
    }

    toast({ title: "GRN deleted", variant: "success" });
    router.push("/receive-notes");
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

  useEffect(() => {
    const productId = watchedDraft?.product_id;
    if (!productId) return;

    const cached = productDefaultsRef.current.get(productId);
    if (!cached) return;

    if (cached.sellingPrice !== undefined) {
      setValue("draft.selling_price", cached.sellingPrice, { shouldDirty: true });
    }
    if (cached.cost !== undefined) {
      setValue("draft.product_cost", cached.cost, { shouldDirty: true });
    }
    if (cached.discountPercent !== undefined) {
      setValue("draft.item_discount_percent", cached.discountPercent, { shouldDirty: true });
    }
    if (cached.repSalesDiscount !== undefined) {
      setValue("draft.rep_sales_discount", cached.repSalesDiscount, { shouldDirty: true });
    }
    if (cached.repCollection !== undefined) {
      setValue("draft.rep_collection", cached.repCollection, { shouldDirty: true });
    }
  }, [setValue, watchedDraft?.product_id]);

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

    productDefaultsRef.current.set(draft.product_id, {
      sellingPrice: normalizeNumber(draft.selling_price) || undefined,
      cost: normalizeNumber(draft.product_cost) || undefined,
      discountPercent: normalizeNumber(draft.item_discount_percent) || undefined,
      repSalesDiscount: normalizeNumber(draft.rep_sales_discount) || undefined,
      repCollection: normalizeNumber(draft.rep_collection) || undefined
    });

    resetField("draft", { defaultValue: emptyDraft });
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
        <h1 className="text-2xl font-bold">Edit GRN</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to edit GRN.</p>
      </section>
    );
  }

  if (isReceiveNoteLoading) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Edit GRN</h1>
        <p className="text-sm text-muted-foreground">Loading GRN...</p>
      </section>
    );
  }

  if (isReceiveNoteError || !receiveNote) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Edit GRN</h1>
        <p className="text-sm text-muted-foreground">Unable to find this GRN.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Edit GRN</h1>
        <p className="text-sm text-muted-foreground">Update supplier stock received into inventory.</p>
      </header>

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

                <div className="grid gap-2 md:grid-cols-2">
                  <Input
                    type="number"
                    step="1"
                    placeholder="Qty"
                    {...register("draft.qty", {
                      validate: (value) =>
                        shouldValidateDraft() && value === undefined ? "Qty is required" : true,
                      setValueAs: (value) => (value === "" ? undefined : Number(value))
                    })}
                    className={cn(
                      addAttempted && draftErrors?.qty ? "border-red-400 focus:ring-red-400/40" : ""
                    )}
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
                  type="number"
                  step="0.01"
                  placeholder="Cost"
                  {...costField}
                  ref={(node) => {
                    costField.ref(node);
                    costInputRef.current = node;
                  }}
                  className={cn(
                    addAttempted && draftErrors?.product_cost ? "border-red-400 focus:ring-red-400/40" : ""
                  )}
                />

                <Input
                  type="number"
                  step="0.01"
                  placeholder="Selling price"
                  {...register("draft.selling_price", {
                    validate: (value) =>
                      shouldValidateDraft() && value === undefined ? "Selling price is required" : true,
                    setValueAs: (value) => (value === "" ? undefined : Number(value))
                  })}
                  className={cn(
                    addAttempted && draftErrors?.selling_price ? "border-red-400 focus:ring-red-400/40" : ""
                  )}
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

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit">Save Changes</Button>
          <Button type="button" variant="danger" onClick={handleDelete}>
            Delete GRN
          </Button>
        </div>
      </form>
    </section>
  );
}
