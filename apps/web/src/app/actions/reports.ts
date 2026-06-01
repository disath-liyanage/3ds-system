"use server";

import type { UserRole } from "@paintdist/shared";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { categoryOptions } from "@/lib/product-category-options";

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
  toTimestamp?: string;
  workerId?: string;
  route?: string;
  customer?: string;
  customers?: string[];
  department?: string;
  category?: string;
  subcategory?: string;
  expenseUserId?: string;
  expenseCategory?: string;
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

export type SalesDepartmentCategorySubcategoryOptionsResponse = {
  success: boolean;
  error?: string;
  pairs?: Array<{ department: string; category: string; subcategory: string }>;
};

export type ProductCategoryOptionsResponse = {
  success: boolean;
  error?: string;
  options?: Array<{ value: string; label: string }>;
};

export type CustomerOutstandingFilterOptionsResponse = {
  success: boolean;
  error?: string;
  routes?: string[];
  customers?: string[];
};

export type CustomerFilterOptionsResponse = {
  success: boolean;
  error?: string;
  routes?: string[];
  customers?: string[];
};

export type SalaryWorkerOptionsResponse = {
  success: boolean;
  error?: string;
  workers?: Array<{ id: string; name: string }>;
};

export type ExpenseUserOptionsResponse = {
  success: boolean;
  error?: string;
  users?: Array<{ id: string; full_name: string }>;
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

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const reportPageSize = 1000;

function isValidDateInput(value: string) {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return false;
  const [year, month, day] = value.split("-").map(Number);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
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

function splitDepartmentCategorySubcategory(
  rawCategory: string | null | undefined
): { department: string; category: string; subcategory: string } {
  const text = String(rawCategory || "").trim();
  if (!text) return { department: "Uncategorized", category: "General", subcategory: "General" };

  const parts = text
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return { department: "Uncategorized", category: "General", subcategory: "General" };
  }

  const knownDepartments = new Set(["Import", "local", "JB", "Dubai"]);
  const head = parts[0] ?? "";

  if (!knownDepartments.has(head)) {
    const category = head || "General";
    const subcategory = parts.slice(1).join(" / ").trim() || "General";
    return { department: "local", category, subcategory };
  }

  if (parts.length >= 3) {
    return {
      department: parts[0] || "Uncategorized",
      category: parts[1] || "General",
      subcategory: parts.slice(2).join(" / ").trim() || "General"
    };
  }

  if (parts.length === 2) {
    return {
      department: parts[0] || "Uncategorized",
      category: parts[1] || "General",
      subcategory: "General"
    };
  }

  return { department: parts[0] || "Uncategorized", category: "General", subcategory: "General" };
}

function getMonthRangeFromYmd(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  return { year, month, monthStart, monthEnd };
}

function getMonthDistance(start: Date, end: Date) {
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
}

function getDaysInMonthUtc(year: number, monthZeroIndexed: number) {
  return new Date(Date.UTC(year, monthZeroIndexed + 1, 0)).getUTCDate();
}

function startOfDayUtc(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfDayUtc(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function dayKeyFromDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

async function calculateSalaryCostForRange(fromIso: string, toIso: string) {
  const { data: workers, error: workersError } = await adminClient.from("workers").select("id, name, salary_type, salary_amount");
  if (workersError) return { error: workersError };

  const { data: attendanceRows, error: attendanceError } = await adminClient
    .from("worker_attendance")
    .select("worker_id, attendance_date, status")
    .gte("attendance_date", fromIso.slice(0, 10))
    .lte("attendance_date", toIso.slice(0, 10));
  if (attendanceError) return { error: attendanceError };

  const attendanceMap = new Map<string, string>();
  for (const row of attendanceRows ?? []) {
    const workerId = String((row as any).worker_id || "");
    const date = String((row as any).attendance_date || "");
    const status = String((row as any).status || "");
    if (!workerId || !date) continue;
    attendanceMap.set(`${workerId}:${date}`, status);
  }

  const fromDate = startOfDayUtc(new Date(fromIso));
  const toDate = endOfDayUtc(new Date(toIso));
  const salaryByWorker = new Map<string, number>();
  const dayMs = 24 * 60 * 60 * 1000;

  for (const worker of workers ?? []) {
    const workerId = String((worker as any).id || "");
    if (!workerId) continue;
    const salaryAmount = Number((worker as any).salary_amount) || 0;
    const salaryType = String((worker as any).salary_type || "monthly_basic");
    let workerTotal = 0;

    if (salaryType === "daily") {
      for (let time = fromDate.getTime(); time <= toDate.getTime(); time += dayMs) {
        const date = new Date(time);
        const key = `${workerId}:${dayKeyFromDate(date)}`;
        const status = attendanceMap.get(key) || "absent";
        if (status === "present" || status === "holiday") workerTotal += salaryAmount;
        else if (status === "half_day") workerTotal += salaryAmount * 0.5;
      }
    } else {
      let cursor = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 1));
      const lastMonth = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), 1));
      while (cursor.getTime() <= lastMonth.getTime()) {
        const year = cursor.getUTCFullYear();
        const month = cursor.getUTCMonth();
        const monthStart = new Date(Date.UTC(year, month, 1));
        const monthEnd = new Date(Date.UTC(year, month, getDaysInMonthUtc(year, month), 23, 59, 59, 999));
        const segmentStart = new Date(Math.max(monthStart.getTime(), fromDate.getTime()));
        const segmentEnd = new Date(Math.min(monthEnd.getTime(), toDate.getTime()));
        const coveredDays = Math.floor((segmentEnd.getTime() - segmentStart.getTime()) / dayMs) + 1;
        const daysInMonth = getDaysInMonthUtc(year, month);
        if (coveredDays > 0 && daysInMonth > 0) {
          workerTotal += (salaryAmount * coveredDays) / daysInMonth;
        }
        cursor = new Date(Date.UTC(year, month + 1, 1));
      }
    }

    salaryByWorker.set(workerId, workerTotal);
  }

  const totalSalary = Array.from(salaryByWorker.values()).reduce((sum, amount) => sum + amount, 0);
  const employerEpf = totalSalary * 0.12;
  const employerEtf = totalSalary * 0.03;

  return { totalSalary, employerEpf, employerEtf };
}

