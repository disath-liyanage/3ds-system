"use server";

import type { UserRole } from "@paintdist/shared";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type CustomRolePermissionSummary = {
  perm_view_reports: boolean;
};

type ProfilePermissionRow = {
  id: string;
  email: string;
  role: UserRole;
  custom_role_id?: string | null;
  custom_role: CustomRolePermissionSummary | CustomRolePermissionSummary[] | null;
};

export type ReportResult = {
  columns: string[];
  rows: Array<Record<string, string | number>>;
};

export type ReportResponse = {
  success: boolean;
  error?: string;
  data?: ReportResult;
};

export type ReportQueryInput = {
  section: string;
  report: string;
  from: string;
  to: string;
  route?: string;
  customer?: string;
  department?: string;
  subcategory?: string;
};

export type SalesRouteOptionsResponse = {
  success: boolean;
  error?: string;
  routes?: string[];
};

export type SalesDepartmentOptionsResponse = {
  success: boolean;
  error?: string;
  departments?: string[];
};

export type SalesDepartmentSubcategoryOptionsResponse = {
  success: boolean;
  error?: string;
  pairs?: Array<{ department: string; subcategory: string }>;
};

export type CustomerOutstandingFilterOptionsResponse = {
  success: boolean;
  error?: string;
  routes?: string[];
  customers?: string[];
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function getCurrentUserProfile() {
  const supabase = createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) return { error: "Unauthorized" as const };

  const { data: profile, error: profileError } = await adminClient
    .from("users_profile")
    .select("id, email, role, custom_role_id")
    .eq("id", user.id)
    .maybeSingle<ProfilePermissionRow>();

  if (profileError || !profile) return { error: profileError?.message || "Profile not found" as const };

  let custom_role: CustomRolePermissionSummary | null = null;
  if (profile.custom_role_id) {
    const { data: roleRow } = await adminClient
      .from("custom_roles")
      .select("perm_view_reports")
      .eq("id", profile.custom_role_id)
      .maybeSingle<CustomRolePermissionSummary>();
    custom_role = roleRow ?? null;
  }

  return { profile: { ...profile, custom_role } };
}

function canViewReports(profile: ProfilePermissionRow): boolean {
  const roleRelation = profile.custom_role;
  const customRole = Array.isArray(roleRelation) ? roleRelation[0] || null : roleRelation;
  return profile.role === "admin" || profile.role === "manager" || Boolean(customRole?.perm_view_reports);
}

function buildDateTimeRange(from: string, to: string) {
  const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString();
  const toIso = new Date(`${to}T23:59:59.999Z`).toISOString();
  return { fromIso, toIso };
}

function splitDepartmentCategory(rawCategory: string | null | undefined): { department: string; subcategory: string } {
  const text = String(rawCategory || "").trim();
  if (!text) return { department: "Uncategorized", subcategory: "General" };

  const delimiters = [" / ", " > ", "/", ">"];
  for (const delimiter of delimiters) {
    if (!text.includes(delimiter)) continue;
    const [head, ...tail] = text.split(delimiter).map((part) => part.trim()).filter(Boolean);
    if (!head) break;
    const sub = tail.join(" / ").trim();
    return {
      department: head,
      subcategory: sub || "General"
    };
  }

  return { department: text, subcategory: "General" };
}

