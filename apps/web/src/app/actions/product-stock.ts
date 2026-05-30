import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ProductStockByPrice = {
  selling_price: number;
  unit_cost: number;
  total_qty: number;
  received_qty: number;
  free_qty: number;
  last_received_at: string | null;
};

export type ProductMinAvailableByPrice = {
  price: number;
  stock: number;
  hasGrnEntry: boolean;
};

function toPriceKey(value: number | string | null | undefined): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return amount.toFixed(2);
}

function getSummedValue(row: any, primaryKey: string, fallbackKey: string): number {
  const primary = Number(row?.[primaryKey]);
  if (Number.isFinite(primary)) return primary;
  const fallback = Number(row?.[fallbackKey]);
  if (Number.isFinite(fallback)) return fallback;
  return 0;
}

async function requireAuthenticatedUser() {
  const supabase = createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Authentication required");
  }
}

function buildMinAvailableMap(receivedRows: any[] | null | undefined, invoicedRows: any[] | null | undefined) {
  const byProductAndPrice = new Map<string, number>();
  const productsWithGrn = new Set<string>();

  for (const row of receivedRows ?? []) {
    const productId = String(row?.product_id || "");
    if (!productId) continue;
    productsWithGrn.add(productId);
    const sellingPriceKey = toPriceKey(row?.selling_price);
    if (!sellingPriceKey) continue;
    const totalReceived =
      getSummedValue(row, "total_qty", "qty") + getSummedValue(row, "total_free_qty", "free_qty");
    const key = `${productId}::${sellingPriceKey}`;
    byProductAndPrice.set(key, (byProductAndPrice.get(key) || 0) + totalReceived);
  }

  for (const row of invoicedRows ?? []) {
    const productId = String(row?.product_id || "");
    if (!productId) continue;
    const unitPriceKey = toPriceKey(row?.unit_price);
    if (!unitPriceKey) continue;
    const totalSold =
      getSummedValue(row, "total_qty", "qty") + getSummedValue(row, "total_free_qty", "free_qty");
    const key = `${productId}::${unitPriceKey}`;
    const current = byProductAndPrice.get(key);
    if (current === undefined) continue;
    byProductAndPrice.set(key, Math.max(0, current - totalSold));
  }

  const byProduct = new Map<string, Array<{ price: number; stock: number }>>();

  for (const [key, stock] of byProductAndPrice.entries()) {
    if (stock <= 0) continue;
    const [productId, priceKey] = key.split("::");
    const price = Number(priceKey);
    if (!Number.isFinite(price)) continue;

    const existing = byProduct.get(productId) ?? [];
    existing.push({ price, stock });
    byProduct.set(productId, existing);
  }

  const out: Record<string, ProductMinAvailableByPrice> = {};

  for (const productId of productsWithGrn) {
    out[productId] = {
      price: 0,
      stock: 0,
      hasGrnEntry: true
    };
  }

  for (const [productId, buckets] of byProduct.entries()) {
    if (buckets.length === 0) continue;
    const minBucket = buckets.reduce((min, bucket) => (bucket.price < min.price ? bucket : min));
    out[productId] = {
      ...minBucket,
      hasGrnEntry: true
    };
  }

  return out;
}

export async function getProductStockByPrice(productId: string): Promise<ProductStockByPrice[]> {
  await requireAuthenticatedUser();

  if (!productId) return [];

  const [{ data, error }, { data: invoicedRows, error: invoicedError }] = await Promise.all([
    adminClient
      .from("receive_note_items")
      .select("selling_price, unit_cost, qty, free_qty, created_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: false }),
    adminClient
      .from("invoice_items")
      .select("unit_price, qty, free_qty, invoice:invoices(status)")
      .eq("product_id", productId)
  ]);

  if (error) throw new Error(error.message);
  if (invoicedError) throw new Error(invoicedError.message);

  const totals = new Map<string, ProductStockByPrice>();

  for (const row of data ?? []) {
    const sellingPrice = Number(row.selling_price) || 0;
    const priceKey = toPriceKey(sellingPrice);
    if (!priceKey) continue;
    const unitCost = Number(row.unit_cost) || 0;
    const qty = Number(row.qty) || 0;
    const freeQty = Number(row.free_qty) || 0;
    const totalQty = qty + freeQty;
    const existing = totals.get(priceKey);

    if (existing) {
      existing.received_qty += qty;
      existing.free_qty += freeQty;
      existing.total_qty += totalQty;
      if (unitCost > existing.unit_cost) {
        existing.unit_cost = unitCost;
      }
      if (!existing.last_received_at || (row.created_at && row.created_at > existing.last_received_at)) {
        existing.last_received_at = row.created_at ?? null;
      }
    } else {
      totals.set(priceKey, {
        selling_price: sellingPrice,
        unit_cost: unitCost,
        received_qty: qty,
        free_qty: freeQty,
        total_qty: totalQty,
        last_received_at: row.created_at ?? null
      });
    }
  }

  for (const row of invoicedRows ?? []) {
    const invoice = Array.isArray((row as any).invoice) ? (row as any).invoice[0] : (row as any).invoice;
    const status = String(invoice?.status || "");
    if (status !== "approved" && status !== "issued" && status !== "paid") continue;

    const priceKey = toPriceKey((row as any).unit_price);
    if (!priceKey) continue;
    const qty = Number((row as any).qty) || 0;
    const freeQty = Number((row as any).free_qty) || 0;
    const existing = totals.get(priceKey);
    if (!existing) continue;
    existing.total_qty = Math.max(0, existing.total_qty - qty - freeQty);
  }

  return Array.from(totals.values()).sort((a, b) => a.selling_price - b.selling_price);
}

export async function getProductMinAvailableByPrice(): Promise<Record<string, ProductMinAvailableByPrice>> {
  await requireAuthenticatedUser();

  const [{ data: receivedRows, error: receivedError }, { data: invoicedRows, error: invoicedError }] = await Promise.all([
    adminClient.from("receive_note_items").select("product_id, selling_price, qty, free_qty"),
    adminClient
      .from("invoice_items")
      .select("product_id, unit_price, qty, free_qty, invoice:invoices!inner(status)")
      .in("invoice.status", ["approved", "issued", "paid"])
  ]);

  if (receivedError) throw new Error(receivedError.message);
  if (invoicedError) throw new Error(invoicedError.message);

  return buildMinAvailableMap(receivedRows as any[], invoicedRows as any[]);
}