async function fetchDateWiseSalesRows(fromIso: string, toIso: string) {
  const rows: Array<{ created_at: string; total_amount: number }> = [];
  for (let offset = 0; ; offset += reportPageSize) {
    const { data, error } = await adminClient
      .from("invoices")
      .select("created_at, total_amount")
      .eq("invoice_kind", "invoice")
      .in("status", ["approved", "issued", "paid"])
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: true })
      .range(offset, offset + reportPageSize - 1);

    if (error) return { error };
    if (!data || data.length === 0) break;
    rows.push(...(data as Array<{ created_at: string; total_amount: number }>));
    if (data.length < reportPageSize) break;
  }

  return { data: rows };
}

export async function getReportData(input: ReportQueryInput): Promise<ReportResponse> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };
  if (!canViewReports(access.profile)) return { success: false, error: "You do not have permission to view reports" };

  if (!input.from || !input.to) return { success: false, error: "Date range is required" };
  if (!isValidDateInput(input.from) || !isValidDateInput(input.to)) {
    return { success: false, error: "Invalid date range" };
  }
  if (input.from > input.to) return { success: false, error: "From date must be earlier than To date" };

  const { fromIso, toIso: toDateIso } = buildDateTimeRange(input.from, input.to);
  const parsedToTimestamp = input.toTimestamp ? new Date(input.toTimestamp) : null;
  const toIso =
    parsedToTimestamp && Number.isFinite(parsedToTimestamp.getTime())
      ? parsedToTimestamp.toISOString()
      : toDateIso;
  const reportKey = `${input.section}/${input.report}`;

  switch (reportKey) {
    case "sales/date-wise-sales-report": {
      const { data, error } = await fetchDateWiseSalesRows(fromIso, toIso);
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
        .eq("invoice_kind", "invoice")
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
    case "sales/quotation-sales-report": {
      const { data, error } = await adminClient
        .from("invoices")
        .select("id, quotation_number, created_at, total_amount, payment_method, status, customer:customers(name)")
        .eq("invoice_kind", "quotation")
        .in("status", ["approved", "issued", "paid"])
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("quotation_number", { ascending: false });
      if (error) return { success: false, error: error.message };
      return {
        success: true,
        data: {
          columns: ["Quotation No", "Date", "Customer", "P. Method", "Status", "Amount"],
          rows: (data ?? []).map((r: any) => ({
            __invoiceId: r.id ?? "",
            "Quotation No": `Q${Number(r.quotation_number) || 0}`,
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
        .eq("invoice_kind", "invoice")
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
            __cancelledInvoiceReportId: String(r.old_data?.invoice_id ?? ""),
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
        .select("qty, free_qty, unit_price, discount_type, discount_value, product:products(category), invoice:invoices!inner(status, created_at, invoice_kind)")
        .in("invoice.status", ["approved", "issued", "paid"])
        .eq("invoice.invoice_kind", "invoice")
        .gte("invoice.created_at", fromIso)
        .lte("invoice.created_at", toIso);
      if (error) return { success: false, error: error.message };
      const map = new Map<string, number>();
      for (const row of data ?? []) {
        const invoice = one((row as any).invoice);
        const product = one((row as any).product);
        const status = invoice?.status;
        if (!["approved", "issued", "paid"].includes(String(status))) continue;
        const categoryParts = splitDepartmentCategorySubcategory(product?.category);
        if (input.department && input.department !== "ALL" && categoryParts.department !== input.department) continue;
        if (input.category && input.category !== "ALL" && categoryParts.category !== input.category) continue;
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
        .select("qty, free_qty, unit_price, discount_type, discount_value, invoice:invoices!inner(status, created_at, invoice_kind, customer:customers(name))")
        .in("invoice.status", ["approved", "issued", "paid"])
        .eq("invoice.invoice_kind", "invoice")
        .gte("invoice.created_at", fromIso)
        .lte("invoice.created_at", toIso);
      if (error) return { success: false, error: error.message };
      const map = new Map<string, { qty: number; amount: number }>();
      for (const row of data ?? []) {
        const invoice = one((row as any).invoice);
        const customer = one(invoice?.customer as any);
        const status = invoice?.status;
        if (!["approved", "issued", "paid"].includes(String(status))) continue;
        const customerName = customer?.name || "Unknown";
        const qty = (Number(row.qty) || 0) + (Number(row.free_qty) || 0);
        const soldQty = Number(row.qty) || 0;
        const unitPrice = Number(row.unit_price) || 0;
        const discountValue = Number(row.discount_value) || 0;
        const discountType = row.discount_type === "percent" ? "percent" : "amount";
        const perUnitDiscount = discountType === "percent" ? (unitPrice * discountValue) / 100 : discountValue;
        const amount = Math.max(0, (unitPrice - perUnitDiscount) * soldQty);
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
        .eq("invoice_kind", "invoice")
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
        .select("qty, free_qty, product:products(name), invoice:invoices!inner(status, created_at, invoice_kind)")
        .in("invoice.status", ["approved", "issued", "paid"])
        .eq("invoice.invoice_kind", "invoice")
        .gte("invoice.created_at", fromIso)
        .lte("invoice.created_at", toIso);
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
      const customerQueries = Array.from(
        new Set(
          [
            ...(Array.isArray(input.customers) ? input.customers : []),
            input.customer
          ]
            .map((value) => String(value || "").trim().toLowerCase())
            .filter(Boolean)
        )
      );

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
        .filter((row) =>
          customerQueries.length > 0 ? customerQueries.includes(String(row.name).trim().toLowerCase()) : true
        );

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
        .in("payment_method", ["credit", "on_account"])
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
      const routeQueryRaw = String(input.route || "").trim();
      const routeQuery = routeQueryRaw.toUpperCase() === "ALL" ? "" : routeQueryRaw.toLowerCase();
      const customerQuery = String(input.customer || "").trim().toLowerCase();
      const { data, error } = await adminClient
        .from("customers")
        .select("name, phone, address, area, credit_limit, balance, created_at")
        .lte("created_at", toIso)
        .order("created_at", { ascending: false });
      if (error) return { success: false, error: error.message };
      const filteredRows = (data ?? [])
        .filter((row: any) => (routeQuery ? String(row.area || "").trim().toLowerCase() === routeQuery : true))
        .filter((row: any) => (customerQuery ? String(row.name || "").trim().toLowerCase() === customerQuery : true));
      return {
        success: true,
        data: {
          columns: ["Customer", "Phone", "Address", "Route", "Credit Limit", "Balance", "Created Date"],
          rows: filteredRows.map((r: any) => ({
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
      const filteredRows = (data ?? []).filter((row: any) => {
        const { department, subcategory } = splitDepartmentCategory(row.category);
        if (input.department && input.department !== "ALL" && department !== input.department) return false;
        if (input.subcategory && input.subcategory !== "ALL" && subcategory !== input.subcategory) return false;
        return true;
      });
      return {
        success: true,
        data: {
          columns: ["Product", "Category", "Unit", "Stock Qty", "Low Stock Threshold"],
          rows: filteredRows.map((r: any) => ({
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
        .select("qty, created_at, product:products(name, category), return_invoice:return_invoices!return_invoice_items_return_invoice_id_fkey(id, return_number)")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false });
      if (error) return { success: false, error: error.message };
      return {
        success: true,
        data: {
          columns: ["Date", "Return No", "Product", "Category", "Returned Qty"],
          rows: (data ?? []).map((r: any) => ({
            __returnInvoiceId: r.return_invoice?.id ?? "",
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
        .select("qty, free_qty, unit_cost, created_at, product:products(name), receive_note:receive_notes!receive_note_items_receive_note_id_fkey(id, rn_number, supplier_name)")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("rn_number", { ascending: false, referencedTable: "receive_note" })
        .order("created_at", { ascending: false });
      if (error) return { success: false, error: error.message };

      const groupedRows = new Map<
        string,
        {
          rnNumber: number;
          supplier: string;
          rows: Array<Record<string, string | number>>;
          totalAmount: number;
        }
      >();
      const formatShortDate = (raw: string) => {
        const d = new Date(raw);
        if (!Number.isFinite(d.getTime())) return String(raw).slice(0, 10);
        return `${String(d.getUTCFullYear()).slice(-2)}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
      };
      for (const r of data ?? []) {
        const receiveNote = one((r as any).receive_note);
        const product = one((r as any).product);
        const receiveNoteId = String(receiveNote?.id ?? "");
        if (!groupedRows.has(receiveNoteId)) {
          groupedRows.set(receiveNoteId, {
            rnNumber: Number(receiveNote?.rn_number) || 0,
            supplier: receiveNote?.supplier_name || "",
            rows: [],
            totalAmount: 0
          });
        }
        const group = groupedRows.get(receiveNoteId)!;
        const qty = Number(r.qty) || 0;
        const unitCost = Number(r.unit_cost) || 0;
        const amount = qty * unitCost;
        const isFirstLine = group.rows.length === 0;
        group.totalAmount += amount;
        group.rows.push({
          __rowType: "grn-item",
          __receiveNoteId: isFirstLine ? receiveNoteId : "",
          Date: formatShortDate(String(r.created_at)),
          "GRN No": isFirstLine ? group.rnNumber : "",
          Supplier: isFirstLine ? group.supplier : "",
          Product: product?.name || "Unknown Product",
          Qty: qty,
          "Free Qty": Number(r.free_qty) || 0,
          "Unit Cost": unitCost,
          Amount: amount
        });
      }

      const rows: Array<Record<string, string | number>> = [];
      let grandTotalAmount = 0;
      for (const group of groupedRows.values()) {
        rows.push(...group.rows);
        rows.push({
          __rowType: "grn-total",
          Date: "",
          "GRN No": "",
          Supplier: "",
          Product: "GRN Total",
          Qty: "",
          "Free Qty": "",
          "Unit Cost": "",
          Amount: group.totalAmount
        });
        grandTotalAmount += group.totalAmount;
      }
      rows.push({
        __rowType: "grn-grand-total",
        Date: "",
        "GRN No": "",
        Supplier: "",
        Product: "Grand Total",
        Qty: "",
        "Free Qty": "",
        "Unit Cost": "",
        Amount: grandTotalAmount
      });

      return {
        success: true,
        data: {
          columns: ["Date", "GRN No", "Supplier", "Product", "Qty", "Free Qty", "Unit Cost", "Amount"],
          rows
        }
      };
    }
    case "salary/salary-slip": {
      if (access.profile.role !== "admin" && access.profile.role !== "manager") {
        return { success: false, error: "You do not have permission to view salary slips" };
      }
      if (!input.workerId) return { success: false, error: "Worker is required" };
      const { monthStart, monthEnd, year } = getMonthRangeFromYmd(input.from);
      const fromMonthIso = monthStart.toISOString();
      const toMonthIso = monthEnd.toISOString();

      const { data: worker, error: workerError } = await adminClient
        .from("workers")
        .select("id, name, salary_amount")
        .eq("id", input.workerId)
        .maybeSingle();
      if (workerError || !worker) return { success: false, error: workerError?.message || "Worker not found" };

      const { data: workerUser, error: workerUserError } = await adminClient
        .from("users_profile")
        .select("id")
        .eq("worker_id", input.workerId)
        .maybeSingle();
      if (workerUserError) return { success: false, error: workerUserError.message };

      const workerUserId = workerUser?.id ?? null;

      let salesCommission = 0;
      if (workerUserId) {
        const { data: invoiceItems, error: invoiceItemsError } = await adminClient
          .from("invoice_items")
          .select(
            "qty, unit_price, discount_type, discount_value, product_id, invoice:invoices!inner(created_at, status, customer:customers!inner(sales_rep_id))"
          )
          .eq("invoice.customer.sales_rep_id", workerUserId)
          .in("invoice.status", ["approved", "issued", "paid"])
          .gte("invoice.created_at", fromMonthIso)
          .lte("invoice.created_at", toMonthIso);
        if (invoiceItemsError) return { success: false, error: invoiceItemsError.message };

        const productIds = Array.from(
          new Set((invoiceItems ?? []).map((row: any) => String(row.product_id || "")).filter(Boolean))
        );
        const rateMap = new Map<string, number>();
        if (productIds.length > 0) {
          const rateResults = await Promise.all(
            productIds.map(async (productId) => {
              const { data, error } = await adminClient
                .from("receive_note_items")
                .select("product_id, rep_sales_discount, created_at")
                .eq("product_id", productId)
                .order("created_at", { ascending: false })
                .limit(1);
              return { productId, data, error };
            })
          );
          for (const result of rateResults) {
            if (result.error) return { success: false, error: result.error.message };
            const row = result.data?.[0];
            const productId = String((row as any)?.product_id || result.productId || "");
            if (!productId) continue;
            rateMap.set(productId, Number((row as any)?.rep_sales_discount) || 0);
          }
        }
        for (const item of invoiceItems ?? []) {
          const qty = Number((item as any).qty) || 0;
          const unitPrice = Number((item as any).unit_price) || 0;
          const discountType = (item as any).discount_type === "percent" ? "percent" : "amount";
          const discountValue = Number((item as any).discount_value) || 0;
          const productId = String((item as any).product_id || "");
          const rate = rateMap.get(productId) ?? 0;
          if (qty <= 0 || unitPrice <= 0 || rate <= 0) continue;
          const discountPerUnit = discountType === "percent" ? (unitPrice * discountValue) / 100 : discountValue;
          const effectiveUnitPrice = Math.max(0, unitPrice - discountPerUnit);
          const lineTotal = qty * effectiveUnitPrice;
          salesCommission += lineTotal * (rate / 100);
        }
      }

      let collectionCommission = 0;
      if (workerUserId) {
        const { data: collectionIncentives, error: collectionIncentivesError } = await adminClient
          .from("collection_incentives")
          .select("amount, created_at, sales_rep_id")
          .eq("sales_rep_id", workerUserId)
          .gte("created_at", fromMonthIso)
          .lte("created_at", toMonthIso);
        if (collectionIncentivesError) return { success: false, error: collectionIncentivesError.message };
        for (const row of collectionIncentives ?? []) {
          collectionCommission += Number((row as any).amount) || 0;
        }
      }

      const { data: attendanceRows, error: attendanceError } = await adminClient
        .from("worker_attendance")
        .select("attendance_date, status")
        .eq("worker_id", input.workerId)
        .gte("attendance_date", String(fromMonthIso).slice(0, 10))
        .lte("attendance_date", String(toMonthIso).slice(0, 10));
      if (attendanceError) return { success: false, error: attendanceError.message };

      const holidayRows = (await import("@/lib/sri-lanka-holidays")).getSriLankaHolidays(year);
      const holidayDates = new Set<string>(holidayRows.map((holiday) => holiday.date));
      const totalDaysInMonth = monthEnd.getUTCDate();
      let totalWorkingDays = 0;
      for (let day = 1; day <= totalDaysInMonth; day += 1) {
        const key = `${year}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (!holidayDates.has(key)) totalWorkingDays += 1;
      }

      const attendanceMap = new Map<string, string>();
      for (const row of attendanceRows ?? []) {
        attendanceMap.set(String((row as any).attendance_date || ""), String((row as any).status || ""));
      }

      let presentEquivalent = 0;
      for (let day = 1; day <= totalDaysInMonth; day += 1) {
        const dateKey = `${year}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (holidayDates.has(dateKey)) continue;
        const status = attendanceMap.get(dateKey) || "absent";
        if (status === "present" || status === "holiday") presentEquivalent += 1;
        else if (status === "half_day") presentEquivalent += 0.5;
      }

      const missingDays = totalWorkingDays - presentEquivalent;
      let attendanceIncentive = 0;
      if (missingDays <= 0) attendanceIncentive = 7500;
      else if (missingDays <= 1) attendanceIncentive = 6500;
      else if (missingDays <= 2) attendanceIncentive = 5500;
      else if (missingDays <= 3) attendanceIncentive = 4500;
      else if (missingDays <= 4) attendanceIncentive = 3500;

      const { data: deductions, error: deductionsError } = await adminClient
        .from("worker_deductions")
        .select("deduction_type, amount, months, monthly_amount, created_at")
        .eq("worker_id", input.workerId);
      if (deductionsError) return { success: false, error: deductionsError.message };

      let advanceDeduction = 0;
      let loanDeduction = 0;
      for (const row of deductions ?? []) {
        const createdAt = new Date(String((row as any).created_at || ""));
        if (!Number.isFinite(createdAt.getTime())) continue;
        const monthsDiff = getMonthDistance(
          new Date(Date.UTC(createdAt.getUTCFullYear(), createdAt.getUTCMonth(), 1)),
          new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1))
        );

        const type = String((row as any).deduction_type || "");
        if (type === "advance") {
          if (monthsDiff === 0) advanceDeduction += Number((row as any).amount) || 0;
        } else if (type === "loan") {
          const months = Number((row as any).months) || 0;
          if (monthsDiff >= 0 && monthsDiff < months) {
            loanDeduction += Number((row as any).monthly_amount) || 0;
          }
        }
      }

      const basicSalary = Number((worker as any).salary_amount) || 0;
      let targetAchievementIncentive = 0;
      if (workerUserId) {
        const { data: targetRow, error: targetError } = await adminClient
          .from("sales_rep_monthly_targets")
          .select("target_amount, incentive_amount")
          .eq("sales_rep_id", workerUserId)
          .eq("target_month", monthStart.toISOString().slice(0, 10))
          .maybeSingle();
        if (targetError) return { success: false, error: targetError.message };

        const { data: monthlySalesRows, error: monthlySalesError } = await adminClient
          .from("invoices")
          .select("total_amount")
          .eq("issued_by", workerUserId)
          .in("status", ["approved", "issued", "paid"])
          .gte("created_at", monthStart.toISOString())
          .lte("created_at", monthEnd.toISOString());
        if (monthlySalesError) return { success: false, error: monthlySalesError.message };
        const totalMonthlySales = (monthlySalesRows ?? []).reduce((sum, row: any) => sum + (Number(row.total_amount) || 0), 0);
        const targetAmount = Number((targetRow as any)?.target_amount) || 0;
        const incentiveAmount = Number((targetRow as any)?.incentive_amount) || 0;
        if (targetAmount > 0 && totalMonthlySales >= targetAmount) {
          targetAchievementIncentive = incentiveAmount;
        }
      }

      const employeeEpf = basicSalary * 0.08;
      const employerEpf = basicSalary * 0.12;
      const employerEtf = basicSalary * 0.03;
      const grossSalary = basicSalary + salesCommission + collectionCommission + attendanceIncentive + targetAchievementIncentive;
      const totalDeductions = advanceDeduction + loanDeduction;
      const netSalary = grossSalary - totalDeductions - employeeEpf;

      const rows: Array<Record<string, string | number>> = [
        { Item: "Basic Salary", Amount: basicSalary, __bucket: "gain" },
        { Item: "Sales Commission", Amount: salesCommission, __bucket: "gain" },
        { Item: "Collection Commission", Amount: collectionCommission, __bucket: "gain" }
      ];
      if (attendanceIncentive > 0) {
        rows.push({ Item: "Attendance Incentive", Amount: attendanceIncentive, __bucket: "gain" });
      }
      if (targetAchievementIncentive > 0) {
        rows.push({ Item: "Target Achievement Incentive", Amount: targetAchievementIncentive, __bucket: "gain" });
      }
      if (advanceDeduction > 0) {
        rows.push({ Item: "Advance Deduction", Amount: advanceDeduction, __bucket: "deduction" });
      }
      if (loanDeduction > 0) {
        rows.push({ Item: "Loan Deduction", Amount: loanDeduction, __bucket: "deduction" });
      }
      if (totalDeductions > 0) {
        rows.push({ Item: "Total Deductions", Amount: totalDeductions, __bucket: "deduction" });
      }
      rows.push(
        { Item: "Employee EPF (8%)", Amount: employeeEpf, __bucket: "deduction" },
        { Item: "Net Salary", Amount: netSalary, __bucket: "final" },
        { Item: "Employer EPF (12%)", Amount: employerEpf, __bucket: "stat" },
        { Item: "Employer ETF (3%)", Amount: employerEtf, __bucket: "stat" },
        { Item: "Total Work Days (Excluding Holidays)", Amount: totalWorkingDays, __bucket: "meta" },
        { Item: "Attendance Count", Amount: presentEquivalent, __bucket: "meta" }
      );

      return {
        success: true,
        data: {
          columns: ["Item", "Amount"],
          rows: rows.map((row) => ({ ...row, __workerName: worker.name || "" }))
        }
      };
    }
    case "profit/profit-summary": {
      const { data: salesRows, error: salesError } = await adminClient
        .from("invoices")
        .select("total_amount")
        .in("status", ["approved", "issued", "paid"])
        .gte("created_at", fromIso)
        .lte("created_at", toIso);
      if (salesError) return { success: false, error: salesError.message };

      const salaryCost = await calculateSalaryCostForRange(fromIso, toIso);
      if ("error" in salaryCost) {
        return { success: false, error: salaryCost.error?.message || "Failed to calculate salary cost" };
      }

      const { data: expenseRows, error: expenseError } = await adminClient
        .from("collection_expenses")
        .select("amount")
        .in("status", ["pending", "approved"])
        .gte("created_at", fromIso)
        .lte("created_at", toIso);
      if (expenseError) return { success: false, error: expenseError.message };

      const totalSales = (salesRows ?? []).reduce((sum, row: any) => sum + (Number(row.total_amount) || 0), 0);
      const totalExpenses = (expenseRows ?? []).reduce((sum, row: any) => sum + (Number(row.amount) || 0), 0);
      const totalDeductions =
        salaryCost.totalSalary + salaryCost.employerEpf + salaryCost.employerEtf + totalExpenses;
      const remainingAmount = totalSales - totalDeductions;

      return {
        success: true,
        data: {
          columns: ["Item", "Amount"],
          rows: [
            { Item: "Total Sales", Amount: totalSales },
            { Item: "Total Employee Salary", Amount: salaryCost.totalSalary },
            { Item: "Employer EPF (12%)", Amount: salaryCost.employerEpf },
            { Item: "Employer ETF (3%)", Amount: salaryCost.employerEtf },
            { Item: "Total Expenses", Amount: totalExpenses },
            { Item: "Total Deductions", Amount: totalDeductions },
            { Item: "Remaining Amount", Amount: remainingAmount }
          ]
        }
      };
    }
    case "expenses/expenses-by-user": {
      let query = adminClient
        .from("collection_expenses")
        .select("id, category, amount, notes, status, created_at, user:users_profile!collection_expenses_sales_rep_id_fkey(full_name, role)")
        .in("status", ["pending", "approved"])
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false });
      if (input.expenseUserId && input.expenseUserId !== "ALL") {
        query = query.eq("sales_rep_id", input.expenseUserId);
      }
      if (input.expenseCategory && input.expenseCategory !== "ALL") {
        query = query.eq("category", input.expenseCategory);
      }
      const { data: expenseRows, error: expenseError } = await query;
      if (expenseError) return { success: false, error: expenseError.message };

      return {
        success: true,
        data: {
          columns: ["Date", "User / Worker", "Role", "Category", "Amount", "Note", "Status"],
          rows: (expenseRows ?? []).map((row: any) => {
            const user = one(row.user);
            return {
              Date: String(row.created_at || "").slice(0, 10),
              "User / Worker": user?.full_name || "Unknown",
              Role: user?.role || "unknown",
              Category: row.category || "Other",
              Amount: Number(row.amount) || 0,
              Note: row.notes || "-",
              Status: row.status || "pending"
            };
          })
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

  const departmentSet = new Set<string>(["Import", "local", "JB", "Dubai"]);
  for (const row of data ?? []) {
    const categoryParts = splitDepartmentCategory(row.category);
    const department = categoryParts.department;
    if (!department) continue;
    if (department === "Import" || department === "local" || department === "JB" || department === "Dubai") {
      departmentSet.add(department);
    }
  }

  const preferredOrder = ["Import", "local", "JB", "Dubai"];
  const departments = ["ALL", ...preferredOrder.filter((department) => departmentSet.has(department))];
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

export async function getSalesDepartmentCategorySubcategoryOptions(): Promise<SalesDepartmentCategorySubcategoryOptionsResponse> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };
  if (!canViewReports(access.profile)) return { success: false, error: "You do not have permission to view reports" };

  const { data, error } = await adminClient
    .from("products")
    .select("category")
    .order("category", { ascending: true });
  if (error) return { success: false, error: error.message };

  const pairs: Array<{ department: string; category: string; subcategory: string }> = [];
  const seen = new Set<string>();
  for (const row of data ?? []) {
    const parts = splitDepartmentCategorySubcategory(row.category);
    if (!parts.department || !parts.category || !parts.subcategory) continue;
    const key = `${parts.department}::${parts.category}::${parts.subcategory}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push(parts);
  }

  return { success: true, pairs };
}

export async function getProductCategoryOptions(): Promise<ProductCategoryOptionsResponse> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };
  if (!canViewReports(access.profile)) return { success: false, error: "You do not have permission to view reports" };

  return { success: true, options: categoryOptions };
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

export async function getCustomerFilterOptions(): Promise<CustomerFilterOptionsResponse> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };
  if (!canViewReports(access.profile)) return { success: false, error: "You do not have permission to view reports" };

  const { data, error } = await adminClient.from("customers").select("name, area").order("name");
  if (error) return { success: false, error: error.message };

  const routeSet = new Set<string>();
  const customerSet = new Set<string>();
  for (const row of data ?? []) {
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

export async function getSalaryWorkerOptions(): Promise<SalaryWorkerOptionsResponse> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };
  if (!canViewReports(access.profile)) return { success: false, error: "You do not have permission to view reports" };
  if (access.profile.role !== "admin" && access.profile.role !== "manager") {
    return { success: false, error: "You do not have permission to view salary slips" };
  }

  const { data, error } = await adminClient.from("workers").select("id, name").order("name", { ascending: true });
  if (error) return { success: false, error: error.message };

  return {
    success: true,
    workers: (data ?? []).map((worker: any) => ({ id: String(worker.id), name: String(worker.name || "") }))
  };
}

export async function getExpenseUserOptions(): Promise<ExpenseUserOptionsResponse> {
  const access = await getCurrentUserProfile();
  if ("error" in access) return { success: false, error: access.error };
  if (!canViewReports(access.profile)) return { success: false, error: "You do not have permission to view reports" };

  const { data, error } = await adminClient
    .from("users_profile")
    .select("id, full_name")
    .order("full_name", { ascending: true });
  if (error) return { success: false, error: error.message };

  const users = (data ?? [])
    .map((row: any) => ({ id: String(row.id || ""), full_name: String(row.full_name || "").trim() }))
    .filter((row) => row.id && row.full_name);

  return { success: true, users };
}
