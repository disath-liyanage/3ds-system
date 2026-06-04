"use client";

import type { Worker } from "@paintdist/shared";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { markWorkerAttendance, markWorkersAttendance } from "@/app/actions/attendance";
import { createWorkerDeduction } from "@/app/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select } from "@/components/ui/select";
import { getSriLankaHolidays } from "@/lib/sri-lanka-holidays";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type AttendanceStatus = "present" | "absent" | "half_day" | "leave" | "holiday";

type AttendanceRow = {
  worker_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  note: string | null;
};

type ChequeDepositRow = {
  id: string;
  collection_number: number;
  amount: number;
  deposit_date: string;
  status: "pending" | "validated" | "rejected";
  customer_name: string;
  invoice_number: number | null;
};

type AttendanceClientProps = {
  workers: Worker[];
  initialAttendance: AttendanceRow[];
  chequeDeposits: ChequeDepositRow[];
  initialYear: number;
  initialMonth: number;
};

const statusOptions = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "half_day", label: "Half Day" },
  { value: "leave", label: "Leave" },
  { value: "holiday", label: "Holiday" }
];

function toDateKey(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function getTodayDateKey(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return formatter.format(new Date());
}

function getDefaultSelectedDay(year: number, month: number, todayDateKey: string): number | null {
  const [todayYear, todayMonth, todayDay] = todayDateKey.split("-").map(Number);
  if (todayYear === year && todayMonth === month + 1) {
    return todayDay;
  }
  return null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 2
  }).format(amount);
}

