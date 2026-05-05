"use server";

import { revalidatePath } from "next/cache";

import type { UserRole } from "@paintdist/shared";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ActionResult = {
  success: boolean;
  error?: string;
  message?: string;
};

type CustomRolePermissionSummary = {
  perm_create_invoices: boolean;
};

type ProfilePermissionRow = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  custom_role: CustomRolePermissionSummary | CustomRolePermissionSummary[] | null;
};

export type InvoiceListRow = {
  id: string;
  invoice_number: number;
  order_id: string | null;
  customer_id: string;
  customer_name: string;
  issued_by: string;
  issued_by_name: string;
  total_amount: number;
  payment_method: string;
  status: "draft" | "issued" | "paid";
  created_at: string;
};

export type InvoiceDetailRow = InvoiceListRow & {
  customer_phone: string;
  customer_address: string;
  notes: string | null;
  items: Array<{
    id: string;
    product_id: string;
    product_name: string;
    product_unit: string;
    qty: number;
    free_qty: number;
    unit_price: number;
    discount_type: "percent" | "amount";
    discount_value: number;
  }>;
};

export type InvoiceInput = {
  customer_id: string;
  payment_method: string;
  saveAsDraft?: boolean;
  notes?: string;
  items: Array<{
    product_id: string;
    qty: number;
    free_qty?: number;
    unit_price: number;
    unit_cost: number;
    discount_type?: "percent" | "amount";
    discount_value?: number;
  }>;
};

export type UpdateDraftInvoiceInput = {
  invoice_id: string;
  payment_method: string;
  finalize: boolean;
  notes?: string;
  items: Array<{
    product_id: string;
    qty: number;
    free_qty?: number;
    unit_price: number;
    unit_cost: number;
    discount_type?: "percent" | "amount";
    discount_value?: number;
  }>;
};

export type UpdateInvoiceInput = {
  invoice_id: string;
  payment_method: string;
  notes?: string;
  items: Array<{
    product_id: string;
    qty: number;
    free_qty?: number;
    unit_price: number;
    unit_cost: number;
    discount_type?: "percent" | "amount";
    discount_value?: number;
  }>;
};

async function getCurrentUserProfile() {
  const supabase = createClient();

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Unauthorized" as const };
  }

  const { data: profile } = await adminClient
    .from("users_profile")
    .select("id, email, role, full_name, custom_role:custom_roles(perm_create_invoices)")
    .eq("id", user.id)
    .maybeSingle<ProfilePermissionRow>();

  if (!profile) {
    return { error: "Profile not found" as const };
  }

  return { profile };
}

function canCreateInvoices(profile: ProfilePermissionRow): boolean {
  const roleRelation = profile.custom_role;
  const customRole = Array.isArray(roleRelation) ? roleRelation[0] || null : roleRelation;

  return (
    profile.role === "admin" ||
    profile.role === "manager" ||
    profile.role === "cashier" ||
    profile.role === "sales_rep" ||
    Boolean(customRole?.perm_create_invoices)
  );
}

function canViewAllInvoices(profile: ProfilePermissionRow): boolean {
  return profile.role === "admin" || profile.role === "manager";
}

export async function listInvoices(): Promise<{ success: boolean; data?: InvoiceListRow[]; error?: string }> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canCreateInvoices(access.profile)) {
    return { success: false, error: "You do not have permission to view invoices" };
  }

  let query = adminClient
    .from("invoices")
    .select(
      "id, invoice_number, order_id, customer_id, issued_by, total_amount, payment_method, status, created_at, customer:customers(name), issuer:users_profile(full_name)"
    )
    .order("created_at", { ascending: false });

  if (!canViewAllInvoices(access.profile)) {
    query = query.eq("issued_by", access.profile.id);
  }

  const { data, error } = await query;

  if (error) return { success: false, error: error.message };

  let rows = (data ?? []).map((row: any) => {
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    const issuer = Array.isArray(row.issuer) ? row.issuer[0] : row.issuer;

    return {
      id: row.id,
      invoice_number: row.invoice_number,
      order_id: row.order_id,
      customer_id: row.customer_id,
      customer_name: customer?.name ?? "Unknown Customer",
      issued_by: row.issued_by,
      issued_by_name: issuer?.full_name ?? "Unknown",
      total_amount: Number(row.total_amount),
      payment_method: row.payment_method,
      status: row.status,
      created_at: row.created_at
    } as InvoiceListRow;
  });

  if (canViewAllInvoices(access.profile)) {
    rows = rows.filter((row) => row.status !== "draft" || row.issued_by === access.profile.id);
  }

  return { success: true, data: rows };
}

