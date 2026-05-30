import type { Worker } from "@paintdist/shared";
import { redirect } from "next/navigation";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { AttendanceClient } from "./components/AttendanceClient";

type AttendanceRow = {
  worker_id: string;
  attendance_date: string;
  status: "present" | "absent" | "half_day" | "leave" | "holiday";
  note: string | null;
};

type RawChequeDepositRow = {
  id: string;
  collection_number: number;
  amount: number;
  cheque_deposit_date: string;
  status: "pending" | "validated" | "rejected";
  customer: { name: string | null } | { name: string | null }[] | null;
  invoice: { invoice_number: number | null } | { invoice_number: number | null }[] | null;
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

export default async function AttendancePage({
  searchParams
}: {
  searchParams?: { year?: string; month?: string };
}) {
  const timeZone = "Asia/Colombo";
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileById } = await adminClient
    .from("users_profile")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  let profile = profileById;

  if (!profile && user.email) {
    const { data: profileByEmail } = await adminClient
      .from("users_profile")
      .select("id, role")
      .eq("email", user.email)
      .maybeSingle();

    profile = profileByEmail;
  }

  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    redirect("/dashboard");
  }

  const nowParts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const yearPart = nowParts.find((part) => part.type === "year")?.value;
  const monthPart = nowParts.find((part) => part.type === "month")?.value;
  const defaultYear = yearPart ? Number(yearPart) : new Date().getFullYear();
  const defaultMonth = monthPart ? Number(monthPart) - 1 : new Date().getMonth();

  const requestedYear = Number(searchParams?.year);
  const requestedMonth = Number(searchParams?.month);
  const year = Number.isFinite(requestedYear) ? requestedYear : defaultYear;
  const month = Number.isFinite(requestedMonth) && requestedMonth >= 0 && requestedMonth <= 11
    ? requestedMonth
    : defaultMonth;
  const monthText = String(month + 1).padStart(2, "0");
  const from = `${year}-${monthText}-01`;
  const to = `${year}-${monthText}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, "0")}`;

  const [
    { data: workers, error: workersError },
    { data: attendanceRows, error: attendanceError },
    { data: chequeDepositRows, error: chequeDepositError }
  ] = await Promise.all([
    adminClient
      .from("workers")
      .select("id, name, identity_card_no, salary_type, salary_amount, created_at")
      .order("name", { ascending: true }),
    adminClient
      .from("worker_attendance")
      .select("worker_id, attendance_date, status, note")
      .gte("attendance_date", from)
      .lte("attendance_date", to),
    adminClient
      .from("collections")
      .select(
        "id, collection_number, amount, cheque_deposit_date, status, customer:customers(name), invoice:invoices(invoice_number)"
      )
      .eq("payment_type", "cheque")
      .in("status", ["pending", "validated"])
      .gte("cheque_deposit_date", from)
      .lte("cheque_deposit_date", to)
      .order("cheque_deposit_date", { ascending: true })
  ]);

  const chequeDeposits: ChequeDepositRow[] = ((chequeDepositRows ?? []) as RawChequeDepositRow[]).map((row) => {
    const customer = Array.isArray(row.customer) ? row.customer[0] || null : row.customer;
    const invoice = Array.isArray(row.invoice) ? row.invoice[0] || null : row.invoice;
    return {
      id: row.id,
      collection_number: row.collection_number,
      amount: Number(row.amount),
      deposit_date: row.cheque_deposit_date,
      status: row.status,
      customer_name: customer?.name || "Unknown customer",
      invoice_number: invoice?.invoice_number ?? null
    };
  });

  return (
    <div className="space-y-4">
      {workersError ? <p className="text-sm text-red-600">Failed to load workers: {workersError.message}</p> : null}
      {attendanceError ? (
        <p className="text-sm text-red-600">Failed to load attendance: {attendanceError.message}</p>
      ) : null}
      {chequeDepositError ? (
        <p className="text-sm text-red-600">Failed to load cheque deposit dates: {chequeDepositError.message}</p>
      ) : null}
      <AttendanceClient
        workers={(workers ?? []) as Worker[]}
        initialAttendance={(attendanceRows ?? []) as AttendanceRow[]}
        chequeDeposits={chequeDeposits}
        initialYear={year}
        initialMonth={month}
      />
    </div>
  );
}
