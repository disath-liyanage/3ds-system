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
  const [selectedWorkerId, setSelectedWorkerId] = useState(workers[0]?.id ?? "");
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
  const selectedAttendanceKey = selectedWorkerId && selectedDateKey ? `${selectedWorkerId}:${selectedDateKey}` : "";

  const selectedStatus = selectedAttendanceKey ? attendanceMap[selectedAttendanceKey] ?? "" : "";

  const selectedWorker = workers.find((worker) => worker.id === selectedWorkerId);

  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Colombo"
  }).format(new Date(year, month, 1));

  const onSave = (status: AttendanceStatus) => {
    if (!selectedWorkerId || !selectedDay || !selectedDateKey) return;

    startTransition(async () => {
      const result = await markWorkerAttendance({
        workerId: selectedWorkerId,
        attendanceDate: selectedDateKey,
        status
      });

      if (!result.success) {
        toast({ title: "Save failed", description: result.error ?? "Could not mark attendance", variant: "error" });
        return;
      }

      setAttendanceMap((prev) => ({
        ...prev,
        [`${selectedWorkerId}:${selectedDateKey}`]: status
      }));

      toast({ title: "Attendance saved", description: `${selectedWorker?.name ?? "Worker"} marked as ${status}.`, variant: "success" });
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
            <CardDescription>Pick a date, then mark status for the selected worker.</CardDescription>
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
                const isHoliday = Boolean(holidayMap[dateKey]);
                const key = selectedWorkerId ? `${selectedWorkerId}:${dateKey}` : "";
                const status = key ? attendanceMap[key] : undefined;

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "rounded-md border px-2 py-2 text-left text-xs transition",
                      selectedDay === day ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                      dateKey === todayDateKey ? "ring-2 ring-blue-400 ring-offset-1" : "",
                      isHoliday ? "bg-amber-50" : ""
                    )}
                  >
                    <div className="font-semibold">{day}</div>
                    {dateKey === todayDateKey ? <div className="mt-1 text-[10px] text-blue-700">Today</div> : null}
                    {isHoliday ? <div className="mt-1 text-[10px] text-amber-700">Holiday</div> : null}
                    {status ? <div className="mt-1 text-[10px] text-slate-600">{status.replace("_", " ")}</div> : null}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mark Attendance</CardTitle>
            <CardDescription>Choose worker and attendance status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Worker</p>
              <Select
                value={selectedWorkerId}
                options={workers.map((worker) => ({ value: worker.id, label: worker.name }))}
                placeholder="Select worker"
                onChange={(event) => setSelectedWorkerId(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium">Date</p>
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                {selectedDateKey ?? "Select a date from calendar"}
              </p>
            </div>

            {selectedDateKey && holidayMap[selectedDateKey] ? (
              <Badge className="bg-amber-100 text-amber-700">{holidayMap[selectedDateKey]}</Badge>
            ) : null}

            <div className="space-y-2">
              <p className="text-sm font-medium">Status</p>
              <div className="grid grid-cols-2 gap-2">
                {statusOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={selectedStatus === option.value ? "default" : "outline"}
                    onClick={() => onSave(option.value as AttendanceStatus)}
                    disabled={isPending || !selectedWorkerId || !selectedDateKey}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
