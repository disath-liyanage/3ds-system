"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { REPORT_SECTIONS } from "./reports-data";

export default function ReportsPage() {
  const { permissions, isLoading } = useCurrentUserPermissions();
  const [query, setQuery] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    sales: true,
    customer: false,
    stock: false,
    grn: false,
    profit: false,
    expenses: false,
    salary: false
  });

  const normalizedQuery = query.trim().toLowerCase();
  const visibleSections = useMemo(() => {
    if (!normalizedQuery) return REPORT_SECTIONS;
    return REPORT_SECTIONS.map((section) => ({
        ...section,
        reports: section.reports.filter((report) => report.title.toLowerCase().includes(normalizedQuery))
      }));
  }, [normalizedQuery]);

  const totalVisibleReports = visibleSections.reduce((acc, section) => acc + section.reports.length, 0);
  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!isLoading && !permissions?.canViewReports) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to view reports.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Use the universal search to quickly find reports across Sales, Customer, Stock, GRN, Profit, Expenses, and Salary sections.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Universal Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search reports by name..."
            aria-label="Search reports"
          />
          <p className="text-xs text-muted-foreground">
            {totalVisibleReports} report{totalVisibleReports === 1 ? "" : "s"} found
          </p>
        </CardContent>
      </Card>

      {totalVisibleReports === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">No reports found for your search.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleSections.map((section) => (
            <Card key={section.key}>
              <CardHeader
                role="button"
                tabIndex={0}
                onClick={() => toggleSection(section.key)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggleSection(section.key);
                  }
                }}
                className="cursor-pointer rounded-t-lg transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  <ChevronRight
                    className={
                      normalizedQuery || openSections[section.key]
                        ? "h-4 w-4 rotate-90 transition-transform"
                        : "h-4 w-4 rotate-0 transition-transform"
                    }
                  />
                </div>
              </CardHeader>
              {normalizedQuery || openSections[section.key] ? (
                <CardContent>
                  {section.reports.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No matching sub reports in this section.</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {section.reports.map((report) => (
                        <li key={report.key}>
                          <Link
                            href={`/reports/${section.key}/${report.key}`}
                            className="block rounded-md border border-border px-3 py-2 text-foreground transition hover:bg-muted/40"
                          >
                            {report.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
