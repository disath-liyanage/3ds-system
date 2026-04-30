"use server";

import { revalidatePath } from "next/cache";

import type { UserRole } from "@paintdist/shared";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ActionResult = {
  success: boolean;
  error?: string;
};

export type ProductInput = {
  name: string;
  category: string;
  unit: string;
  price: number;
  stock_qty: number;
  low_stock_threshold?: number;
};

type CustomRolePermissionSummary = {
  perm_manage_products: boolean;
};

type ProfilePermissionRow = {
  role: UserRole;
  custom_role: CustomRolePermissionSummary | CustomRolePermissionSummary[] | null;
};

type NormalizedProductInput = {
  name: string;
  category: string;
  unit: string;
  price: number;
  stock_qty: number;
  low_stock_threshold: number;
};

type ParseNumberResult =
  | {
      ok: true;
      value: number;
    }
  | {
      ok: false;
      error: string;
    };

async function requireManageProductsPermission() {
  const supabase = createClient();

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Unauthorized" as const };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users_profile")
    .select("role, custom_role:custom_roles(perm_manage_products)")
    .eq("id", user.id)
    .maybeSingle<ProfilePermissionRow>();

  let resolvedProfile = profile;

  if ((!resolvedProfile || profileError) && user.email) {
    const { data: fallbackProfile } = await adminClient
      .from("users_profile")
      .select("role, custom_role:custom_roles(perm_manage_products)")
      .eq("email", user.email)
      .maybeSingle<ProfilePermissionRow>();

    resolvedProfile = fallbackProfile ?? null;
  }

  if (!resolvedProfile) {
    return { error: "Unauthorized" as const };
  }

  const roleRelation = resolvedProfile.custom_role;
  const customRole = Array.isArray(roleRelation) ? roleRelation[0] || null : roleRelation;

  const canManageProducts =
    resolvedProfile.role === "admin" ||
    resolvedProfile.role === "manager" ||
    Boolean(customRole?.perm_manage_products);

  if (!canManageProducts) {
    return { error: "You do not have permission to manage products" as const };
  }

  return { userId: user.id };
}

function parseNonNegativeNumber(
  value: number,
  fieldLabel: string
): ParseNumberResult {
  if (!Number.isFinite(value)) {
    return { ok: false, error: `${fieldLabel} must be a valid number` };
  }

  if (value < 0) {
    return { ok: false, error: `${fieldLabel} cannot be negative` };
  }

  return { ok: true, value };
}

function normalizeProductInput(data: ProductInput): { data?: NormalizedProductInput; error?: string } {
  const name = data.name.trim();
  const category = data.category.trim();
  const unit = data.unit.trim();

  if (!name) return { error: "Name is required" };
  if (!category) return { error: "Category is required" };
  if (!unit) return { error: "Unit is required" };

  const priceResult = parseNonNegativeNumber(data.price, "Price");
  if (!priceResult.ok) return { error: priceResult.error };

  const stockQtyResult = parseNonNegativeNumber(data.stock_qty, "Stock quantity");
  if (!stockQtyResult.ok) return { error: stockQtyResult.error };

  const thresholdResult = parseNonNegativeNumber(data.low_stock_threshold ?? 10, "Low stock threshold");
  if (!thresholdResult.ok) return { error: thresholdResult.error };

  return {
    data: {
      name,
      category,
      unit,
      price: priceResult.value,
      stock_qty: stockQtyResult.value,
      low_stock_threshold: thresholdResult.value
    }
  };
}

export async function createProduct(data: ProductInput): Promise<ActionResult> {
  const access = await requireManageProductsPermission();
  if ("error" in access) return { success: false, error: access.error };

  const normalized = normalizeProductInput(data);
  if (!normalized.data) {
    return { success: false, error: normalized.error || "Invalid product data" };
  }

  const { error } = await adminClient.from("products").insert(normalized.data);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/products");
  return { success: true };
}

export async function updateProduct(id: string, data: ProductInput): Promise<ActionResult> {
  const access = await requireManageProductsPermission();
  if ("error" in access) return { success: false, error: access.error };

  if (!id) {
    return { success: false, error: "Product id is required" };
  }

  const normalized = normalizeProductInput(data);
  if (!normalized.data) {
    return { success: false, error: normalized.error || "Invalid product data" };
  }

  const { data: updatedProduct, error } = await adminClient
    .from("products")
    .update(normalized.data)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }

  if (!updatedProduct) {
    return { success: false, error: "Product not found" };
  }

  revalidatePath("/products");
  return { success: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const access = await requireManageProductsPermission();
  if ("error" in access) return { success: false, error: access.error };

  if (!id) {
    return { success: false, error: "Product id is required" };
  }

  const { error } = await adminClient.from("products").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/products");
  return { success: true };
}
