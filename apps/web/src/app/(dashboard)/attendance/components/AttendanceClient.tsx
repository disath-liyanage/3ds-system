"use client";

import type { Worker } from "@paintdist/shared";
import { useMemo, useState, useTransition } from "react";

import { markWorkerAttendance } from "@/app/actions/attendance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

type AttendanceClientProps = {
  workers: Worker[];
  initialAttendance: AttendanceRow[];
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

export function AttendanceClient({
  workers,
  initialAttendance,
  initialYear,
  initialMonth
}: AttendanceClientProps) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>(() => {
    const entries = initialAttendance.map((row) => [`${row.worker_id}:${row.attendance_date}`, row.status] as const);
    return Object.fromEntries(entries);
  });
  const [isPending, startTransition] = useTransition();
  const todayDateKey = getTodayDateKey();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekDay = new Date(year, month, 1).getDay();

  const holidayMap = useMemo(
    () => Object.fromEntries(getSriLankaHolidays(year).map((item) => [item.date, item.name])),
    [year]
  );

  const selectedDateKey = selectedDay ? toDateKey(year, month, selectedDay) : null;

  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Colombo"
  }).format(new Date(year, month, 1));

  const markAllAsHoliday = () => {
    if (!selectedDateKey || workers.length === 0) return;

    startTransition(async () => {
      const results = await Promise.all(
        workers.map((worker) =>
          markWorkerAttendance({
            workerId: worker.id,
            attendanceDate: selectedDateKey,
            status: "holiday"
          })
        )
      );

      const failed = results.find((result) => !result.success);
      if (failed) {
        toast({
          title: "Bulk update failed",
          description: failed.error ?? "Could not mark all workers as holiday",
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
                    setMonth(Number(event.target.value));
                    setSelectedDay(null);
                  }}
                />
                <Select
                  value={String(year)}
                  options={yearOptions}
                  onChange={(event) => {
                    setYear(Number(event.target.value));
                    setSelectedDay(null);
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
                const isHoliday = Boolean(holidayMap[dateKey]);
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

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "rounded-md border px-2 py-2 text-left text-xs transition",
                      selectedDay === day ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                      dateKey === todayDateKey ? "ring-2 ring-blue-400 ring-offset-1" : "",
                      isSunday ? "bg-rose-50" : "",
                      isSaturday ? "bg-sky-50" : "",
                      shouldUseHolidayShade ? "bg-amber-100 border-amber-300" : ""
                    )}
                  >
                    <div className="font-semibold">{day}</div>
                    {dateKey === todayDateKey ? <div className="mt-1 text-[10px] text-blue-700">Today</div> : null}
                    {isSunday ? <div className="mt-1 text-[10px] text-rose-700">Sunday</div> : null}
                    {isSaturday ? <div className="mt-1 text-[10px] text-sky-700">Saturday</div> : null}
                    {isHoliday ? <div className="mt-1 text-[10px] text-amber-700">Holiday</div> : null}
                    {!isHoliday && isFullyMarkedAsHoliday ? (
                      <div className="mt-1 text-[10px] text-amber-700">All marked holiday</div>
                    ) : null}
                    <div className="mt-1 text-[10px] text-slate-600">{markedCount}/{workers.length} marked</div>
                  </button>
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
              <Badge className="bg-amber-100 text-amber-700">{holidayMap[selectedDateKey]}</Badge>
            ) : null}

            <Button
              type="button"
              variant="outline"
              onClick={markAllAsHoliday}
              disabled={!selectedDateKey || isPending || workers.length === 0}
              className="w-full border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
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
                        <Badge className={status ? "bg-slate-200 text-slate-700" : "bg-orange-100 text-orange-700"}>
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
    </section>
  );
}
