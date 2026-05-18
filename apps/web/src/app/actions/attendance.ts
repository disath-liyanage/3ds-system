"use server";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type AttendanceStatus = "present" | "absent" | "half_day" | "leave" | "holiday";

type ActionResult = {
  success: boolean;
  error?: string;
};

type MarkAttendanceInput = {
  workerId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  note?: string;
};

type BulkMarkAttendanceInput = {
  workerIds: string[];
  attendanceDate: string;
  status: AttendanceStatus;
  note?: string;
};

type UpsertSalesTargetInput = {
  salesRepId: string;
  month: string;
  targetAmount: number;
  incentiveAmount: number;
};

type UpsertManagerSalesTargetInput = {
  month: string;
  targetAmount: number;
};

async function requireAdminOrManager() {
  const supabase = createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Unauthorized" as const };
  }

  const { data: profileById, error: profileByIdError } = await adminClient
    .from("users_profile")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileByIdError) return { error: "Unauthorized" as const };

  let profile = profileById;

  if (!profile && user.email) {
    const { data: profileByEmail, error: profileByEmailError } = await adminClient
      .from("users_profile")
      .select("id, role")
      .eq("email", user.email)
      .maybeSingle();

    if (profileByEmailError) return { error: "Unauthorized" as const };
    profile = profileByEmail;
  }

  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    return { error: "Unauthorized" as const };
  }

  return {
    userId: profile.id,
    supabase: adminClient
  };
}

export async function markWorkerAttendance(input: MarkAttendanceInput): Promise<ActionResult> {
  const auth = await requireAdminOrManager();
  if ("error" in auth) return { success: false, error: auth.error };

  if (!input.workerId || !input.attendanceDate || !input.status) {
    return { success: false, error: "Worker, date, and status are required" };
  }

  const updatedAt = new Date().toISOString();
  const { error } = await auth.supabase.from("worker_attendance").upsert(
    {
      worker_id: input.workerId,
      attendance_date: input.attendanceDate,
      status: input.status,
      note: input.note?.trim() || null,
      marked_by: auth.userId,
      updated_at: updatedAt
    },
    { onConflict: "worker_id,attendance_date" }
  );

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function markWorkersAttendance(input: BulkMarkAttendanceInput): Promise<ActionResult> {
  const auth = await requireAdminOrManager();
  if ("error" in auth) return { success: false, error: auth.error };

  if (!input.workerIds.length || !input.attendanceDate || !input.status) {
    return { success: false, error: "Worker list, date, and status are required" };
  }

  const updatedAt = new Date().toISOString();
  const rows = input.workerIds.map((workerId) => ({
    worker_id: workerId,
    attendance_date: input.attendanceDate,
    status: input.status,
    note: input.note?.trim() || null,
    marked_by: auth.userId,
    updated_at: updatedAt
  }));

  const { error } = await auth.supabase.from("worker_attendance").upsert(rows, {
    onConflict: "worker_id,attendance_date"
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function listSalesReps(): Promise<{ success: boolean; error?: string; reps?: Array<{ id: string; full_name: string }> }> {
  const auth = await requireAdminOrManager();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await auth.supabase
    .from("users_profile")
    .select("id, full_name")
    .eq("role", "sales_rep")
    .order("full_name", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, reps: (data ?? []) as Array<{ id: string; full_name: string }> };
}

export async function upsertSalesRepMonthlyTarget(input: UpsertSalesTargetInput): Promise<ActionResult> {
  const auth = await requireAdminOrManager();
  if ("error" in auth) return { success: false, error: auth.error };

  if (!input.salesRepId || !input.month) {
    return { success: false, error: "Sales rep and month are required" };
  }

  const targetAmount = Number(input.targetAmount);
  const incentiveAmount = Number(input.incentiveAmount);
  if (!Number.isFinite(targetAmount) || targetAmount < 0) {
    return { success: false, error: "Target amount must be valid" };
  }
  if (!Number.isFinite(incentiveAmount) || incentiveAmount < 0) {
    return { success: false, error: "Incentive amount must be valid" };
  }

  const targetMonth = new Date(`${input.month}-01T00:00:00.000Z`);
  if (!Number.isFinite(targetMonth.getTime())) {
    return { success: false, error: "Invalid month" };
  }
  const monthDate = targetMonth.toISOString().slice(0, 10);
  const monthEnd = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  const { data: salesInvoices, error: salesError } = await auth.supabase
    .from("invoices")
    .select("total_amount")
    .eq("issued_by", input.salesRepId)
    .in("status", ["approved", "issued", "paid"])
    .gte("created_at", targetMonth.toISOString())
    .lte("created_at", monthEnd.toISOString());
  if (salesError) return { success: false, error: salesError.message };

  const currentSales = (salesInvoices ?? []).reduce((sum, row: any) => sum + (Number(row.total_amount) || 0), 0);
  const achieved = currentSales >= targetAmount;

  const { error } = await auth.supabase.from("sales_rep_monthly_targets").upsert(
    {
      sales_rep_id: input.salesRepId,
      target_month: monthDate,
      target_amount: targetAmount,
      incentive_amount: incentiveAmount,
      incentive_given_by: achieved && incentiveAmount > 0 ? auth.userId : null,
      incentive_given_at: achieved && incentiveAmount > 0 ? new Date().toISOString() : null,
      created_by: auth.userId,
      updated_at: new Date().toISOString()
    },
    { onConflict: "sales_rep_id,target_month" }
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function upsertManagerMonthlySalesTarget(input: UpsertManagerSalesTargetInput): Promise<ActionResult> {
  const auth = await requireAdminOrManager();
  if ("error" in auth) return { success: false, error: auth.error };

  if (!input.month) {
    return { success: false, error: "Month is required" };
  }

  const targetAmount = Number(input.targetAmount);
  if (!Number.isFinite(targetAmount) || targetAmount < 0) {
    return { success: false, error: "Target amount must be valid" };
  }

  const targetMonth = new Date(`${input.month}-01T00:00:00.000Z`);
  if (!Number.isFinite(targetMonth.getTime())) {
    return { success: false, error: "Invalid month" };
  }
  const monthDate = targetMonth.toISOString().slice(0, 10);

  const { error } = await auth.supabase.from("manager_monthly_sales_targets").upsert(
    {
      manager_id: auth.userId,
      target_month: monthDate,
      target_amount: targetAmount,
      created_by: auth.userId,
      updated_at: new Date().toISOString()
    },
    { onConflict: "manager_id,target_month" }
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}
