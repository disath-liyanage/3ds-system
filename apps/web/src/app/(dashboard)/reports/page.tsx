"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useMemo, useState } from "react";

type ReportSection = {
  title: string;
  reports: string[];
};

export default function ReportsPage() {
  const { permissions, isLoading } = useCurrentUserPermissions();
  const [query, setQuery] = useState("");

  const sections: ReportSection[] = useMemo(
    () => [
      {
        title: "Sales",
        reports: [
          "Date wise Sales report",
          "Invoice wise sales report",
          "Route wise Sales report",
          "Return Invoice report",
          "Delete invoice report",
          "Department wise sales invoice",
          "Customer wise sales and quantity summary",
          "Route wise invoice payment details",
          "Fast moving products report",
          "Product wise sales qty reports"
        ]
      },
      {
        title: "Customer",
        reports: [
          "Customer outstanding reports",
          "Daily revenue report",
          "Available credit invoices",
          "Cacel customer payments",
          "Customer payment details",
          "Date Wise Cheque Payment Details",
          "CUSTOMER DETAILS"
        ]
      },
      {
        title: "Stock",
        reports: ["Product Stock Summary", "Categorization Wise Stock Reports", "Return Stock Details"]
      },
      {
        title: "GRN",
        reports: ["Goods Received Note Reports"]
      }
    ],
    []
  );

  const normalizedQuery = query.trim().toLowerCase();
  const visibleSections = useMemo(() => {
    if (!normalizedQuery) return sections;
    return sections
      .map((section) => ({
        ...section,
        reports: section.reports.filter((report) => report.toLowerCase().includes(normalizedQuery))
      }))
      .filter((section) => section.reports.length > 0);
  }, [normalizedQuery, sections]);

  const totalVisibleReports = visibleSections.reduce((acc, section) => acc + section.reports.length, 0);

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
          Use the universal search to quickly find reports across Sales, Customer, Stock, and GRN sections.
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

      {visibleSections.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">No reports found for your search.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleSections.map((section) => (
            <Card key={section.title}>
              <CardHeader>
                <CardTitle className="text-base">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-2 pl-5 text-sm">
                  {section.reports.map((report) => (
                    <li key={report}>{report}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