export async function getInvoiceDetail(
  invoiceId: string
): Promise<{ success: boolean; data?: InvoiceDetailRow | null; error?: string }> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!invoiceId) {
    return { success: false, error: "Invoice id is required" };
  }

  if (!canCreateInvoices(access.profile)) {
    return { success: false, error: "You do not have permission to view invoices" };
  }

  let query = adminClient
    .from("invoices")
    .select(
      `
        id, invoice_number, order_id, customer_id, issued_by, total_amount, payment_method, status, created_at, notes,
        customer:customers(name, phone, address),
        issuer:users_profile(full_name),
        invoice_items (
          id, product_id, qty, free_qty, unit_price, discount_type, discount_value,
          product:products(name, unit)
        )
      `
    )
    .eq("id", invoiceId);

  if (!canViewAllInvoices(access.profile)) {
    query = query.eq("issued_by", access.profile.id);
  }

  const { data, error } = await query.single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: true, data: null };

  const invoiceData = data as any;

  const result: InvoiceDetailRow = {
    id: invoiceData.id,
    invoice_number: invoiceData.invoice_number,
    order_id: invoiceData.order_id,
    customer_id: invoiceData.customer_id,
    customer_name: invoiceData.customer?.name ?? "Unknown Customer",
    customer_phone: invoiceData.customer?.phone ?? "",
    customer_address: invoiceData.customer?.address ?? "",
    issued_by: invoiceData.issued_by,
    issued_by_name: invoiceData.issuer?.full_name ?? "Unknown",
    total_amount: Number(invoiceData.total_amount),
    payment_method: invoiceData.payment_method,
    status: invoiceData.status,
    notes: invoiceData.notes ?? null,
    created_at: invoiceData.created_at,
    items: (invoiceData.invoice_items ?? []).map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      qty: Number(item.qty),
      free_qty: Number(item.free_qty) || 0,
      unit_price: Number(item.unit_price),
      discount_type: item.discount_type === "percent" ? "percent" : "amount",
      discount_value: Number(item.discount_value) || 0,
      product_name: item.product?.name ?? "Unknown Product",
      product_unit: item.product?.unit ?? ""
    }))
  };

  return { success: true, data: result };
}

