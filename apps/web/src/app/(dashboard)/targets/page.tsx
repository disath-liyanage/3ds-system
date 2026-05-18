"use client";

import { useEffect, useState } from "react";

import { listSalesReps, upsertManagerMonthlySalesTarget, upsertSalesRepMonthlyTarget } from "@/app/actions/attendance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "@/lib/toast";

export default function TargetsPage() {
  const [salesRepOptions, setSalesRepOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [targetRepId, setTargetRepId] = useState("");
  const [targetMonth, setTargetMonth] = useState(new Date().toISOString().slice(0, 7));
  const [targetAmount, setTargetAmount] = useState("");
  const [targetSaving, setTargetSaving] = useState(false);
  const [managerTargetMonth, setManagerTargetMonth] = useState(new Date().toISOString().slice(0, 7));
  const [managerTargetAmount, setManagerTargetAmount] = useState("");
  const [managerTargetSaving, setManagerTargetSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const loadSalesReps = async () => {
      const result = await listSalesReps();
      if (!active || !result.success || !result.reps) return;
      setSalesRepOptions(result.reps.map((rep) => ({ value: rep.id, label: rep.full_name })));
    };
    void loadSalesReps();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Targets</h1>
        <p className="text-sm text-muted-foreground">Set monthly sales targets for sales reps.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Set Monthly Sales Target for Reps</CardTitle>
          <CardDescription>Managers and admins can assign a monthly sales target to each sales rep.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const parsedTarget = Number(targetAmount);
              if (!targetRepId) {
                toast({ title: "Missing rep", description: "Please select a sales rep.", variant: "error" });
                return;
              }
              if (!Number.isFinite(parsedTarget) || parsedTarget < 0) {
                toast({ title: "Invalid target", description: "Enter valid target amount.", variant: "error" });
                return;
              }

              setTargetSaving(true);
              const result = await upsertSalesRepMonthlyTarget({
                salesRepId: targetRepId,
                month: targetMonth,
                targetAmount: parsedTarget,
                incentiveAmount: 0
              });
              setTargetSaving(false);

              if (!result.success) {
                toast({ title: "Save failed", description: result.error || "Could not save target", variant: "error" });
                return;
              }
              toast({ title: "Saved", description: "Monthly sales target saved.", variant: "success" });
            }}
          >
            <div className="space-y-1">
              <label className="text-sm font-medium">Sales Rep</label>
              <SearchableSelect
                value={targetRepId}
                options={salesRepOptions}
                placeholder="Select sales rep"
                onChange={setTargetRepId}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Month</label>
              <Input type="month" value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Monthly Sales Target</label>
              <Input type="number" min={0} step="0.01" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={targetSaving}>
                {targetSaving ? "Saving..." : "Save Target"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Set Monthly Sales Target</CardTitle>
          <CardDescription>Set the overall monthly sales target based on combined sales of all users.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const parsedTarget = Number(managerTargetAmount);
              if (!Number.isFinite(parsedTarget) || parsedTarget < 0) {
                toast({ title: "Invalid target", description: "Enter valid target amount.", variant: "error" });
                return;
              }

              setManagerTargetSaving(true);
              const result = await upsertManagerMonthlySalesTarget({
                month: managerTargetMonth,
                targetAmount: parsedTarget
              });
              setManagerTargetSaving(false);

              if (!result.success) {
                toast({ title: "Save failed", description: result.error || "Could not save target", variant: "error" });
                return;
              }
              toast({ title: "Saved", description: "Overall monthly sales target saved.", variant: "success" });
            }}
          >
            <div className="space-y-1">
              <label className="text-sm font-medium">Month</label>
              <Input type="month" value={managerTargetMonth} onChange={(e) => setManagerTargetMonth(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Monthly Sales Target</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={managerTargetAmount}
                onChange={(e) => setManagerTargetAmount(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={managerTargetSaving}>
                {managerTargetSaving ? "Saving..." : "Save Target"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
