"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";

export default function ReportsPage() {
  const { permissions, isLoading } = useCurrentUserPermissions();

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
        <p className="text-sm text-muted-foreground">Generate date-range reports for sales, collections, and stock.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">From</label>
            <Input type="date" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">To</label>
            <Input type="date" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales</CardTitle>
          </CardHeader>
          <CardContent>LKR 0.00</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Collections</CardTitle>
          </CardHeader>
          <CardContent>LKR 0.00</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Low Stock Count</CardTitle>
          </CardHeader>
          <CardContent>0</CardContent>
        </Card>
      </div>
    </section>
  );
}