export async function createInvoice(input: InvoiceInput): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canCreateInvoices(access.profile)) {
    return { success: false, error: "You do not have permission to create invoices" };
  }

  const { customer_id, payment_method, items, notes, saveAsDraft } = input;

  if (!customer_id) {
    return { success: false, error: "Customer is required" };
  }

  if (payment_method !== "cash" && payment_method !== "credit") {
    return { success: false, error: "Valid payment method is required (cash or credit)" };
  }

  if (!items || items.length === 0) {
    return { success: false, error: "At least one item is required" };
  }

  let total_amount = 0;
  for (const [index, item] of items.entries()) {
    if (!item.product_id) {
      return { success: false, error: `Item ${index + 1} is missing a product` };
    }
    const qty = Number(item.qty);
    const unitPrice = Number(item.unit_price);
    const unitCost = Number(item.unit_cost) || 0;
    const freeQty = Number(item.free_qty) || 0;
    const discountType = item.discount_type === "percent" ? "percent" : "amount";
    const discountValue = Number(item.discount_value) || 0;
    const discountPerUnit = discountType === "percent" ? (unitPrice * discountValue) / 100 : discountValue;
    const effectiveUnitPrice = unitPrice - discountPerUnit;
    
    if (!Number.isFinite(qty) || qty <= 0) {
      return { success: false, error: `Item ${index + 1} quantity must be greater than 0` };
    }
    if (!Number.isFinite(freeQty) || freeQty < 0) {
      return { success: false, error: `Item ${index + 1} free quantity must be 0 or more` };
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { success: false, error: `Item ${index + 1} unit price cannot be negative` };
    }
    if (!Number.isFinite(discountValue) || discountValue < 0) {
      return { success: false, error: `Item ${index + 1} discount cannot be negative` };
    }
    if (discountType === "percent" && discountValue > 100) {
      return { success: false, error: `Item ${index + 1} discount percent cannot exceed 100` };
    }
    if (discountPerUnit > unitPrice) {
      return { success: false, error: `Item ${index + 1} discount cannot exceed unit price` };
    }
    if (effectiveUnitPrice < unitCost) {
      return { success: false, error: `Cannot bill undercost. Item ${index + 1} price is below the required cost.` };
    }

    total_amount += qty * Math.max(0, effectiveUnitPrice);
  }

  // Create invoice
  // status: if cash, we can consider it 'paid' maybe? Let's leave it 'issued' so user can track it.
  const status = saveAsDraft ? "draft" : payment_method === "cash" ? "paid" : "issued";

  const { data: invoice, error: invoiceError } = await adminClient
    .from("invoices")
    .insert({
      customer_id,
      issued_by: access.profile.id,
      total_amount,
      payment_method,
      status,
      notes: notes || null
    })
    .select("id")
    .single();

  if (invoiceError || !invoice) {
    return { success: false, error: invoiceError?.message || "Failed to create invoice" };
  }

  const itemsPayload = items.map((item) => ({
    invoice_id: invoice.id,
    product_id: item.product_id,
    qty: item.qty,
    free_qty: item.free_qty || 0,
    unit_price: item.unit_price,
    discount_type: item.discount_type === "percent" ? "percent" : "amount",
    discount_value: item.discount_value || 0
  }));

  const { error: itemsError } = await adminClient.from("invoice_items").insert(itemsPayload);

  if (itemsError) {
    await adminClient.from("invoices").delete().eq("id", invoice.id);
    return { success: false, error: itemsError.message };
  }

  if (!saveAsDraft) {
    // Reduce product stock
    try {
      for (const item of items) {
        const qty = Number(item.qty);
        const { data: product, error: productError } = await adminClient
          .from("products")
          .select("stock_qty")
          .eq("id", item.product_id)
          .single();
          
        if (product && !productError) {
          const newStock = Math.max(0, Number(product.stock_qty) - qty);
          await adminClient.from("products").update({ stock_qty: newStock }).eq("id", item.product_id);
        }
      }
    } catch (err) {
      console.error("Failed to update stock after invoice creation", err);
    }

    // If credit, we might want to update customer balance
    if (payment_method === "credit") {
      try {
        const { data: customer, error: customerError } = await adminClient
          .from("customers")
          .select("balance")
          .eq("id", customer_id)
          .single();

        if (customer && !customerError) {
          const newBalance = Number(customer.balance) + total_amount;
          await adminClient.from("customers").update({ balance: newBalance }).eq("id", customer_id);
        }
      } catch (err) {
        console.error("Failed to update customer balance", err);
      }
    }
  }

  revalidatePath("/invoices");
  revalidatePath("/products");
  revalidatePath("/customers");

  return { success: true, message: saveAsDraft ? "Invoice draft saved" : "Invoice created successfully" };
}

