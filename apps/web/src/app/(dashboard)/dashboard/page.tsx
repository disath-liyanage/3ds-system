import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function getProgressBarColorClass(percentage: number) {
  if (percentage >= 100) return "bg-emerald-600";
  if (percentage > 75) return "bg-lime-500";
  if (percentage > 50) return "bg-yellow-400";
  if (percentage > 25) return "bg-orange-500";
  return "bg-red-500";
}

function getMotivationMessage(percentage: number) {
  if (percentage >= 100) return "Excellent work, Target achieved.";
  if (percentage > 90) return "Final push, you are right at the finish line.";
  if (percentage > 75) return "You are almost there, keep going strong.";
  if (percentage >= 50) return "You're halfway there, you can do it.";
  if (percentage > 25) return "Great momentum, keep pushing.";
  return "Good start, keep moving forward.";
}

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  let role: string | null = null;
  let todayOrders = 0;
  let todayCollectionsAmount = 0;
  let lowStockItemsCount = 0;
  let repTargetProgress: Array<{
    salesRepId: string;
    name: string;
    target: number;
    sales: number;
    percentage: number;
  }> = [];

  let salesProgress:
    | {
        target: number;
        sales: number;
        percentage: number;
      }
    | null = null;

  if (user) {
    const { data: profile } = await adminClient
      .from("users_profile")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "sales_rep") {
      role = "sales_rep";
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(now);
      dayEnd.setHours(23, 59, 59, 999);

      const [{ data: targetRow }, { data: invoices }, { data: todaysInvoices }, { data: todaysCollections }] =
        await Promise.all([
        adminClient
          .from("sales_rep_monthly_targets")
          .select("target_amount")
          .eq("sales_rep_id", profile.id)
          .eq("target_month", monthStart.toISOString().slice(0, 10))
          .maybeSingle(),
        adminClient
          .from("invoices")
          .select("total_amount")
          .eq("issued_by", profile.id)
          .in("status", ["approved", "issued", "paid"])
          .gte("created_at", monthStart.toISOString())
          .lte("created_at", monthEnd.toISOString()),
        adminClient
          .from("invoices")
          .select("id")
          .eq("issued_by", profile.id)
          .gte("created_at", dayStart.toISOString())
          .lte("created_at", dayEnd.toISOString()),
        adminClient
          .from("collections")
          .select("amount")
          .eq("collected_by", profile.id)
          .gte("created_at", dayStart.toISOString())
          .lte("created_at", dayEnd.toISOString())
      ]);

      const target = Number((targetRow as any)?.target_amount) || 0;
      todayOrders = (todaysInvoices ?? []).length;
      todayCollectionsAmount = (todaysCollections ?? []).reduce(
        (sum: number, row: any) => sum + (Number(row.amount) || 0),
        0
      );

      if (target > 0) {
        const sales = (invoices ?? []).reduce((sum, row: any) => sum + (Number(row.total_amount) || 0), 0);
        const percentage = Math.min(100, (sales / target) * 100);
        salesProgress = { target, sales, percentage };
      }
    } else if (profile?.role === "manager" || profile?.role === "admin") {
      role = profile.role;
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(now);
      dayEnd.setHours(23, 59, 59, 999);

      const [
        { data: targetRow },
        { data: invoices },
        { data: todaysInvoices },
        { data: todaysCollections },
        { data: lowStockProducts },
        { data: salesReps },
        { data: targetRows }
      ] = await Promise.all([
        adminClient
          .from("manager_monthly_sales_targets")
          .select("target_amount")
          .eq("manager_id", profile.id)
          .eq("target_month", monthStart.toISOString().slice(0, 10))
          .maybeSingle(),
        adminClient
          .from("invoices")
          .select("total_amount")
          .in("status", ["approved", "issued", "paid"])
          .gte("created_at", monthStart.toISOString())
          .lte("created_at", monthEnd.toISOString()),
        adminClient.from("invoices").select("id").gte("created_at", dayStart.toISOString()).lte("created_at", dayEnd.toISOString()),
        adminClient.from("collections").select("amount").gte("created_at", dayStart.toISOString()).lte("created_at", dayEnd.toISOString()),
        adminClient
          .from("products")
          .select("id, stock_qty, low_stock_threshold"),
        adminClient
          .from("users_profile")
          .select("id, full_name")
          .eq("role", "sales_rep"),
        adminClient
          .from("sales_rep_monthly_targets")
          .select("sales_rep_id, target_amount")
          .eq("target_month", monthStart.toISOString().slice(0, 10))
      ]);

      todayOrders = (todaysInvoices ?? []).length;
      todayCollectionsAmount = (todaysCollections ?? []).reduce(
        (sum: number, row: any) => sum + (Number(row.amount) || 0),
        0
      );
      lowStockItemsCount = (lowStockProducts ?? []).filter((product: any) => {
        const stockQty = Number(product.stock_qty) || 0;
        const lowStockThreshold = Number(product.low_stock_threshold) || 0;
        return stockQty > 0 && stockQty <= lowStockThreshold;
      }).length;

      const target = Number((targetRow as any)?.target_amount) || 0;
      if (target > 0) {
        const sales = (invoices ?? []).reduce((sum: number, row: any) => sum + (Number(row.total_amount) || 0), 0);
        const percentage = Math.min(100, (sales / target) * 100);
        salesProgress = { target, sales, percentage };
      }

      const repIds = (salesReps ?? []).map((rep: any) => rep.id);
      const repSalesRows =
        repIds.length > 0
          ? (
              await adminClient
                .from("invoices")
                .select("issued_by, total_amount")
                .in("issued_by", repIds)
                .in("status", ["approved", "issued", "paid"])
                .gte("created_at", monthStart.toISOString())
                .lte("created_at", monthEnd.toISOString())
            ).data ?? []
          : [];

      const salesByRep = new Map<string, number>();
      for (const row of repSalesRows as any[]) {
        const repId = row.issued_by as string;
        salesByRep.set(repId, (salesByRep.get(repId) ?? 0) + (Number(row.total_amount) || 0));
      }

      const targetByRep = new Map<string, number>();
      for (const row of (targetRows ?? []) as any[]) {
        targetByRep.set(row.sales_rep_id as string, Number(row.target_amount) || 0);
      }

      repTargetProgress = (salesReps ?? [])
        .map((rep: any) => {
          const targetAmount = targetByRep.get(rep.id) ?? 0;
          const salesAmount = salesByRep.get(rep.id) ?? 0;
          const percentage = targetAmount > 0 ? Math.min(100, (salesAmount / targetAmount) * 100) : 0;
          return {
            salesRepId: rep.id as string,
            name: (rep.full_name as string) || "Unknown",
            target: targetAmount,
            sales: salesAmount,
            percentage
          };
        })
        .filter((row) => row.target > 0)
        .sort((a, b) => b.percentage - a.percentage);
    }
  }

  const todayDateParam = new Date().toISOString().slice(0, 10);
  const summary = [
    { label: "Today's Orders", value: todayOrders.toLocaleString(), href: `/invoices?from=${todayDateParam}&to=${todayDateParam}` },
    {
      label: "Today's Collections",
      value: `LKR ${todayCollectionsAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      href: "/collections"
    },
    ...(role === "sales_rep" ? [] : [{ label: "Low Stock Items", value: lowStockItemsCount.toLocaleString(), href: "/products?status=low_stock" }])
  ];

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Sales Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {salesProgress ? (
            <>
              <div className="grid grid-cols-3 items-center gap-2 text-sm">
                <span className="text-left font-bold">
                  Current Sales: {salesProgress.sales.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <span className="text-center font-bold">{getMotivationMessage(salesProgress.percentage)}</span>
                <span className="text-right font-bold">
                  Target: {salesProgress.target.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-200">
                <div
                  className={`h-3 rounded-full ${getProgressBarColorClass(salesProgress.percentage)}`}
                  style={{ width: `${salesProgress.percentage}%` }}
                />
              </div>
              <p className="text-sm font-medium">{salesProgress.percentage.toFixed(1)}%</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No monthly target set for this month yet.</p>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {summary.map((item) => (
          <Link key={item.label} href={item.href} className="block focus:outline-none">
            <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">{item.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{item.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {(role === "manager" || role === "admin") && repTargetProgress.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales Rep Targets Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {repTargetProgress.map((rep) => (
              <div key={rep.salesRepId} className="space-y-2 rounded-md border border-border/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{rep.name}</p>
                  <Badge variant={rep.percentage >= 100 ? "success" : rep.percentage >= 75 ? "warning" : "default"}>
                    {rep.percentage.toFixed(1)}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sales: {rep.sales.toLocaleString(undefined, { maximumFractionDigits: 2 })} / Target:{" "}
                  {rep.target.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
                <div className="h-2 w-full rounded-full bg-slate-200">
                  <div
                    className={`h-2 rounded-full ${getProgressBarColorClass(rep.percentage)}`}
                    style={{ width: `${rep.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      {(role === "manager" || role === "admin") && repTargetProgress.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales Rep Targets Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No sales rep targets set for this month yet.</p>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
