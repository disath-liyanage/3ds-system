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