export async function updateDraftInvoice(input: UpdateDraftInvoiceInput): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canCreateInvoices(access.profile)) {
    return { success: false, error: "You do not have permission to update invoices" };
  }

  const { invoice_id, payment_method, items, notes, finalize } = input;

  if (!invoice_id) {
    return { success: false, error: "Invoice id is required" };
  }

  if (payment_method !== "cash" && payment_method !== "credit") {
    return { success: false, error: "Valid payment method is required (cash or credit)" };
  }

  if (!items || items.length === 0) {
    return { success: false, error: "At least one item is required" };
  }

  const { data: invoice, error: invoiceError } = await adminClient
    .from("invoices")
    .select("id, issued_by, status, customer_id")
    .eq("id", invoice_id)
    .single();

  if (invoiceError || !invoice) {
    return { success: false, error: invoiceError?.message || "Invoice not found" };
  }

  if (!canViewAllInvoices(access.profile) && invoice.issued_by !== access.profile.id) {
    return { success: false, error: "You do not have permission to update this invoice" };
  }

  if (invoice.status !== "draft") {
    return { success: false, error: "Only draft invoices can be updated" };
  }

  let total_amount = 0;
  for (const [index, item] of items.entries()) {
    if (!item.product_id) {
      return { success: false, error: `Item ${index + 1} is missing a product` };
    }
    const qty = Number(item.qty);
    const unitPrice = Number(item.unit_price);
    const unitCost = Number(item.unit_cost) || 0;
    const freeQty = Number(item.free_qty) || 0;
    const discountType = item.discount_type === "percent" ? "percent" : "amount";
    const discountValue = Number(item.discount_value) || 0;
    const discountPerUnit = discountType === "percent" ? (unitPrice * discountValue) / 100 : discountValue;
    const effectiveUnitPrice = unitPrice - discountPerUnit;

    if (!Number.isFinite(qty) || qty <= 0) {
      return { success: false, error: `Item ${index + 1} quantity must be greater than 0` };
    }
    if (!Number.isFinite(freeQty) || freeQty < 0) {
      return { success: false, error: `Item ${index + 1} free quantity must be 0 or more` };
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { success: false, error: `Item ${index + 1} unit price cannot be negative` };
    }
    if (!Number.isFinite(discountValue) || discountValue < 0) {
      return { success: false, error: `Item ${index + 1} discount cannot be negative` };
    }
    if (discountType === "percent" && discountValue > 100) {
      return { success: false, error: `Item ${index + 1} discount percent cannot exceed 100` };
    }
    if (discountPerUnit > unitPrice) {
      return { success: false, error: `Item ${index + 1} discount cannot exceed unit price` };
    }
    if (effectiveUnitPrice < unitCost) {
      return { success: false, error: `Cannot bill undercost. Item ${index + 1} price is below the required cost.` };
    }

    total_amount += qty * Math.max(0, effectiveUnitPrice);
  }

  const status = finalize ? (payment_method === "cash" ? "paid" : "issued") : "draft";

  const { error: updateError } = await adminClient
    .from("invoices")
    .update({
      total_amount,
      payment_method,
      status,
      notes: notes || null
    })
    .eq("id", invoice_id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  const { error: deleteItemsError } = await adminClient
    .from("invoice_items")
    .delete()
    .eq("invoice_id", invoice_id);

  if (deleteItemsError) {
    return { success: false, error: deleteItemsError.message };
  }

  const itemsPayload = items.map((item) => ({
    invoice_id,
    product_id: item.product_id,
    qty: item.qty,
    free_qty: item.free_qty || 0,
    unit_price: item.unit_price,
    discount_type: item.discount_type === "percent" ? "percent" : "amount",
    discount_value: item.discount_value || 0
  }));

  const { error: itemsError } = await adminClient.from("invoice_items").insert(itemsPayload);

  if (itemsError) {
    return { success: false, error: itemsError.message };
  }

  if (finalize) {
    // Reduce product stock
    try {
      for (const item of items) {
        const qty = Number(item.qty);
        const { data: product, error: productError } = await adminClient
          .from("products")
          .select("stock_qty")
          .eq("id", item.product_id)
          .single();

        if (product && !productError) {
          const newStock = Math.max(0, Number(product.stock_qty) - qty);
          await adminClient.from("products").update({ stock_qty: newStock }).eq("id", item.product_id);
        }
      }
    } catch (err) {
      console.error("Failed to update stock after draft finalize", err);
    }

    if (payment_method === "credit") {
      try {
        const { data: customer, error: customerError } = await adminClient
          .from("customers")
          .select("balance")
          .eq("id", invoice.customer_id)
          .single();

        if (customer && !customerError) {
          const newBalance = Number(customer.balance) + total_amount;
          await adminClient.from("customers").update({ balance: newBalance }).eq("id", invoice.customer_id);
        }
      } catch (err) {
        console.error("Failed to update customer balance after draft finalize", err);
      }
    }
  }

  revalidatePath("/invoices");
  revalidatePath("/products");
  revalidatePath("/customers");

  return { success: true, message: finalize ? "Invoice updated" : "Draft updated" };
}