export async function getReportData(input: ReportQueryInput): Promise<ReportResponse> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };
  if (!canViewReports(access.profile)) return { success: false, error: "You do not have permission to view reports" };

  if (!input.from || !input.to) return { success: false, error: "Date range is required" };
  if (input.from > input.to) return { success: false, error: "From date must be earlier than To date" };

  const { fromIso, toIso } = buildDateTimeRange(input.from, input.to);
  const reportKey = `${input.section}/${input.report}`;

  switch (reportKey) {
    case "sales/date-wise-sales-report": {
      const { data, error } = await adminClient
        .from("invoices")
        .select("created_at, total_amount")
        .in("status", ["approved", "issued", "paid"])
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: true });
      if (error) return { success: false, error: error.message };
      const map = new Map<string, number>();
      for (const row of data ?? []) {
        const d = String(row.created_at).slice(0, 10);
        map.set(d, (map.get(d) || 0) + (Number(row.total_amount) || 0));
      }
      const rows = Array.from(map.entries()).map(([Date, amount]) => ({ Date, "Sales Amount": amount }));
      const totalSalesAmount = rows.reduce((sum, row) => sum + (Number(row["Sales Amount"]) || 0), 0);
      return {
        success: true,
        data: { columns: ["Date", "Sales Amount"], rows: [...rows, { Date: "Total", "Sales Amount": totalSalesAmount }] }
      };
    }
    case "sales/invoice-wise-sales-report": {
      const { data, error } = await adminClient
        .from("invoices")
        .select("id, invoice_number, created_at, total_amount, payment_method, status, customer:customers(name)")
        .in("status", ["approved", "issued", "paid"])
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("invoice_number", { ascending: false });
      if (error) return { success: false, error: error.message };
      return {
        success: true,
        data: {
          columns: ["Invoice No", "Date", "Customer", "P. Method", "Status", "Amount"],
          rows: (data ?? []).map((r: any) => ({
            __invoiceId: r.id ?? "",
            "Invoice No": Number(r.invoice_number) || 0,
            Date: String(r.created_at).slice(0, 10),
            Customer: r.customer?.name ?? "Unknown",
            "P. Method": r.payment_method ?? "",
            Status: r.status ?? "",
            Amount: Number(r.total_amount) || 0
          }))
        }
      };
    }
    case "sales/route-wise-sales-report": {
      const { data, error } = await adminClient
        .from("invoices")
        .select("total_amount, created_at, customer:customers(area)")
        .in("status", ["approved", "issued", "paid"])
        .gte("created_at", fromIso)
        .lte("created_at", toIso);
      if (error) return { success: false, error: error.message };
      const map = new Map<string, number>();
      for (const row of data ?? []) {
        const customer = one((row as any).customer);
        const route = customer?.area || "Unassigned";
        if (input.route && input.route !== "ALL" && route !== input.route) continue;
        map.set(route, (map.get(route) || 0) + (Number(row.total_amount) || 0));
      }
      const rows = Array.from(map.entries()).map(([Route, amount]) => ({ Route, "Sales Amount": amount }));
      const totalSalesAmount = rows.reduce((sum, row) => sum + (Number(row["Sales Amount"]) || 0), 0);
      return { success: true, data: { columns: ["Route", "Sales Amount"], rows: [...rows, { Route: "Total", "Sales Amount": totalSalesAmount }] } };
    }
    case "sales/return-invoice-report": {
      const { data, error } = await adminClient
        .from("return_invoices")
        .select("id, return_number, total_return_amount, created_at, customer:customers(name), source_invoice:invoices!return_invoices_invoice_id_fkey(invoice_number)")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("return_number", { ascending: false });
      if (error) return { success: false, error: error.message };
      return {
        success: true,
        data: {
          columns: ["Return No", "Date", "Invoice Number", "Customer", "Return Amount"],
          rows: (data ?? []).map((r: any) => ({
            __returnInvoiceId: r.id ?? "",
            "Return No": Number(r.return_number) || 0,
            Date: String(r.created_at).slice(0, 10),
            "Invoice Number": Number(r.source_invoice?.invoice_number) || 0,
            Customer: r.customer?.name ?? "Unknown",
            "Return Amount": Number(r.total_return_amount) || 0
          }))
        }
      };
    }
    case "sales/delete-invoice-report": {
      const { data, error } = await adminClient
        .from("audit_log")
        .select("id, created_at, old_data")
        .eq("table_name", "invoice_cancellations")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false });
      if (error) return { success: false, error: error.message };
      return {
        success: true,
        data: {
          columns: ["Cancelled At", "Invoice Number", "Product Qty", "Free Qty"],
          rows: (data ?? []).map((r: any) => ({
            __cancelledInvoiceReportId: r.id ?? "",
            "Cancelled At": String(r.created_at).slice(0, 10),
            "Invoice Number": Number(r.old_data?.invoice_number) || 0,
            "Product Qty": Number(r.old_data?.qty) || 0,
            "Free Qty": Number(r.old_data?.free_qty) || 0
          }))
        }
      };
    }
    case "sales/department-wise-sales-invoice": {
      const { data, error } = await adminClient
        .from("invoice_items")
        .select("qty, free_qty, unit_price, discount_type, discount_value, created_at, product:products(category), invoice:invoices!invoice_items_invoice_id_fkey(status, created_at)")
        .gte("created_at", fromIso)
        .lte("created_at", toIso);
      if (error) return { success: false, error: error.message };
      const map = new Map<string, number>();
      for (const row of data ?? []) {
        const invoice = one((row as any).invoice);
        const product = one((row as any).product);
        const status = invoice?.status;
        if (!["approved", "issued", "paid"].includes(String(status))) continue;
        const categoryParts = splitDepartmentCategory(product?.category);
        if (input.department && input.department !== "ALL" && categoryParts.department !== input.department) continue;
        if (input.subcategory && input.subcategory !== "ALL" && categoryParts.subcategory !== input.subcategory) continue;
        const qty = Number(row.qty) || 0;
        const unitPrice = Number(row.unit_price) || 0;
        const discountValue = Number(row.discount_value) || 0;
        const discountType = row.discount_type === "percent" ? "percent" : "amount";
        const perUnitDiscount = discountType === "percent" ? (unitPrice * discountValue) / 100 : discountValue;
        const line = Math.max(0, (unitPrice - perUnitDiscount) * qty);
        map.set(categoryParts.department, (map.get(categoryParts.department) || 0) + line);
      }
      return { success: true, data: { columns: ["Department", "Sales Amount"], rows: Array.from(map.entries()).map(([Department, amount]) => ({ Department, "Sales Amount": amount })) } };
    }
    case "sales/customer-wise-sales-and-quantity-summary": {
      const { data, error } = await adminClient
        .from("invoice_items")
        .select("qty, free_qty, unit_price, created_at, invoice:invoices!invoice_items_invoice_id_fkey(status, customer:customers(name))")
        .gte("created_at", fromIso)
        .lte("created_at", toIso);
      if (error) return { success: false, error: error.message };
      const map = new Map<string, { qty: number; amount: number }>();
      for (const row of data ?? []) {
        const invoice = one((row as any).invoice);
        const customer = one(invoice?.customer as any);
        const status = invoice?.status;
        if (!["approved", "issued", "paid"].includes(String(status))) continue;
        const customerName = customer?.name || "Unknown";
        const qty = (Number(row.qty) || 0) + (Number(row.free_qty) || 0);
        const amount = (Number(row.qty) || 0) * (Number(row.unit_price) || 0);
        const prev = map.get(customerName) || { qty: 0, amount: 0 };
        map.set(customerName, { qty: prev.qty + qty, amount: prev.amount + amount });
      }
      return {
        success: true,
        data: {
          columns: ["Customer", "Total Qty", "Sales Amount"],
          rows: Array.from(map.entries()).map(([Customer, v]) => ({ Customer, "Total Qty": v.qty, "Sales Amount": v.amount }))
        }
      };
    }
    case "sales/route-wise-invoice-payment-details": {
      const { data, error } = await adminClient
        .from("invoices")
        .select("id, invoice_number, total_amount, payment_method, created_at, customer:customers(name, area)")
        .in("status", ["approved", "issued", "paid"])
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("invoice_number", { ascending: false });
      if (error) return { success: false, error: error.message };
      return {
        success: true,
        data: {
          columns: ["Route", "Invoice No", "Customer", "P. Method", "Amount"],
          rows: (data ?? []).map((r: any) => ({
            __invoiceId: r.id ?? "",
            Route: r.customer?.area || "Unassigned",
            "Invoice No": Number(r.invoice_number) || 0,
            Customer: r.customer?.name || "Unknown",
            "P. Method": r.payment_method || "",
            Amount: Number(r.total_amount) || 0
          }))
        }
      };
    }
    case "sales/fast-moving-products-report":
    case "sales/product-wise-sales-qty-reports": {
      const { data, error } = await adminClient
        .from("invoice_items")
        .select("qty, free_qty, created_at, product:products(name)")
        .gte("created_at", fromIso)
        .lte("created_at", toIso);
      if (error) return { success: false, error: error.message };
      const map = new Map<string, number>();
      for (const row of data ?? []) {
        const product = one((row as any).product);
        const name = product?.name || "Unknown Product";
        const qty = (Number(row.qty) || 0) + (Number(row.free_qty) || 0);
        map.set(name, (map.get(name) || 0) + qty);
      }
      const rows = Array.from(map.entries())
        .map(([product, soldQty]) => ({ Product: product, "Sold Qty": soldQty }))
        .sort((a, b) => Number(b["Sold Qty"]) - Number(a["Sold Qty"]));
      return { success: true, data: { columns: ["Product", "Sold Qty"], rows } };
    }
    case "customer/customer-outstanding-reports": {
      const { data: customers, error: customersError } = await adminClient
        .from("customers")
        .select("id, name, area, balance")
        .order("name");
      if (customersError) return { success: false, error: customersError.message };

      const { data: invoices, error: invoicesError } = await adminClient
        .from("invoices")
        .select("id, customer_id, invoice_number, total_amount, created_at, status")
        .in("status", ["approved", "issued", "paid"])
        .order("created_at", { ascending: true });
      if (invoicesError) return { success: false, error: invoicesError.message };

      const routeQueryRaw = String(input.route || "").trim();
      const routeQuery = routeQueryRaw.toUpperCase() === "ALL" ? "" : routeQueryRaw.toLowerCase();
      const customerQuery = String(input.customer || "").trim().toLowerCase();

      const invoiceIds = (invoices ?? []).map((invoice: any) => String(invoice.id)).filter(Boolean);
      const collectionTotals = new Map<string, number>();
      if (invoiceIds.length > 0) {
        const { data: collections, error: collectionsError } = await adminClient
          .from("collections")
          .select("invoice_id, amount, status")
          .in("invoice_id", invoiceIds)
          .eq("status", "validated");
        if (collectionsError) return { success: false, error: collectionsError.message };
        for (const row of collections ?? []) {
          const invoiceId = String((row as any).invoice_id || "");
          if (!invoiceId) continue;
          collectionTotals.set(invoiceId, (collectionTotals.get(invoiceId) ?? 0) + (Number((row as any).amount) || 0));
        }
      }

      const invoicesByCustomer = new Map<
        string,
        Array<{ id: string; invoice_number: number; created_at: string; total_amount: number; remaining_amount: number }>
      >();
      for (const invoice of invoices ?? []) {
        const invoiceId = String((invoice as any).id || "");
        const customerId = String((invoice as any).customer_id || "");
        if (!invoiceId || !customerId) continue;
        const totalAmount = Number((invoice as any).total_amount) || 0;
        const collected = collectionTotals.get(invoiceId) ?? 0;
        const remainingAmount = Math.max(0, totalAmount - collected);
        if (remainingAmount <= 0) continue;
        const list = invoicesByCustomer.get(customerId) ?? [];
        list.push({
          id: invoiceId,
          invoice_number: Number((invoice as any).invoice_number) || 0,
          created_at: String((invoice as any).created_at || ""),
          total_amount: totalAmount,
          remaining_amount: remainingAmount
        });
        invoicesByCustomer.set(customerId, list);
      }

      const rows: Array<Record<string, string | number>> = [];
      const filteredCustomers = (customers ?? [])
        .map((r: any) => ({
          id: String(r.id || ""),
          name: r.name || "",
          area: r.area || "",
          balance: Number(r.balance) || 0
        }))
        .filter((row) => (routeQuery ? String(row.area).trim().toLowerCase() === routeQuery : true))
        .filter((row) => (customerQuery ? String(row.name).trim().toLowerCase() === customerQuery : true));

      for (const customer of filteredCustomers) {
        const customerInvoices = (invoicesByCustomer.get(customer.id) ?? []).sort((a, b) => a.invoice_number - b.invoice_number);
        if (customerInvoices.length === 0) continue;
        const totalOutstanding = customerInvoices.reduce((sum, item) => sum + item.remaining_amount, 0);

        rows.push({
          __rowType: "customer",
          "Customer / Invoice": customer.name,
          "Route / Date Issued": customer.area || "-",
          "Total Outstanding / Amount": totalOutstanding
        });

        for (const [invoiceIndex, invoice] of customerInvoices.entries()) {
          rows.push({
            __rowType: "invoice",
            __invoiceId: invoice.id,
            __isLastInvoice: invoiceIndex === customerInvoices.length - 1 ? 1 : 0,
            "Customer / Invoice": invoice.invoice_number,
            "Route / Date Issued": String(invoice.created_at).slice(0, 10),
            "Total Outstanding / Amount": invoice.remaining_amount
          });
        }

        rows.push({
          __rowType: "divider",
          "Customer / Invoice": "",
          "Route / Date Issued": "",
          "Total Outstanding / Amount": ""
        });
      }

      return {
        success: true,
        data: {
          columns: ["Customer / Invoice", "Route / Date Issued", "Total Outstanding / Amount"],
          rows
        }
      };
    }
    case "customer/daily-revenue-report": {
      const { data, error } = await adminClient
        .from("collections")
        .select("created_at, amount, status")
        .eq("status", "validated")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: true });
      if (error) return { success: false, error: error.message };
      const map = new Map<string, number>();
      for (const row of data ?? []) {
        const d = String(row.created_at).slice(0, 10);
        map.set(d, (map.get(d) || 0) + (Number(row.amount) || 0));
      }
      return { success: true, data: { columns: ["Date", "Revenue"], rows: Array.from(map.entries()).map(([Date, Revenue]) => ({ Date, Revenue })) } };
    }
    case "customer/available-credit-invoices": {
      const { data, error } = await adminClient
        .from("invoices")
        .select("invoice_number, total_amount, created_at, status, customer:customers(name)")
        .eq("payment_method", "credit")
        .in("status", ["approved", "issued"])
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("invoice_number", { ascending: false });
      if (error) return { success: false, error: error.message };
      return {
        success: true,
        data: {
          columns: ["Invoice No", "Date", "Customer", "Status", "Amount"],
          rows: (data ?? []).map((r: any) => ({
            "Invoice No": Number(r.invoice_number) || 0,
            Date: String(r.created_at).slice(0, 10),
            Customer: r.customer?.name || "Unknown",
            Status: r.status || "",
            Amount: Number(r.total_amount) || 0
          }))
        }
      };
    }
    case "customer/cacel-customer-payments": {
      const { data, error } = await adminClient
        .from("audit_log")
        .select("created_at, old_data")
        .eq("table_name", "collections")
        .eq("action", "delete")
        .order("created_at", { ascending: false });
      if (error) return { success: false, error: error.message };

      const fromMs = new Date(fromIso).getTime();
      const toMs = new Date(toIso).getTime();
      const inRange = (value: unknown) => {
        const raw = String(value || "");
        const ms = new Date(raw).getTime();
        return Number.isFinite(ms) && ms >= fromMs && ms <= toMs;
      };

      return {
        success: true,
        data: {
          columns: ["Collection No", "Deleted At", "Customer", "Status", "Amount"],
          rows: (data ?? [])
            .filter((r: any) => inRange(r.created_at) || inRange(r.old_data?.created_at))
            .map((r: any) => ({
              "Collection No": Number(r.old_data?.collection_number) || 0,
              "Deleted At": String(r.created_at).slice(0, 10),
              Customer: r.old_data?.customer_name || "Unknown",
              Status: "deleted",
              Amount: Number(r.old_data?.amount) || 0
            }))
        }
      };
    }
    case "customer/customer-payment-details": {
      const { data, error } = await adminClient
        .from("collections")
        .select("id, collection_number, amount, payment_type, cheque_deposit_date, status, created_at, customer:customers(name)")
        .eq("status", "validated")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("collection_number", { ascending: false });
      if (error) return { success: false, error: error.message };
      return {
        success: true,
        data: {
          columns: ["Collection No", "Date", "Customer", "Payment Type", "Cheque Date", "Status", "Amount"],
          rows: (data ?? []).map((r: any) => ({
            "Collection No": Number(r.collection_number) || 0,
            Date: String(r.created_at).slice(0, 10),
            Customer: r.customer?.name || "Unknown",
            "Payment Type": r.payment_type || "",
            "Cheque Date": r.cheque_deposit_date || "-",
            Status: r.status || "",
            Amount: Number(r.amount) || 0,
            __collectionId: r.id ?? ""
          }))
        }
      };
    }
    case "customer/date-wise-cheque-payment-details": {
      const { data, error } = await adminClient
        .from("collections")
        .select("collection_number, amount, cheque_deposit_date, created_at, status, customer:customers(name)")
        .eq("payment_type", "cheque")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: true });
      if (error) return { success: false, error: error.message };
      return {
        success: true,
        data: {
          columns: ["Date", "Collection No", "Customer", "Cheque Deposit Date", "Status", "Amount"],
          rows: (data ?? []).map((r: any) => ({
            Date: String(r.created_at).slice(0, 10),
            "Collection No": Number(r.collection_number) || 0,
            Customer: r.customer?.name || "Unknown",
            "Cheque Deposit Date": r.cheque_deposit_date || "-",
            Status: r.status || "",
            Amount: Number(r.amount) || 0
          }))
        }
      };
    }
    case "customer/customer-details": {
      const { data, error } = await adminClient
        .from("customers")
        .select("name, phone, address, area, credit_limit, balance, created_at")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false });
      if (error) return { success: false, error: error.message };
      return {
        success: true,
        data: {
          columns: ["Customer", "Phone", "Address", "Route", "Credit Limit", "Balance", "Created Date"],
          rows: (data ?? []).map((r: any) => ({
            Customer: r.name || "",
            Phone: r.phone || "",
            Address: r.address || "",
            Route: r.area || "",
            "Credit Limit": Number(r.credit_limit) || 0,
            Balance: Number(r.balance) || 0,
            "Created Date": String(r.created_at).slice(0, 10)
          }))
        }
      };
    }
    case "stock/product-stock-summary": {
      const { data, error } = await adminClient
        .from("products")
        .select("name, category, unit, stock_qty, low_stock_threshold")
        .order("name", { ascending: true });
      if (error) return { success: false, error: error.message };
      return {
        success: true,
        data: {
          columns: ["Product", "Category", "Unit", "Stock Qty", "Low Stock Threshold"],
          rows: (data ?? []).map((r: any) => ({
            Product: r.name || "",
            Category: r.category || "",
            Unit: r.unit || "",
            "Stock Qty": Number(r.stock_qty) || 0,
            "Low Stock Threshold": Number(r.low_stock_threshold) || 0
          }))
        }
      };
    }
    case "stock/categorization-wise-stock-reports": {
      const { data, error } = await adminClient.from("products").select("category, stock_qty");
      if (error) return { success: false, error: error.message };
      const map = new Map<string, number>();
      for (const row of data ?? []) {
        const category = row.category || "Uncategorized";
        map.set(category, (map.get(category) || 0) + (Number(row.stock_qty) || 0));
      }
      return {
        success: true,
        data: {
          columns: ["Category", "Stock Qty"],
          rows: Array.from(map.entries()).map(([category, stockQty]) => ({ Category: category, "Stock Qty": stockQty }))
        }
      };
    }
    case "stock/return-stock-details": {
      const { data, error } = await adminClient
        .from("return_invoice_items")
        .select("qty, created_at, product:products(name, category), return_invoice:return_invoices!return_invoice_items_return_invoice_id_fkey(return_number)")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false });
      if (error) return { success: false, error: error.message };
      return {
        success: true,
        data: {
          columns: ["Date", "Return No", "Product", "Category", "Returned Qty"],
          rows: (data ?? []).map((r: any) => ({
            Date: String(r.created_at).slice(0, 10),
            "Return No": Number(r.return_invoice?.return_number) || 0,
            Product: r.product?.name || "Unknown Product",
            Category: r.product?.category || "Uncategorized",
            "Returned Qty": Number(r.qty) || 0
          }))
        }
      };
    }
    case "grn/goods-received-note-reports": {
      const { data, error } = await adminClient
        .from("receive_note_items")
        .select("qty, free_qty, unit_cost, created_at, product:products(name, category), receive_note:receive_notes!receive_note_items_receive_note_id_fkey(rn_number, supplier_name)")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false });
      if (error) return { success: false, error: error.message };
      return {
        success: true,
        data: {
          columns: ["Date", "GRN No", "Supplier", "Product", "Category", "Qty", "Free Qty", "Unit Cost"],
          rows: (data ?? []).map((r: any) => ({
            Date: String(r.created_at).slice(0, 10),
            "GRN No": Number(r.receive_note?.rn_number) || 0,
            Supplier: r.receive_note?.supplier_name || "",
            Product: r.product?.name || "Unknown Product",
            Category: r.product?.category || "Uncategorized",
            Qty: Number(r.qty) || 0,
            "Free Qty": Number(r.free_qty) || 0,
            "Unit Cost": Number(r.unit_cost) || 0
          }))
        }
      };
    }
    default:
      return { success: false, error: "Unsupported report key" };
  }
}

