"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import { DayPicker, type DateRange } from "react-day-picker";
import { pdf } from "@react-pdf/renderer";
import "react-day-picker/dist/style.css";

import { getReportData, type ReportResult } from "@/app/actions/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportPdfTemplate } from "@/lib/pdf/report-template";
import { getReportItem, getReportSection } from "../../reports-data";

type ReportDetailPageProps = {
  params: {
    section: string;
    report: string;
  };
};

function todayDate() {
  const raw = new Date().toISOString().slice(0, 10);
  return new Date(`${raw}T00:00:00`);
}

function ymd(date: Date) {
  return format(date, "yyyy-MM-dd");
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
  const [reportMode, setReportMode] = useState<"detail" | "summary">("detail");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);

  const reportTitle = report?.title ?? "Report";
  const sectionTitle = section?.title ?? "Reports";
  const totalRows = result?.rows.length ?? 0;

  const summaryResult = useMemo<ReportResult | null>(() => {
    if (!result) return null;
    const numericCols = result.columns.filter((column) =>
      result.rows.every((row) => typeof row[column] === "number")
    );
    const rows: Array<Record<string, string | number>> = [{ Metric: "Total Records", Value: result.rows.length }];
    for (const column of numericCols) {
      const total = result.rows.reduce((acc, row) => acc + (Number(row[column]) || 0), 0);
      rows.push({ Metric: `Total ${column}`, Value: total });
    }
    return { columns: ["Metric", "Value"], rows };
  }, [result]);

  const activeResult = reportMode === "detail" ? result : summaryResult;

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

  const runReport = () => {
    if (!section || !report) {
      setError("Invalid report");
      return;
    }

    if (!dateRange?.from || !dateRange?.to) {
      setError("Please select a complete date range");
      return;
    }

    startTransition(async () => {
      setError("");
      const response = await getReportData({
        section: section.key,
        report: report.key,
        from: ymd(dateRange.from as Date),
        to: ymd(dateRange.to as Date)
      });
      if (!response.success || !response.data) {
        setResult(null);
        setError(response.error || "Failed to load report");
        return;
      }
      setResult(response.data);
    });
  };

  async function buildReportPdfBlob() {
    if (!activeResult || !section || !report) return null;
    return pdf(
      <ReportPdfTemplate
        sectionTitle={section.title}
        reportTitle={report.title}
        dateRangeLabel={dateRangeLabel}
        mode={reportMode}
        result={activeResult}
      />
    ).toBlob();
  }

  const downloadPdf = async () => {
    if (!activeResult || !section || !report) return;

    setIsExportingPdf(true);
    try {
      const blob = await buildReportPdfBlob();
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${section.key}-${report.key}-${reportMode}-${ymd(new Date())}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const printPdf = () => {
    if (!previewFrameRef.current) return;
    previewFrameRef.current.contentWindow?.focus();
    previewFrameRef.current.contentWindow?.print();
  };

  const numericColumns = useMemo(() => {
    if (!activeResult) return new Set<string>();
    const out = new Set<string>();
    for (const col of activeResult.columns) {
      const isNumeric = activeResult.rows.every((row) => typeof row[col] === "number");
      if (isNumeric) out.add(col);
    }
    return out;
  }, [activeResult]);

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
  }, [activeResult, section, report, reportMode, dateRangeLabel]);

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
        <p className="text-sm text-muted-foreground">Select a date range and run the report.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1" ref={datePickerRef}>
            <label className="text-sm font-medium">Date Range</label>
            <button
              type="button"
              onClick={() => setIsDatePickerOpen((prev) => !prev)}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm text-foreground transition focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <span className={dateRange?.from ? "text-foreground" : "text-muted-foreground"}>{dateRangeLabel}</span>
              <span className="text-xs text-muted-foreground">Pick</span>
            </button>
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

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant={reportMode === "detail" ? "default" : "outline"}
              onClick={() => setReportMode("detail")}
            >
              Detail
            </Button>
            <Button
              type="button"
              variant={reportMode === "summary" ? "default" : "outline"}
              onClick={() => setReportMode("summary")}
            >
              Summary
            </Button>
            <Button type="button" onClick={runReport} disabled={isPending}>
              {isPending ? "Running..." : "Run Report"}
            </Button>
            <Button type="button" variant="outline" onClick={downloadPdf} disabled={!activeResult || isExportingPdf}>
              {isExportingPdf ? "Exporting PDF..." : "Export PDF"}
            </Button>
            <Button type="button" variant="outline" onClick={printPdf} disabled={!previewUrl}>
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
          <CardTitle>Results ({totalRows})</CardTitle>
        </CardHeader>
        <CardContent>
          {!activeResult ? (
            <p className="text-sm text-muted-foreground">Run the report to view data.</p>
          ) : activeResult.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No records found for selected range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {activeResult.columns.map((column) => (
                      <th key={column} className="px-3 py-2 text-left font-semibold">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeResult.rows.map((row, index) => (
                    <tr key={`${index}-${String(row[activeResult.columns[0]] ?? index)}`} className="border-b border-border">
                      {activeResult.columns.map((column) => {
                        const value = row[column];
                        const isNumeric = numericColumns.has(column);
                        return (
                          <td key={column} className={`px-3 py-2 ${isNumeric ? "text-right" : "text-left"}`}>
                            {typeof value === "number"
                              ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                              : String(value ?? "")}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PDF Preview ({reportMode === "detail" ? "Detail" : "Summary"})</CardTitle>
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
