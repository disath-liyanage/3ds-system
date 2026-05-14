"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { getReportData, type ReportResult } from "@/app/actions/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getReportItem, getReportSection } from "../../reports-data";

type ReportDetailPageProps = {
  params: {
    section: string;
    report: string;
  };
};

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportDetailPage({ params }: ReportDetailPageProps) {
  const section = getReportSection(params.section);
  const report = getReportItem(params.section, params.report);

  const [from, setFrom] = useState(todayYmd());
  const [to, setTo] = useState(todayYmd());
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const reportTitle = report?.title ?? "Report";
  const sectionTitle = section?.title ?? "Reports";
  const totalRows = result?.rows.length ?? 0;

  const runReport = () => {
    if (!section || !report) {
      setError("Invalid report");
      return;
    }
    startTransition(async () => {
      setError("");
      const response = await getReportData({
        section: section.key,
        report: report.key,
        from,
        to
      });
      if (!response.success || !response.data) {
        setResult(null);
        setError(response.error || "Failed to load report");
        return;
      }
      setResult(response.data);
    });
  };

  const numericColumns = useMemo(() => {
    if (!result) return new Set<string>();
    const out = new Set<string>();
    for (const col of result.columns) {
      const isNumeric = result.rows.every((row) => typeof row[col] === "number");
      if (isNumeric) out.add(col);
    }
    return out;
  }, [result]);

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
          Select a date range and run the report.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" onClick={runReport} disabled={isPending}>
              {isPending ? "Running..." : "Run Report"}
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
          {!result ? (
            <p className="text-sm text-muted-foreground">Run the report to view data.</p>
          ) : result.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No records found for selected range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {result.columns.map((column) => (
                      <th key={column} className="px-3 py-2 text-left font-semibold">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, index) => (
                    <tr key={`${index}-${String(row[result.columns[0]] ?? index)}`} className="border-b border-border">
                      {result.columns.map((column) => {
                        const value = row[column];
                        const isNumeric = numericColumns.has(column);
                        return (
                          <td key={column} className={`px-3 py-2 ${isNumeric ? "text-right" : "text-left"}`}>
                            {typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(value ?? "")}
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
    </section>
  );
}