export async function getSalesRouteOptions(): Promise<SalesRouteOptionsResponse> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };
  if (!canViewReports(access.profile)) return { success: false, error: "You do not have permission to view reports" };

  const { data, error } = await adminClient.from("customers").select("area").order("area", { ascending: true });
  if (error) return { success: false, error: error.message };

  const routeSet = new Set<string>();
  for (const row of data ?? []) {
    const route = String(row.area || "").trim();
    if (!route) continue;
    routeSet.add(route);
  }

  const routes = ["ALL", ...Array.from(routeSet)];
  return { success: true, routes };
}

export async function getSalesDepartmentOptions(): Promise<SalesDepartmentOptionsResponse> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };
  if (!canViewReports(access.profile)) return { success: false, error: "You do not have permission to view reports" };

  const { data, error } = await adminClient.from("products").select("category").order("category", { ascending: true });
  if (error) return { success: false, error: error.message };

  const departmentSet = new Set<string>();
  for (const row of data ?? []) {
    const categoryParts = splitDepartmentCategory(row.category);
    const department = categoryParts.department;
    if (!department) continue;
    departmentSet.add(department);
  }

  const departments = ["ALL", ...Array.from(departmentSet)];
  return { success: true, departments };
}

export async function getSalesDepartmentSubcategoryOptions(): Promise<SalesDepartmentSubcategoryOptionsResponse> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };
  if (!canViewReports(access.profile)) return { success: false, error: "You do not have permission to view reports" };

  const { data, error } = await adminClient
    .from("products")
    .select("category, name")
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) return { success: false, error: error.message };

  const pairs: Array<{ department: string; subcategory: string }> = [];
  const seen = new Set<string>();
  for (const row of data ?? []) {
    const categoryParts = splitDepartmentCategory(row.category);
    const department = categoryParts.department;
    const subcategory = categoryParts.subcategory;
    if (!department || !subcategory) continue;
    const key = `${department}::${subcategory}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ department, subcategory });
  }

  return { success: true, pairs };
}

export async function getCustomerOutstandingFilterOptions(): Promise<CustomerOutstandingFilterOptionsResponse> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };
  if (!canViewReports(access.profile)) return { success: false, error: "You do not have permission to view reports" };

  const { data, error } = await adminClient.from("customers").select("name, area, balance").order("name");
  if (error) return { success: false, error: error.message };

  const routeSet = new Set<string>();
  const customerSet = new Set<string>();
  for (const row of data ?? []) {
    const balance = Number((row as { balance?: unknown }).balance) || 0;
    if (balance <= 0) continue;

    const route = String((row as { area?: unknown }).area || "").trim();
    const customer = String((row as { name?: unknown }).name || "").trim();
    if (route) routeSet.add(route);
    if (customer) customerSet.add(customer);
  }

  return {
    success: true,
    routes: Array.from(routeSet).sort((a, b) => a.localeCompare(b)),
    customers: Array.from(customerSet).sort((a, b) => a.localeCompare(b))
  };
}
