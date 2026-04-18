import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const summary = [
  { label: "Today's Orders", value: "12" },
  { label: "Today's Collections", value: "LKR 86,450" },
  { label: "Low Stock Items", value: "7" }
];

export default function DashboardPage() {
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
    </section>
  );
}