export function AttendanceClient({
  workers,
  initialAttendance,
  chequeDeposits,
  initialYear,
  initialMonth
}: AttendanceClientProps) {
  const router = useRouter();
  const todayDateKey = getTodayDateKey();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selectedDay, setSelectedDay] = useState<number | null>(
    getDefaultSelectedDay(initialYear, initialMonth, todayDateKey)
  );
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>(() => {
    const entries = initialAttendance.map((row) => [`${row.worker_id}:${row.attendance_date}`, row.status] as const);
    return Object.fromEntries(entries);
  });
  const [isPending, startTransition] = useTransition();
  const [deductionWorkerId, setDeductionWorkerId] = useState("");
  const [deductionType, setDeductionType] = useState<"advance" | "loan" | "">("");
  const [deductionAmount, setDeductionAmount] = useState("");
  const [deductionMonths, setDeductionMonths] = useState("");
  const [deductionNote, setDeductionNote] = useState("");
  const [deductionSaving, setDeductionSaving] = useState(false);

  useEffect(() => {
    setYear(initialYear);
    setMonth(initialMonth);
    setSelectedDay((current) => {
      if (current) return current;
      return getDefaultSelectedDay(initialYear, initialMonth, todayDateKey);
    });
    setAttendanceMap(() => {
      const entries = initialAttendance.map((row) => [`${row.worker_id}:${row.attendance_date}`, row.status] as const);
      return Object.fromEntries(entries);
    });
  }, [initialAttendance, initialMonth, initialYear, todayDateKey]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekDay = new Date(year, month, 1).getDay();

  const holidayMap = useMemo(
    () => Object.fromEntries(getSriLankaHolidays(year).map((item) => [item.date, item.name])),
    [year]
  );
  const chequeDepositMap = useMemo(() => {
    return chequeDeposits.reduce<Record<string, ChequeDepositRow[]>>((map, deposit) => {
      const dateKey = deposit.deposit_date.slice(0, 10);
      map[dateKey] = [...(map[dateKey] ?? []), deposit];
      return map;
    }, {});
  }, [chequeDeposits]);

  const selectedDateKey = selectedDay ? toDateKey(year, month, selectedDay) : null;
  const selectedChequeDeposits = selectedDateKey ? chequeDepositMap[selectedDateKey] ?? [] : [];

  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Colombo"
  }).format(new Date(year, month, 1));

  const markAllAsHoliday = () => {
    if (!selectedDateKey || workers.length === 0) return;

    startTransition(async () => {
      const result = await markWorkersAttendance({
        workerIds: workers.map((worker) => worker.id),
        attendanceDate: selectedDateKey,
        status: "holiday"
      });

      if (!result.success) {
        toast({
          title: "Bulk update failed",
          description: result.error ?? "Could not mark all workers as holiday",
          variant: "error"
        });
        return;
      }

      setAttendanceMap((prev) => {
        const updated = { ...prev };
        for (const worker of workers) {
          updated[`${worker.id}:${selectedDateKey}`] = "holiday";
        }
        return updated;
      });

      toast({
        title: "Holiday marked",
        description: `All workers were marked as holiday for ${selectedDateKey}.`,
        variant: "success"
      });
    });
  };

  const onSave = (workerId: string, status: AttendanceStatus) => {
    if (!selectedDay || !selectedDateKey) return;

    startTransition(async () => {
      const result = await markWorkerAttendance({
        workerId,
        attendanceDate: selectedDateKey,
        status
      });

      if (!result.success) {
        toast({ title: "Save failed", description: result.error ?? "Could not mark attendance", variant: "error" });
        return;
      }

      setAttendanceMap((prev) => ({
        ...prev,
        [`${workerId}:${selectedDateKey}`]: status
      }));

      const workerName = workers.find((worker) => worker.id === workerId)?.name ?? "Worker";
      toast({ title: "Attendance saved", description: `${workerName} marked as ${status}.`, variant: "success" });
    });
  };

  const monthOptions = Array.from({ length: 12 }).map((_, index) => ({
    value: String(index),
    label: new Intl.DateTimeFormat("en-GB", { month: "long" }).format(new Date(2026, index, 1))
  }));

  const yearOptions = Array.from({ length: 5 }).map((_, index) => {
    const value = initialYear - 2 + index;
    return { value: String(value), label: String(value) };
  });

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Mark worker attendance day by day with Sri Lanka holidays highlighted in the calendar.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>{monthLabel}</CardTitle>
              <div className="flex gap-2">
                <Select
                  value={String(month)}
                  options={monthOptions}
                  onChange={(event) => {
                    const nextMonth = Number(event.target.value);
                    setMonth(nextMonth);
                    setSelectedDay(getDefaultSelectedDay(year, nextMonth, todayDateKey));
                    router.push(`/attendance?year=${year}&month=${nextMonth}`);
                  }}
                />
                <Select
                  value={String(year)}
                  options={yearOptions}
                  onChange={(event) => {
                    const nextYear = Number(event.target.value);
                    setYear(nextYear);
                    setSelectedDay(getDefaultSelectedDay(nextYear, month, todayDateKey));
                    router.push(`/attendance?year=${nextYear}&month=${month}`);
                  }}
                />
              </div>
            </div>
            <CardDescription>Pick a date, then mark status for each worker.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-muted-foreground">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {Array.from({ length: firstWeekDay }).map((_, index) => (
                <div key={`empty-${index}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1;
                const dateKey = toDateKey(year, month, day);
                const weekDay = new Date(year, month, day).getDay();
                const isSunday = weekDay === 0;
                const isSaturday = weekDay === 6;
                const holidayName = holidayMap[dateKey];
                const isHoliday = Boolean(holidayName);
                const markedCount = workers.reduce((count, worker) => {
                  const workerStatus = attendanceMap[`${worker.id}:${dateKey}`];
                  return workerStatus ? count + 1 : count;
                }, 0);
                const holidayMarkedCount = workers.reduce((count, worker) => {
                  const workerStatus = attendanceMap[`${worker.id}:${dateKey}`];
                  return workerStatus === "holiday" ? count + 1 : count;
                }, 0);
                const isFullyMarkedAsHoliday = workers.length > 0 && holidayMarkedCount === workers.length;
                const shouldUseHolidayShade = isHoliday || isFullyMarkedAsHoliday;
                const chequeDepositsForDate = chequeDepositMap[dateKey] ?? [];
                const chequeTitle = chequeDepositsForDate
                  .map((deposit) => {
                    const invoiceLabel = deposit.invoice_number ? `Invoice #${deposit.invoice_number}` : "No invoice";
                    return `${deposit.customer_name} · ${formatCurrency(deposit.amount)} · ${invoiceLabel} · Collection #${deposit.collection_number}`;
                  })
                  .join("\n");

                return (
                  <Button
                    key={dateKey}
                    type="button"
                    variant="outline"
                    title={chequeTitle || undefined}
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "h-28 flex-col items-stretch justify-between gap-2 px-2 py-3 text-center text-xs font-normal",
                      selectedDay === day ? "border-brand bg-brand-light/70" : "border-border hover:bg-brand-light/60",
                      dateKey === todayDateKey ? "ring-2 ring-blue-400 ring-offset-1" : "",
                      isSunday ? "bg-rose-50" : "",
                      isSaturday ? "bg-sky-50" : "",
                      shouldUseHolidayShade ? "border-brand-muted bg-brand-light" : ""
                    )}
                  >
                    <div className="min-h-7">
                      {isHoliday ? (
                        <div className="line-clamp-2 text-[10px] font-semibold leading-tight text-brand">
                          {holidayName}
                        </div>
                      ) : chequeDepositsForDate.length ? (
                        <div className="rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-medium text-emerald-800">
                          Cheque {chequeDepositsForDate.length}
                        </div>
                      ) : null}
                    </div>
                    <div
                      className={cn(
                        "flex flex-1 items-center justify-center text-lg font-semibold",
                        isSunday ? "text-rose-700" : "",
                        isSaturday ? "text-sky-700" : "",
                        !isSunday && !isSaturday ? "text-slate-900" : ""
                      )}
                    >
                      {day}
                    </div>
                    <div
                      className={cn(
                        "min-h-4 text-[10px] font-medium leading-tight",
                        isFullyMarkedAsHoliday ? "text-brand" : "text-slate-600"
                      )}
                    >
                      {isFullyMarkedAsHoliday ? "All Marked as holiday" : `${markedCount}/${workers.length} marked`}
                    </div>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Attendance</CardTitle>
            <CardDescription>
              {selectedDateKey ? `Status on ${selectedDateKey}` : "Select a date from the calendar"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedDateKey && holidayMap[selectedDateKey] ? (
              <Badge className="bg-brand-light text-brand">{holidayMap[selectedDateKey]}</Badge>
            ) : null}
            {selectedChequeDeposits.length ? (
              <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-emerald-900">Cheque deposits due</p>
                  <Badge className="bg-emerald-100 text-emerald-800">{selectedChequeDeposits.length}</Badge>
                </div>
                <div className="space-y-2">
                  {selectedChequeDeposits.map((deposit) => (
                    <div key={deposit.id} className="rounded border border-emerald-200 bg-white px-2 py-1.5 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-900">{deposit.customer_name}</p>
                          <p className="text-muted-foreground">
                            Collection #{deposit.collection_number}
                            {deposit.invoice_number ? ` · Invoice #${deposit.invoice_number}` : ""}
                          </p>
                        </div>
                        <p className="font-semibold text-emerald-800">{formatCurrency(deposit.amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <Button
              type="button"
              variant="outline"
              onClick={markAllAsHoliday}
              disabled={!selectedDateKey || isPending || workers.length === 0}
              className="w-full border-brand-muted bg-brand-light text-brand hover:bg-brand-light/80"
            >
              Mark Whole Day as Holiday (All Workers)
            </Button>

            {!selectedDateKey ? (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Click a date to view all workers and mark attendance.
              </p>
            ) : (
              <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
                {workers.map((worker) => {
                  const status = attendanceMap[`${worker.id}:${selectedDateKey}`];
                  return (
                    <div key={worker.id} className="rounded-md border border-border p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{worker.name}</p>
                        <Badge className={status ? "bg-slate-200 text-slate-700" : "bg-brand-light text-brand"}>
                          {status ? status.replace("_", " ") : "not marked"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {statusOptions.map((option) => (
                          <Button
                            key={`${worker.id}-${option.value}`}
                            type="button"
                            variant={status === option.value ? "default" : "outline"}
                            onClick={() => onSave(worker.id, option.value as AttendanceStatus)}
                            disabled={isPending}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Advance / Loan</CardTitle>
          <CardDescription>Managers and admins can record worker advances and loans from here.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const amount = Number(deductionAmount);
              const months = Number(deductionMonths);
              if (!deductionWorkerId) {
                toast({ title: "Missing worker", description: "Please select a worker.", variant: "error" });
                return;
              }
              if (!deductionType) {
                toast({ title: "Missing type", description: "Please select advance or loan.", variant: "error" });
                return;
              }
              if (!Number.isFinite(amount) || amount <= 0) {
                toast({ title: "Invalid amount", description: "Enter a valid amount.", variant: "error" });
                return;
              }
              if (deductionType === "loan" && (!Number.isInteger(months) || months <= 0)) {
                toast({ title: "Invalid months", description: "Enter valid loan months.", variant: "error" });
                return;
              }
              setDeductionSaving(true);
              const result = await createWorkerDeduction({
                worker_id: deductionWorkerId,
                deduction_type: deductionType,
                amount,
                months: deductionType === "loan" ? months : undefined,
                note: deductionNote
              });
              setDeductionSaving(false);
              if (!result.success) {
                toast({ title: "Save failed", description: result.error || "Could not save deduction", variant: "error" });
                return;
              }
              toast({ title: "Saved", description: "Advance/loan recorded.", variant: "success" });
              setDeductionAmount("");
              setDeductionMonths("");
              setDeductionNote("");
              setDeductionType("");
            }}
          >
            <div className="space-y-1">
              <label className="text-sm font-medium">Worker</label>
              <SearchableSelect
                value={deductionWorkerId}
                options={workers.map((worker) => ({ value: worker.id, label: worker.name }))}
                placeholder="Search worker"
                onChange={setDeductionWorkerId}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Type</label>
              <SearchableSelect
                value={deductionType}
                options={[
                  { value: "advance", label: "Advance" },
                  { value: "loan", label: "Loan" }
                ]}
                placeholder="Select type"
                onChange={(value) => setDeductionType(value === "loan" ? "loan" : value === "advance" ? "advance" : "")}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Amount</label>
              <Input type="number" min={0.01} step="0.01" value={deductionAmount} onChange={(e) => setDeductionAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Note</label>
              <Input value={deductionNote} onChange={(e) => setDeductionNote(e.target.value)} placeholder="Optional note" />
            </div>
            {deductionType === "loan" ? (
              <div className="space-y-1">
                <label className="text-sm font-medium">Months</label>
                <Input type="number" min={1} step={1} value={deductionMonths} onChange={(e) => setDeductionMonths(e.target.value)} />
              </div>
            ) : null}
            <div className="md:col-span-2">
              <Button type="submit" disabled={deductionSaving}>
                {deductionSaving ? "Saving..." : "Save Advance / Loan"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

    </section>
  );
}
