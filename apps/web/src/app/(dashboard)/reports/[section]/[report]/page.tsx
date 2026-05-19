"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import { Download, Printer } from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";
import { pdf } from "@react-pdf/renderer";
import "react-day-picker/dist/style.css";

import {
  getCustomerFilterOptions,
  getCustomerOutstandingFilterOptions,
  getProductCategoryOptions,
  getSalesDepartmentCategorySubcategoryOptions,
  getExpenseUserOptions,
  getReportData,
  getSalaryWorkerOptions,
  getSalesDepartmentSubcategoryOptions,
  getSalesDepartmentOptions,
  getSalesRouteOptions,
  type ReportResult
} from "@/app/actions/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { Select } from "@/components/ui/select";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { ReportPdfTemplate } from "@/lib/pdf/report-template";
import { getReportItem, getReportSection } from "../../reports-data";

type ReportDetailPageProps = {
  params: {
    section: string;
    report: string;
  };
};

function todayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function ymd(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function getMonthRange(monthsBack: number): DateRange {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0);
  return { from: firstDay, to: lastDay };
}

export default function ReportDetailPage({ params }: ReportDetailPageProps) {
  const section = getReportSection(params.section);
  const report = getReportItem(params.section, params.report);

  const today = todayDate();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: today, to: today });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reportUser, setReportUser] = useState("ALL");
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const { permissions, isLoading: isPermissionsLoading } = useCurrentUserPermissions();
  const canExportReports = Boolean(permissions?.canExportReports);
  const exportDisabled = isPermissionsLoading || !canExportReports;

  const reportTitle = report?.title ?? "Report";
  const sectionTitle = section?.title ?? "Reports";
  const reportKey = section && report ? `${section.key}/${report.key}` : "";
  const isRouteWiseSalesReport = reportKey === "sales/route-wise-sales-report";
  const isDepartmentWiseSalesReport = reportKey === "sales/department-wise-sales-invoice";
  const isCustomerOutstandingReport = reportKey === "customer/customer-outstanding-reports";
  const isGrnReport = reportKey === "grn/goods-received-note-reports";
  const isCustomerDetailsReport = reportKey === "customer/customer-details";
  const isOutstandingStyleCustomerFilterReport = isCustomerOutstandingReport || isCustomerDetailsReport;
  const isCustomerPaymentDetailsReport = reportKey === "customer/customer-payment-details";
  const isProductStockSummaryReport = reportKey === "stock/product-stock-summary";
  const isSalarySlipReport = reportKey === "salary/salary-slip";
  const isExpensesByUserReport = reportKey === "expenses/expenses-by-user";
  const isDepartmentCategorySubcategoryFilterReport = isDepartmentWiseSalesReport;
  const isDepartmentSubdepartmentFilterReport = isProductStockSummaryReport;
  const [routeFilter, setRouteFilter] = useState("ALL");
  const [routeOptions, setRouteOptions] = useState<Array<{ value: string; label: string }>>([
    { value: "ALL", label: "All routes" }
  ]);
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [departmentOptions, setDepartmentOptions] = useState<Array<{ value: string; label: string }>>([
    { value: "ALL", label: "All departments" }
  ]);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [categoryOptions, setCategoryOptions] = useState<Array<{ value: string; label: string }>>([
    { value: "ALL", label: "All categories" }
  ]);
  const [subcategoryFilter, setSubcategoryFilter] = useState("ALL");
  const [customerFilter, setCustomerFilter] = useState("");
  const [customerOptions, setCustomerOptions] = useState<SearchableSelectOption[]>([]);
  const [departmentSubcategoryPairs, setDepartmentSubcategoryPairs] = useState<
    Array<{ department: string; subcategory: string }>
  >([]);
  const [departmentCategorySubcategoryPairs, setDepartmentCategorySubcategoryPairs] = useState<
    Array<{ department: string; category: string; subcategory: string }>
  >([]);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [salaryWorkerId, setSalaryWorkerId] = useState("");
  const [salaryWorkerOptions, setSalaryWorkerOptions] = useState<SearchableSelectOption[]>([]);
  const [salaryMonth, setSalaryMonth] = useState(format(new Date(), "yyyy-MM"));
  const [expenseUserId, setExpenseUserId] = useState("ALL");
  const [expenseCategory, setExpenseCategory] = useState("ALL");
  const [expenseUserOptions, setExpenseUserOptions] = useState<Array<{ value: string; label: string }>>([
    { value: "ALL", label: "All users" }
  ]);
  const expenseCategoryOptions: Array<{ value: string; label: string }> = [
    { value: "ALL", label: "All categories" },
    { value: "Fuel", label: "Fuel" },
    { value: "Food", label: "Food" },
    { value: "Parking", label: "Parking" },
    { value: "Other", label: "Other" }
  ];

  const activeMode: "detail" = "detail";

  useEffect(() => {
    if (!isRouteWiseSalesReport) return;
    let active = true;

    const loadRoutes = async () => {
      const response = await getSalesRouteOptions();
      if (!active || !response.success || !response.routes) return;

      const options = response.routes.map((route) => ({
        value: route,
        label: route === "ALL" ? "All routes" : route
      }));
      setRouteOptions(options);
    };

    void loadRoutes();
    return () => {
      active = false;
    };
  }, [isRouteWiseSalesReport]);

  useEffect(() => {
    if (!isDepartmentSubdepartmentFilterReport) return;
    let active = true;

    const loadDepartments = async () => {
      const response = await getSalesDepartmentOptions();
      if (!active || !response.success || !response.departments) return;

      const options = response.departments.map((department) => ({
        value: department,
        label: department === "ALL" ? "All departments" : department
      }));
      setDepartmentOptions(options);

      const pairsResponse = await getSalesDepartmentSubcategoryOptions();
      if (!active || !pairsResponse.success || !pairsResponse.pairs) return;
      setDepartmentSubcategoryPairs(pairsResponse.pairs);
    };

    void loadDepartments();
    return () => {
      active = false;
    };
  }, [isDepartmentSubdepartmentFilterReport]);

  useEffect(() => {
    if (!isDepartmentCategorySubcategoryFilterReport) return;
    let active = true;

    const loadDepartmentCategorySubcategoryOptions = async () => {
      const response = await getSalesDepartmentOptions();
      if (!active || !response.success || !response.departments) return;

      const options = response.departments.map((department) => ({
        value: department,
        label: department === "ALL" ? "All departments" : department
      }));
      setDepartmentOptions(options);

      const pairsResponse = await getSalesDepartmentCategorySubcategoryOptions();
      if (!active || !pairsResponse.success || !pairsResponse.pairs) return;
      setDepartmentCategorySubcategoryPairs(pairsResponse.pairs);

      const categoryOptionsResponse = await getProductCategoryOptions();
      if (!active || !categoryOptionsResponse.success || !categoryOptionsResponse.options) return;
      setCategoryOptions([{ value: "ALL", label: "All categories" }, ...categoryOptionsResponse.options]);
    };

    void loadDepartmentCategorySubcategoryOptions();
    return () => {
      active = false;
    };
  }, [isDepartmentCategorySubcategoryFilterReport]);

  const departmentWiseSubcategoryOptions = useMemo(() => {
    const filtered = departmentCategorySubcategoryPairs.filter(
      (pair) =>
        (departmentFilter === "ALL" || pair.department === departmentFilter) &&
        (categoryFilter === "ALL" || pair.category === categoryFilter)
    );
    const names = Array.from(
      new Set(
        filtered
          .map((pair) => pair.subcategory)
          .filter((name) => Boolean(name) && name !== "General")
      )
    );
    return [{ value: "ALL", label: "All subcategories" }, ...names.map((name) => ({ value: name, label: name }))];
  }, [categoryFilter, departmentCategorySubcategoryPairs, departmentFilter]);

  const subcategoryOptions = useMemo(() => {
    const filtered = departmentSubcategoryPairs.filter(
      (pair) => departmentFilter === "ALL" || pair.department === departmentFilter
    );
    const names = Array.from(new Set(filtered.map((pair) => pair.subcategory)));
    return [{ value: "ALL", label: "All subcategories" }, ...names.map((name) => ({ value: name, label: name }))];
  }, [departmentFilter, departmentSubcategoryPairs]);

  useEffect(() => {
    if (!isDepartmentSubdepartmentFilterReport) return;
    if (!subcategoryOptions.some((option) => option.value === subcategoryFilter)) {
      setSubcategoryFilter("ALL");
    }
  }, [isDepartmentSubdepartmentFilterReport, subcategoryFilter, subcategoryOptions]);

  useEffect(() => {
    if (!isDepartmentCategorySubcategoryFilterReport) return;
    if (!categoryOptions.some((option) => option.value === categoryFilter)) {
      setCategoryFilter("ALL");
    }
  }, [categoryFilter, categoryOptions, isDepartmentCategorySubcategoryFilterReport]);

  useEffect(() => {
    if (!isDepartmentCategorySubcategoryFilterReport) return;
    if (!departmentWiseSubcategoryOptions.some((option) => option.value === subcategoryFilter)) {
      setSubcategoryFilter("ALL");
    }
  }, [departmentWiseSubcategoryOptions, isDepartmentCategorySubcategoryFilterReport, subcategoryFilter]);

  useEffect(() => {
    if (!isSalarySlipReport) return;
    let active = true;

    const loadWorkers = async () => {
      const response = await getSalaryWorkerOptions();
      if (!active || !response.success || !response.workers) return;
      setSalaryWorkerOptions(response.workers.map((worker) => ({ value: worker.id, label: worker.name })));
    };

    void loadWorkers();
    return () => {
      active = false;
    };
  }, [isSalarySlipReport]);

  useEffect(() => {
    if (!isExpensesByUserReport) return;
    let active = true;
    const loadExpenseUsers = async () => {
      const response = await getExpenseUserOptions();
      if (!active || !response.success || !response.users) return;
      setExpenseUserOptions([
        { value: "ALL", label: "All users" },
        ...response.users.map((user) => ({ value: user.id, label: user.full_name }))
      ]);
    };
    void loadExpenseUsers();
    return () => {
      active = false;
    };
  }, [isExpensesByUserReport]);

  useEffect(() => {
    if (!isOutstandingStyleCustomerFilterReport) return;
    let active = true;

    const loadFilters = async () => {
      const response = isCustomerDetailsReport
        ? await getCustomerFilterOptions()
        : await getCustomerOutstandingFilterOptions();
      if (!active || !response.success) return;
      setRouteOptions([
        { value: "ALL", label: "All routes" },
        ...((response.routes || []).map((route) => ({ value: route, label: route })))
      ]);
      setCustomerOptions((response.customers || []).map((customer) => ({ value: customer, label: customer })));
    };

    void loadFilters();
    return () => {
      active = false;
    };
  }, [isCustomerDetailsReport, isOutstandingStyleCustomerFilterReport]);

  const dateRangeLabel = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, "MMM dd, yyyy")} - ${format(dateRange.to, "MMM dd, yyyy")}`;
    }
    if (dateRange?.from) {
      return `${format(dateRange.from, "MMM dd, yyyy")} - ...`;
    }
    return "Select date range";
  }, [dateRange]);

  useEffect(() => {
    if (!isDatePickerOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!datePickerRef.current || datePickerRef.current.contains(event.target as Node)) return;
      setIsDatePickerOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDatePickerOpen]);

  useEffect(() => {
    let mounted = true;
    const loadCurrentUser = async () => {
      try {
        const response = await fetch("/api/current-user-profile", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        const name = payload?.user?.full_name || payload?.user?.email;
        if (mounted && typeof name === "string" && name.trim().length > 0) {
          setReportUser(name.trim());
        }
      } catch {
        // Keep fallback when user lookup fails.
      }
    };
    void loadCurrentUser();
    return () => {
      mounted = false;
    };
  }, []);

  const runReport = () => {
    if (!section || !report) {
      setError("Invalid report");
      return;
    }

    if (isSalarySlipReport && (!salaryWorkerId || !salaryMonth)) {
      setError("Please select worker and month");
      return;
    }
    if (!isOutstandingStyleCustomerFilterReport && !isProductStockSummaryReport && !isSalarySlipReport && (!dateRange?.from || !dateRange?.to)) {
      setError("Please select a complete date range");
      return;
    }

    startTransition(async () => {
      setError("");
      const runTimestamp = new Date().toISOString();
      const reportFromDate = isProductStockSummaryReport
        ? today
        : isCustomerDetailsReport
        ? new Date("1970-01-01T00:00:00.000Z")
        : isCustomerOutstandingReport
          ? today
          : isSalarySlipReport
            ? new Date(`${salaryMonth}-01T00:00:00.000Z`)
          : (dateRange?.from ?? today);
      const reportToDate = isOutstandingStyleCustomerFilterReport || isProductStockSummaryReport
        ? today
        : isSalarySlipReport
          ? new Date(`${salaryMonth}-01T00:00:00.000Z`)
          : (dateRange?.to ?? reportFromDate);
      const response = await getReportData({
        section: section.key,
        report: report.key,
        from: ymd(reportFromDate),
        to: ymd(reportToDate),
        workerId: isSalarySlipReport ? salaryWorkerId : undefined,
        toTimestamp: isCustomerDetailsReport ? runTimestamp : undefined,
        route: isRouteWiseSalesReport || isOutstandingStyleCustomerFilterReport ? routeFilter : undefined,
        customer: isOutstandingStyleCustomerFilterReport ? customerFilter : undefined,
        category: isDepartmentCategorySubcategoryFilterReport ? categoryFilter : undefined,
        subcategory: isDepartmentSubdepartmentFilterReport || isDepartmentCategorySubcategoryFilterReport ? subcategoryFilter : undefined,
        department: isDepartmentSubdepartmentFilterReport || isDepartmentCategorySubcategoryFilterReport ? departmentFilter : undefined,
        expenseUserId: isExpensesByUserReport ? expenseUserId : undefined,
        expenseCategory: isExpensesByUserReport ? expenseCategory : undefined
      });
      if (!response.success || !response.data) {
        setResult(null);
        setError(response.error || "Failed to load report");
        return;
      }
      setResult(response.data);
    });
  };

  const sortedRows = useMemo(() => {
    if (!result) return [];
    if (!sortColumn) return result.rows;
    const hasStructuredRows = result.rows.some((row) => typeof row.__rowType === "string");
    if (hasStructuredRows || reportKey === "customer/customer-outstanding-reports" || isGrnReport) {
      return result.rows;
    }
    const rows = [...result.rows];
    rows.sort((a, b) => {
      const av = a[sortColumn];
      const bv = b[sortColumn];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDirection === "asc" ? av - bv : bv - av;
      }
      const aText = String(av ?? "");
      const bText = String(bv ?? "");
      return sortDirection === "asc" ? aText.localeCompare(bText) : bText.localeCompare(aText);
    });
    return rows;
  }, [result, sortColumn, sortDirection, reportKey, isGrnReport]);

  const activeResult = useMemo(() => {
    if (!result) return null;
    return { ...result, rows: sortedRows };
  }, [result, sortedRows]);
  const totalRows = activeResult?.rows.length ?? 0;
  async function buildReportPdfBlob() {
    if (!activeResult || !section || !report) return null;
    return pdf(
      <ReportPdfTemplate
        reportTitle={report.title}
        reportKey={reportKey}
        fromDate={isSalarySlipReport ? `${salaryMonth}-01` : dateRange?.from ? ymd(dateRange.from as Date) : ""}
        toDate={isSalarySlipReport ? `${salaryMonth}-01` : dateRange?.to ? ymd(dateRange.to as Date) : ""}
        reportDate={format(new Date(), "dd-MM-yyyy")}
        userName={reportUser}
        mode={activeMode}
        result={activeResult}
      />
    ).toBlob();
  }

  const downloadPdf = async () => {
    if (exportDisabled || !activeResult || !section || !report) return;

    setIsExportingPdf(true);
    try {
      const blob = await buildReportPdfBlob();
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${section.key}-${report.key}-${activeMode}-${ymd(new Date())}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const printPdf = () => {
    if (exportDisabled || !previewFrameRef.current) return;
    previewFrameRef.current.contentWindow?.focus();
    previewFrameRef.current.contentWindow?.print();
  };

  const numericColumns = useMemo(() => {
    if (!activeResult) return new Set<string>();
    const out = new Set<string>();
    for (const col of activeResult.columns) {
      if (/invoice\s*(no|number)/i.test(col)) continue;
      const isNumeric = activeResult.rows.every((row) => typeof row[col] === "number");
      if (isNumeric) out.add(col);
    }
    return out;
  }, [activeResult]);

  const totalRowConfig = useMemo(() => {
    if (!activeResult || activeMode !== "detail") return null;
    if (reportKey === "sales/invoice-wise-sales-report") {
      const total = activeResult.rows.reduce((sum, row) => sum + (Number(row.Amount) || 0), 0);
      return { labelColumn: "Invoice No", amountColumn: "Amount", total, label: "Total" };
    }
    if (reportKey === "sales/return-invoice-report") {
      const total = activeResult.rows.reduce((sum, row) => sum + (Number(row["Return Amount"]) || 0), 0);
      return { labelColumn: "Return No", amountColumn: "Return Amount", total, label: "Total" };
    }
    if (reportKey === "expenses/expenses-by-user") {
      const total = activeResult.rows.reduce((sum, row) => sum + (Number(row.Amount) || 0), 0);
      return { labelColumn: "Category", amountColumn: "Amount", total, label: "Total" };
    }
    return null;
  }, [activeResult, reportKey, activeMode]);

  const grnShadeMap = useMemo(() => {
    const out = new Map<string, string>();
    if (!isGrnReport || !activeResult) return out;
    let colorIndex = 0;
    for (const row of activeResult.rows) {
      const grnNo = String(row["GRN No"] ?? "");
      if (!grnNo || out.has(grnNo)) continue;
      out.set(grnNo, colorIndex % 2 === 0 ? "bg-slate-50" : "bg-amber-50");
      colorIndex += 1;
    }
    return out;
  }, [activeResult, isGrnReport]);

  const expenseUserShadeMap = useMemo(() => {
    const out = new Map<string, string>();
    if (!isExpensesByUserReport || !activeResult) return out;
    const shades = ["bg-slate-50", "bg-amber-50", "bg-emerald-50", "bg-sky-50"];
    let colorIndex = 0;
    for (const row of activeResult.rows) {
      const userName = String(row["User / Worker"] ?? "").trim();
      if (!userName || out.has(userName)) continue;
      out.set(userName, shades[colorIndex % shades.length]);
      colorIndex += 1;
    }
    return out;
  }, [activeResult, isExpensesByUserReport]);

  const onSortColumn = (column: string) => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection("asc");
      return;
    }
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const generatePreview = async () => {
      if (!activeResult || !section || !report) {
        setPreviewUrl(null);
        return;
      }
      const blob = await buildReportPdfBlob();
      if (!blob || cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
    };
    void generatePreview();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [activeResult, section, report, activeMode, dateRangeLabel, reportUser]);

  if (!section || !report) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Report Not Found</h1>
        <Link href="/reports" className="text-sm underline-offset-2 hover:underline">
          Back to reports
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{sectionTitle}</p>
        <h1 className="text-2xl font-bold">{reportTitle}</h1>
        <p className="text-sm text-muted-foreground">
          {isOutstandingStyleCustomerFilterReport
            ? "Select a route or customer and run the report."
            : "Select a date range and run the report."}
        </p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Filters</CardTitle>
            {isExpensesByUserReport ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const today = todayDate();
                  setExpenseUserId("ALL");
                  setExpenseCategory("ALL");
                  setDateRange({ from: today, to: today });
                }}
              >
                Reset
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isSalarySlipReport ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Worker</label>
                <SearchableSelect
                  value={salaryWorkerId}
                  options={salaryWorkerOptions}
                  placeholder="Search and select worker"
                  onChange={(value) => setSalaryWorkerId(value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Month</label>
                <input
                  type="month"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={salaryMonth}
                  onChange={(event) => setSalaryMonth(event.target.value)}
                />
              </div>
            </div>
          ) : isOutstandingStyleCustomerFilterReport ? (
            <div className="space-y-1">
              <label className="text-sm font-medium">Route or Customer</label>
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] md:items-center">
                <SearchableSelect
                  value={routeFilter === "ALL" ? "" : routeFilter}
                  options={routeOptions
                    .filter((option) => option.value !== "ALL")
                    .map((option) => ({ value: option.value, label: option.label }))}
                  placeholder="Search and select route"
                  onChange={(value) => {
                    setRouteFilter(value || "ALL");
                    if (value) setCustomerFilter("");
                  }}
                />
                <span className="px-1 text-sm text-muted-foreground text-center">/</span>
                <SearchableSelect
                  value={customerFilter}
                  options={customerOptions}
                  placeholder="Search and select customer"
                  onChange={(value) => {
                    setCustomerFilter(value);
                    if (value) setRouteFilter("ALL");
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRouteFilter("ALL");
                    setCustomerFilter("");
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>
          ) : isRouteWiseSalesReport ? (
            <div className="space-y-1">
              <label className="text-sm font-medium">Route</label>
              <Select
                value={routeFilter}
                options={routeOptions}
                onChange={(event) => setRouteFilter(event.target.value)}
              />
            </div>
          ) : null}

          {isDepartmentCategorySubcategoryFilterReport ? (
            <div className="space-y-1">
              <label className="text-sm font-medium">Department / Category / Sub category</label>
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                <Select
                  value={departmentFilter}
                  options={departmentOptions}
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                />
                <Select
                  value={categoryFilter}
                  options={categoryOptions}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                />
                <Select
                  value={subcategoryFilter}
                  options={departmentWiseSubcategoryOptions}
                  onChange={(event) => setSubcategoryFilter(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDepartmentFilter("ALL");
                    setCategoryFilter("ALL");
                    setSubcategoryFilter("ALL");
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>
          ) : isDepartmentSubdepartmentFilterReport ? (
            <div className="space-y-1">
              <label className="text-sm font-medium">Department / Sub Department</label>
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                <Select
                  value={departmentFilter}
                  options={departmentOptions}
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                />
                <Select
                  value={subcategoryFilter}
                  options={subcategoryOptions}
                  onChange={(event) => setSubcategoryFilter(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDepartmentFilter("ALL");
                    setSubcategoryFilter("ALL");
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>
          ) : null}

          {isExpensesByUserReport ? (
            <div className="space-y-3" ref={datePickerRef}>
              <div className="grid gap-2 md:grid-cols-2 md:items-center">
                <Select
                  value={expenseUserId}
                  options={expenseUserOptions}
                  onChange={(event) => setExpenseUserId(event.target.value)}
                />
                <Select
                  value={expenseCategory}
                  options={expenseCategoryOptions}
                  onChange={(event) => setExpenseCategory(event.target.value)}
                />
              </div>
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen((prev) => !prev)}
                  className="flex h-10 min-w-[260px] items-center justify-between rounded-md border border-input bg-background px-3 text-sm text-foreground transition focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <span className={dateRange?.from ? "text-foreground" : "text-muted-foreground"}>{dateRangeLabel}</span>
                  <span className="text-xs text-muted-foreground">Pick</span>
                </button>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDateRange(getMonthRange(0))}>
                    This Month
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDateRange(getMonthRange(1))}>
                    Last Month
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDateRange(getMonthRange(2))}>
                    Month Before Last
                  </Button>
                </div>
              </div>
              {isDatePickerOpen ? (
                <div className="relative">
                  <div className="absolute z-20 mt-2 rounded-md border border-border bg-white p-3 shadow-lg">
                    <DayPicker
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      defaultMonth={dateRange?.from}
                      className="rounded-md"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : isOutstandingStyleCustomerFilterReport || isProductStockSummaryReport || isSalarySlipReport ? null : (
            <div className="space-y-1" ref={datePickerRef}>
              <label className="text-sm font-medium">Date Range</label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen((prev) => !prev)}
                  className="flex h-10 min-w-[260px] flex-1 items-center justify-between rounded-md border border-input bg-background px-3 text-sm text-foreground transition focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <span className={dateRange?.from ? "text-foreground" : "text-muted-foreground"}>{dateRangeLabel}</span>
                  <span className="text-xs text-muted-foreground">Pick</span>
                </button>
                <Button type="button" variant="outline" size="sm" onClick={() => setDateRange(getMonthRange(0))}>
                  This Month
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setDateRange(getMonthRange(1))}>
                  Last Month
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setDateRange(getMonthRange(2))}>
                  Month Before Last
                </Button>
              </div>
              {isDatePickerOpen ? (
                <div className="relative">
                  <div className="absolute z-20 mt-2 rounded-md border border-border bg-white p-3 shadow-lg">
                    <DayPicker
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      defaultMonth={dateRange?.from}
                      className="rounded-md"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="button" onClick={runReport} disabled={isPending}>
              {isPending ? "Running..." : "Run Report"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={downloadPdf}
              disabled={!activeResult || isExportingPdf || exportDisabled}
            >
              <Download className="mr-2 h-4 w-4" />
              {isExportingPdf ? "Exporting PDF..." : "Export PDF"}
            </Button>
            <Button type="button" variant="outline" onClick={printPdf} disabled={!previewUrl || exportDisabled}>
              <Printer className="mr-2 h-4 w-4" />
              Print PDF
            </Button>
            <Link href="/reports" className="text-sm underline-offset-2 hover:underline">
              Back to all reports
            </Link>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Results ({totalRows})</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSortColumn(null);
                setSortDirection("asc");
              }}
              disabled={!sortColumn}
            >
              Reset Sorting
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!activeResult ? (
            <p className="text-sm text-muted-foreground">Run the report to view data.</p>
          ) : activeResult.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No records found for selected range.</p>
          ) : isSalarySlipReport ? (
            <div className="space-y-3 text-base">
              <div className="grid grid-cols-2 gap-0 border-t border-b border-border">
                <div className="space-y-2 border-r border-border p-4">
                  {activeResult.rows
                    .filter((row) => String(row.__bucket || "") === "gain")
                    .map((row, index) => (
                      <div key={`gain-${index}`} className="flex items-center justify-between">
                        <span>{String(row.Item || "")}</span>
                        <span className="font-medium">
                          {Number(row.Amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                </div>
                <div className="space-y-2 p-4">
                  {activeResult.rows
                    .filter(
                      (row) => String(row.__bucket || "") === "deduction" && String(row.Item || "") !== "Total Deductions"
                    )
                    .map((row, index) => (
                      <div key={`ded-${index}`} className="flex items-center justify-between">
                        <span>{String(row.Item || "")}</span>
                        <span className="font-medium">
                          {Number(row.Amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  {activeResult.rows
                    .filter((row) => String(row.Item || "") === "Total Deductions")
                    .map((row, index) => (
                      <div key={`tot-${index}`} className="mt-2 flex items-center justify-between border-t border-border pt-2 text-lg font-bold">
                        <span>{String(row.Item || "")}</span>
                        <span>{Number(row.Amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                </div>
              </div>
              <div className="space-y-1 border-t border-border pt-2">
                {activeResult.rows
                  .filter((row) => String(row.Item || "") === "Employee EPF (8%)")
                  .map((row, index) => (
                    <div key={`foot-${index}`} className="flex items-center justify-between">
                      <span>{String(row.Item || "")}</span>
                      <span className="font-medium">
                        {Number(row.Amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                {activeResult.rows
                  .filter((row) => String(row.__bucket || "") === "stat")
                  .map((row, index) => (
                    <div key={`stat-${index}`} className="flex items-center justify-between">
                      <span>{String(row.Item || "")}</span>
                      <span className="font-medium">
                        {Number(row.Amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                {activeResult.rows
                  .filter((row) => String(row.__bucket || "") === "final")
                  .map((row, index) => (
                    <div key={`net-${index}`} className="mt-1 flex items-center justify-between text-xl font-bold">
                      <span>{String(row.Item || "")}</span>
                      <span>{Number(row.Amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {activeResult.columns.map((column) => {
                      const colLower = column.trim().toLowerCase();
                      const isInvoiceColumn = /invoice\s*(no|number)/i.test(column);
                      const isCollectionNoColumn = /collection\s*(no|number)/i.test(column);
                      const isNumeric = numericColumns.has(column);
                      const isDeleteQtyColumn =
                        reportKey === "sales/delete-invoice-report" &&
                        (colLower === "product qty" || colLower === "free qty");
                      const isGrnNoColumn = isGrnReport && colLower === "grn no";
                      const isReturnNoColumn = /return\s*(no|number)/i.test(column);
                      const forceLeftAlign = isCustomerPaymentDetailsReport;
                      const headerAlignClass = isDeleteQtyColumn
                        ? "text-center"
                        : forceLeftAlign || isGrnNoColumn || isReturnNoColumn || isInvoiceColumn || !isNumeric
                          ? "text-left"
                          : "text-right";
                      return (
                        <th
                          key={column}
                          className={`py-2 font-semibold ${isCollectionNoColumn ? "pl-0 pr-3" : isGrnNoColumn ? "pl-1 pr-3" : "px-3"} ${headerAlignClass}`}
                        >
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-left"
                            onClick={() => onSortColumn(column)}
                          >
                            {column}
                            {sortColumn === column ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {activeResult.rows.map((row, index) => {
                    const isOutstanding = reportKey === "customer/customer-outstanding-reports";
                    const rowType = String(row.__rowType || "");
                    if (isOutstanding && rowType === "divider") {
                      return (
                        <tr key={`${index}-${String(row[activeResult.columns[0]] ?? index)}`}>
                          <td colSpan={activeResult.columns.length} className="px-0 py-3">
                            <div className="h-px w-full bg-black" />
                          </td>
                        </tr>
                      );
                    }

                    const grnNo = String(row["GRN No"] ?? "");
                    const grnRowType = String(row.__rowType || "");
                    const grnShadeClass = grnShadeMap.get(grnNo) ?? "";
                    const expenseUser = String(row["User / Worker"] ?? "").trim();
                    const expenseShadeClass = expenseUserShadeMap.get(expenseUser) ?? "";
                    const rowClassName = isOutstanding
                      ? rowType === "customer"
                        ? "bg-muted/30 border-b border-border"
                        : Number(row.__isLastInvoice) === 1
                          ? ""
                          : "border-b border-border"
                      : isExpensesByUserReport
                        ? `${expenseShadeClass} border-b border-border`
                      : isGrnReport
                        ? grnRowType === "grn-total"
                          ? `${grnShadeClass} border-b-2 border-slate-500 font-semibold`
                          : grnRowType === "grn-grand-total"
                            ? "bg-slate-200 border-b-2 border-black font-bold"
                          : `${grnShadeClass} border-b border-border`
                      : "border-b border-border";

                    return (
                      <tr key={`${index}-${String(row[activeResult.columns[0]] ?? index)}`} className={rowClassName}>
                        {activeResult.columns.map((column) => {
                          const value = row[column];
                        const isNumeric = numericColumns.has(column);
                        const colLower = column.trim().toLowerCase();
                        const isInvoiceColumn = /invoice\s*(no|number)/i.test(column);
                        const isCollectionNoColumn = /collection\s*(no|number)/i.test(column);
                        const isGrnNoColumn = isGrnReport && colLower === "grn no";
                        const isReturnNoColumn = /return\s*(no|number)/i.test(column);
                        const isDeleteQtyColumn =
                          reportKey === "sales/delete-invoice-report" &&
                          (colLower === "product qty" || colLower === "free qty");
                        const hasInvoiceLink = /invoice\s*(no|number)/i.test(column) && typeof row.__invoiceId === "string" && row.__invoiceId.length > 0;
                        const hasCancelledInvoiceReportLink =
                          reportKey === "sales/delete-invoice-report" &&
                          /invoice\s*(no|number)/i.test(column) &&
                          typeof row.__cancelledInvoiceReportId === "string" &&
                          row.__cancelledInvoiceReportId.length > 0;
                        const hasReturnInvoiceLink =
                          /return\s*(no|number)/i.test(column) &&
                          typeof row.__returnInvoiceId === "string" &&
                          row.__returnInvoiceId.length > 0;
                        const hasGrnLink =
                          isGrnReport &&
                          isGrnNoColumn &&
                          typeof row.__receiveNoteId === "string" &&
                          row.__receiveNoteId.length > 0 &&
                          String(row.__rowType || "") !== "grn-total";
                        const hasCollectionLink =
                          reportKey === "customer/customer-payment-details" &&
                          isCollectionNoColumn &&
                          typeof row.__collectionId === "string" &&
                          row.__collectionId.length > 0;
                        const hasOutstandingInvoiceLink =
                          isOutstanding &&
                          rowType === "invoice" &&
                          column === activeResult.columns[0] &&
                          typeof row.__invoiceId === "string" &&
                          row.__invoiceId.length > 0;
                        const forceLeftAlign = isCustomerPaymentDetailsReport;
                        const cellAlignClass = isDeleteQtyColumn
                          ? "text-center"
                          : forceLeftAlign || isGrnNoColumn || isReturnNoColumn || isInvoiceColumn || !isNumeric
                            ? "text-left"
                            : "text-right";
                        return (
                          <td className={`py-2 ${isCollectionNoColumn ? "pl-0 pr-3" : isGrnNoColumn ? "pl-1 pr-3" : "px-3"} ${cellAlignClass}`} key={column}>
                            {hasOutstandingInvoiceLink ? (
                              <Link
                                href={`/invoices/${row.__invoiceId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-primary underline-offset-2 hover:underline"
                              >
                                {typeof value === "number"
                                  ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                  : String(value ?? "")}
                              </Link>
                            ) : hasCollectionLink ? (
                              <Link
                                href={`/collections?collectionId=${row.__collectionId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-primary underline-offset-2 hover:underline"
                              >
                                {typeof value === "number"
                                  ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                  : String(value ?? "")}
                              </Link>
                            ) : hasReturnInvoiceLink ? (
                              <Link
                                href={`/invoices/return/${row.__returnInvoiceId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-primary underline-offset-2 hover:underline"
                              >
                                {typeof value === "number"
                                  ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                  : String(value ?? "")}
                              </Link>
                            ) : hasGrnLink ? (
                              <Link
                                href={`/receive-notes/${row.__receiveNoteId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-primary underline-offset-2 hover:underline"
                              >
                                {typeof value === "number"
                                  ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                  : String(value ?? "")}
                              </Link>
                            ) : hasCancelledInvoiceReportLink ? (
                              <Link
                                href={`/invoices/cancelled/${row.__cancelledInvoiceReportId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-primary underline-offset-2 hover:underline"
                              >
                                {typeof value === "number"
                                  ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                  : String(value ?? "")}
                              </Link>
                            ) : hasInvoiceLink ? (
                              <Link
                                href={`/invoices/${row.__invoiceId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-primary underline-offset-2 hover:underline"
                              >
                                {typeof value === "number"
                                  ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                  : String(value ?? "")}
                              </Link>
                            ) : isExpensesByUserReport && colLower === "status" ? (
                              <span
                                className={
                                  String(value ?? "").toLowerCase() === "approved"
                                    ? "inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                                    : "inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"
                                }
                              >
                                {String(value ?? "")}
                              </span>
                            ) : typeof value === "number" ? (
                              value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                            ) : (
                              String(value ?? "")
                            )}
                          </td>
                        );
                      })}
                      </tr>
                    );
                  })}
                  {totalRowConfig ? (
                    <tr className={`${isExpensesByUserReport ? "bg-slate-200 border-b-2 border-slate-500" : "border-b border-border"} font-semibold`}>
                      {activeResult.columns.map((column) => {
                        const colLower = column.trim().toLowerCase();
                        const isInvoiceColumn = /invoice\s*(no|number)/i.test(column);
                        const isCollectionNoColumn = /collection\s*(no|number)/i.test(column);
                        const isReturnNoColumn = /return\s*(no|number)/i.test(column);
                        const isDeleteQtyColumn =
                          reportKey === "sales/delete-invoice-report" &&
                          (colLower === "product qty" || colLower === "free qty");
                        const isNumeric = numericColumns.has(column);
                        const forceLeftAlign = isCustomerPaymentDetailsReport;
                        const cellAlignClass = isDeleteQtyColumn
                          ? "text-center"
                          : forceLeftAlign || isReturnNoColumn || isInvoiceColumn || !isNumeric
                            ? "text-left"
                            : "text-right";
                        const text =
                          column === totalRowConfig.labelColumn
                            ? totalRowConfig.label
                            : column === totalRowConfig.amountColumn
                              ? totalRowConfig.total.toLocaleString(undefined, { maximumFractionDigits: 2 })
                              : "";
                        return (
                          <td
                            key={`total-${column}`}
                            className={`py-2 ${isCollectionNoColumn ? "pl-0 pr-3" : "px-3"} ${cellAlignClass}`}
                          >
                            {text}
                          </td>
                        );
                      })}
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PDF Preview ({activeMode === "detail" ? "Detail" : "Summary"})</CardTitle>
        </CardHeader>
        <CardContent>
          {!previewUrl ? (
            <p className="text-sm text-muted-foreground">Run the report to generate PDF preview.</p>
          ) : (
            <iframe
              ref={previewFrameRef}
              src={previewUrl}
              title="Report PDF Preview"
              className="h-[720px] w-full rounded-md border border-border"
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