export async function updateInvoice(input: UpdateInvoiceInput): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  if (!canCreateInvoices(access.profile)) {
    return { success: false, error: "You do not have permission to update invoices" };
  }

  const { invoice_id, payment_method, items, notes } = input;

  if (!invoice_id) {
    return { success: false, error: "Invoice id is required" };
  }

  if (payment_method !== "cash" && payment_method !== "credit") {
    return { success: false, error: "Valid payment method is required (cash or credit)" };
  }

  if (!items || items.length === 0) {
    return { success: false, error: "At least one item is required" };
  }

  const { data: invoice, error: invoiceError } = await adminClient
    .from("invoices")
    .select("id, issued_by, status, customer_id, total_amount, payment_method")
    .eq("id", invoice_id)
    .single();

  if (invoiceError || !invoice) {
    return { success: false, error: invoiceError?.message || "Invoice not found" };
  }

  if (!canViewAllInvoices(access.profile) && invoice.issued_by !== access.profile.id) {
    return { success: false, error: "You do not have permission to update this invoice" };
  }

  if (invoice.status === "paid") {
    return { success: false, error: "Paid invoices cannot be edited" };
  }

  let total_amount = 0;
  for (const [index, item] of items.entries()) {
    if (!item.product_id) {
      return { success: false, error: `Item ${index + 1} is missing a product` };
    }
    const qty = Number(item.qty);
    const unitPrice = Number(item.unit_price);
    const unitCost = Number(item.unit_cost) || 0;
    const freeQty = Number(item.free_qty) || 0;
    const discountType = item.discount_type === "percent" ? "percent" : "amount";
    const discountValue = Number(item.discount_value) || 0;
    const discountPerUnit = discountType === "percent" ? (unitPrice * discountValue) / 100 : discountValue;
    const effectiveUnitPrice = unitPrice - discountPerUnit;

    if (!Number.isFinite(qty) || qty <= 0) {
      return { success: false, error: `Item ${index + 1} quantity must be greater than 0` };
    }
    if (!Number.isFinite(freeQty) || freeQty < 0) {
      return { success: false, error: `Item ${index + 1} free quantity must be 0 or more` };
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { success: false, error: `Item ${index + 1} unit price cannot be negative` };
    }
    if (!Number.isFinite(discountValue) || discountValue < 0) {
      return { success: false, error: `Item ${index + 1} discount cannot be negative` };
    }
    if (discountType === "percent" && discountValue > 100) {
      return { success: false, error: `Item ${index + 1} discount percent cannot exceed 100` };
    }
    if (discountPerUnit > unitPrice) {
      return { success: false, error: `Item ${index + 1} discount cannot exceed unit price` };
    }
    if (effectiveUnitPrice < unitCost) {
      return { success: false, error: `Cannot bill undercost. Item ${index + 1} price is below the required cost.` };
    }

    total_amount += qty * Math.max(0, effectiveUnitPrice);
  }

  const { data: existingItems, error: existingItemsError } = await adminClient
    .from("invoice_items")
    .select("product_id, qty")
    .eq("invoice_id", invoice_id);

  if (existingItemsError) {
    return { success: false, error: existingItemsError.message };
  }

  const oldQtyByProduct = new Map<string, number>();
  for (const item of existingItems ?? []) {
    const current = oldQtyByProduct.get(item.product_id) ?? 0;
    oldQtyByProduct.set(item.product_id, current + Number(item.qty));
  }

  const newQtyByProduct = new Map<string, number>();
  for (const item of items) {
    const current = newQtyByProduct.get(item.product_id) ?? 0;
    newQtyByProduct.set(item.product_id, current + Number(item.qty));
  }

  const allProductIds = new Set([...oldQtyByProduct.keys(), ...newQtyByProduct.keys()]);

  try {
    for (const productId of allProductIds) {
      const oldQty = oldQtyByProduct.get(productId) ?? 0;
      const newQty = newQtyByProduct.get(productId) ?? 0;
      const delta = newQty - oldQty;

      if (delta === 0) continue;

      const { data: product, error: productError } = await adminClient
        .from("products")
        .select("stock_qty")
        .eq("id", productId)
        .single();

      if (!product || productError) continue;

      const nextStock = Math.max(0, Number(product.stock_qty) - delta);
      await adminClient.from("products").update({ stock_qty: nextStock }).eq("id", productId);
    }
  } catch (err) {
    console.error("Failed to update stock after invoice edit", err);
  }

  const oldContribution = invoice.payment_method === "credit" ? Number(invoice.total_amount) : 0;
  const newContribution = payment_method === "credit" ? total_amount : 0;
  const balanceDelta = newContribution - oldContribution;

  if (balanceDelta !== 0) {
    try {
      const { data: customer, error: customerError } = await adminClient
        .from("customers")
        .select("balance")
        .eq("id", invoice.customer_id)
        .single();

      if (customer && !customerError) {
        const newBalance = Number(customer.balance) + balanceDelta;
        await adminClient.from("customers").update({ balance: newBalance }).eq("id", invoice.customer_id);
      }
    } catch (err) {
      console.error("Failed to update customer balance after invoice edit", err);
    }
  }

  const { error: updateError } = await adminClient
    .from("invoices")
    .update({
      total_amount,
      payment_method,
      notes: notes || null
    })
    .eq("id", invoice_id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  const { error: deleteItemsError } = await adminClient
    .from("invoice_items")
    .delete()
    .eq("invoice_id", invoice_id);

  if (deleteItemsError) {
    return { success: false, error: deleteItemsError.message };
  }

  const itemsPayload = items.map((item) => ({
    invoice_id,
    product_id: item.product_id,
    qty: item.qty,
    free_qty: item.free_qty || 0,
    unit_price: item.unit_price,
    discount_type: item.discount_type === "percent" ? "percent" : "amount",
    discount_value: item.discount_value || 0
  }));

  const { error: itemsError } = await adminClient.from("invoice_items").insert(itemsPayload);

  if (itemsError) {
    return { success: false, error: itemsError.message };
  }

  revalidatePath("/invoices");
  revalidatePath("/products");
  revalidatePath("/customers");

  return { success: true, message: "Invoice updated" };
}

