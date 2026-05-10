"use server";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProductGRNPrices(
  updates: Array<{ productId: string; oldSellingPrice: number; newSellingPrice: number }>
) {
  for (const update of updates) {
    if (update.oldSellingPrice === update.newSellingPrice) continue;

    const { error } = await adminClient
      .from("receive_note_items")
      .update({ selling_price: update.newSellingPrice })
      .eq("product_id", update.productId)
      .eq("selling_price", update.oldSellingPrice);

    if (error) {
      return { success: false, error: error.message };
    }
  }

  revalidatePath("/products");
  return { success: true };
}

export async function updateProductGRNStock(
  productId: string,
  sellingPrice: number,
  newTotalStock: number
) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: currentProduct } = await adminClient
    .from("products")
    .select("stock_qty")
    .eq("id", productId)
    .maybeSingle();
  const stockBefore = Number(currentProduct?.stock_qty) || 0;

  // 1. Fetch all items for this product and price
  const { data: items, error: fetchError } = await adminClient
    .from("receive_note_items")
    .select("id, qty, free_qty")
    .eq("product_id", productId)
    .eq("selling_price", sellingPrice)
    .order("created_at", { ascending: false });

  if (fetchError || !items || items.length === 0) {
    return { success: false, error: fetchError?.message || "No GRN records found for this price" };
  }

  // 2. Calculate current total
  const currentTotal = items.reduce((sum, item) => sum + Number(item.qty) + Number(item.free_qty), 0);
  const diff = newTotalStock - currentTotal;

  if (diff === 0) return { success: true };

  // 3. Update the most recent item with the difference
  const mostRecent = items[0];
  const newQty = Math.max(0, Number(mostRecent.qty) + diff);

  const { error: updateError } = await adminClient
    .from("receive_note_items")
    .update({ qty: newQty })
    .eq("id", mostRecent.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // 4. Recompute product total stock
  const { data: allItems } = await adminClient
    .from("receive_note_items")
    .select("qty, free_qty")
    .eq("product_id", productId);

  const newProductTotal = (allItems || []).reduce((sum, item) => sum + Number(item.qty) + Number(item.free_qty), 0);

  const { error: productError } = await adminClient
    .from("products")
    .update({ stock_qty: newProductTotal })
    .eq("id", productId);

  if (productError) {
    return { success: false, error: productError.message };
  }

  if (stockBefore !== newProductTotal) {
    await adminClient.from("audit_log").insert({
      table_name: "product_stock_adjustments",
      record_id: productId,
      action: "manual_stock_update",
      performed_by: null,
      old_data: {
        stock_qty: stockBefore
      },
      new_data: {
        stock_qty: newProductTotal,
        changed_by: user?.id || "system"
      }
    });
  }

  revalidatePath("/products");
  return { success: true };
}
