import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const summary = [
  { label: "Today's Orders", value: "12" },
  { label: "Today's Collections", value: "LKR 86,450" },
  { label: "Low Stock Items", value: "7" }
];

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

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
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

      const [{ data: targetRow }, { data: invoices }] = await Promise.all([
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
          .lte("created_at", monthEnd.toISOString())
      ]);

      const target = Number((targetRow as any)?.target_amount) || 0;
      if (target > 0) {
        const sales = (invoices ?? []).reduce((sum, row: any) => sum + (Number(row.total_amount) || 0), 0);
        const percentage = Math.min(100, (sales / target) * 100);
        salesProgress = { target, sales, percentage };
      }
    } else if (profile?.role === "manager" || profile?.role === "admin") {
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

      const [{ data: targetRow }, { data: invoices }] = await Promise.all([
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
          .lte("created_at", monthEnd.toISOString())
      ]);

      const target = Number((targetRow as any)?.target_amount) || 0;
      if (target > 0) {
        const sales = (invoices ?? []).reduce((sum: number, row: any) => sum + (Number(row.total_amount) || 0), 0);
        const percentage = Math.min(100, (sales / target) * 100);
        salesProgress = { target, sales, percentage };
      }
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Live operational snapshot for today.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {summary.map((item) => (
          <Card key={item.label}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {salesProgress ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Sales Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Current Sales: {salesProgress.sales.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              <span>Target: {salesProgress.target.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-200">
              <div className="h-3 rounded-full bg-emerald-500" style={{ width: `${salesProgress.percentage}%` }} />
            </div>
            <p className="text-sm font-medium">{salesProgress.percentage.toFixed(1)}%</p>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