export async function deleteInvoice(invoiceId: string): Promise<ActionResult> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };

  const isAdminOrManager = access.profile.role === "admin" || access.profile.role === "manager";
  if (!isAdminOrManager) {
    return { success: false, error: "You do not have permission to delete invoices" };
  }

  if (!invoiceId) {
    return { success: false, error: "Invoice id is required" };
  }

  const { data: invoice, error: invoiceError } = await adminClient
    .from("invoices")
    .select("total_amount, payment_method, customer_id, invoice_items(product_id, qty)")
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    return { success: false, error: invoiceError?.message || "Invoice not found" };
  }

  const { error } = await adminClient.from("invoices").delete().eq("id", invoiceId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Restore stock
  try {
    for (const item of invoice.invoice_items || []) {
      const qty = Number(item.qty);
      const { data: product, error: productError } = await adminClient
        .from("products")
        .select("stock_qty")
        .eq("id", item.product_id)
        .single();
        
      if (product && !productError) {
        const newStock = Number(product.stock_qty) + qty;
        await adminClient.from("products").update({ stock_qty: newStock }).eq("id", item.product_id);
      }
    }
  } catch (err) {
    console.error("Failed to restore stock after invoice deletion", err);
  }

  // Restore customer balance if credit
  if (invoice.payment_method === "credit") {
    try {
      const { data: customer, error: customerError } = await adminClient
        .from("customers")
        .select("balance")
        .eq("id", invoice.customer_id)
        .single();

      if (customer && !customerError) {
        const newBalance = Math.max(0, Number(customer.balance) - Number(invoice.total_amount));
        await adminClient.from("customers").update({ balance: newBalance }).eq("id", invoice.customer_id);
      }
    } catch (err) {
      console.error("Failed to restore customer balance", err);
    }
  }

  revalidatePath("/invoices");
  revalidatePath("/products");
  revalidatePath("/customers");

  return { success: true, message: "Invoice deleted successfully" };
}
