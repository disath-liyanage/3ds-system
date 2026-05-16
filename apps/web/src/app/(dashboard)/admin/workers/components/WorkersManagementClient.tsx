"use client";

import type { Worker, User } from "@paintdist/shared";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { createWorker, createWorkerDeduction, deleteWorker, updateWorker } from "@/app/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";

type WorkersManagementClientProps = {
  workers: Worker[];
  currentUser: User;
};

type WorkerFormState = {
  name: string;
  identity_card_no: string;
  salary_type: "daily" | "monthly_basic" | "";
  salary_amount: string;
};

type DeductionFormState = {
  worker_id: string;
  deduction_type: "advance" | "loan";
  amount: string;
  months: string;
  note: string;
};

const initialFormState: WorkerFormState = {
  name: "",
  identity_card_no: "",
  salary_type: "",
  salary_amount: ""
};

function toFormState(worker: Worker): WorkerFormState {
  return {
    name: worker.name,
    identity_card_no: worker.identity_card_no,
    salary_type: worker.salary_type,
    salary_amount: String(worker.salary_amount)
  };
}

export function WorkersManagementClient({ workers, currentUser }: WorkersManagementClientProps) {
  const router = useRouter();
  const [rows, setRows] = useState(workers);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [form, setForm] = useState<WorkerFormState>(initialFormState);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingWorkerId, setProcessingWorkerId] = useState<string | null>(null);
  const [deductionForm, setDeductionForm] = useState<DeductionFormState>({
    worker_id: "",
    deduction_type: "advance",
    amount: "",
    months: "",
    note: ""
  });
  const [deductionError, setDeductionError] = useState<string | null>(null);
  const [isDeductionSubmitting, setIsDeductionSubmitting] = useState(false);

  useEffect(() => {
    setRows(workers);
  }, [workers]);

  useEffect(() => {
    if (isDialogOpen && editingWorker) {
      setForm(toFormState(editingWorker));
      setSubmitError(null);
      return;
    }

    if (isDialogOpen) {
      setForm(initialFormState);
      setSubmitError(null);
    }
  }, [isDialogOpen, editingWorker]);

  const permissions = usePermissions(currentUser);
  const canManageWorkerMaster = currentUser.role === "admin";
  const canAddDeductions = currentUser.role === "admin" || currentUser.role === "manager";

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [rows]
  );

  const handleRefresh = () => {
    router.refresh();
  };

  const handleOpenCreate = () => {
    setEditingWorker(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (worker: Worker) => {
    setEditingWorker(worker);
    setIsDialogOpen(true);
  };

  const handleDelete = async (worker: Worker) => {
    if (!permissions.canManageUsers) return;

    const confirmed = window.confirm(`Delete worker ${worker.name}?`);
    if (!confirmed) return;

    setProcessingWorkerId(worker.id);
    const result = await deleteWorker(worker.id);

    if (!result.success) {
      toast({ title: "Delete failed", description: result.error || "Could not delete worker", variant: "error" });
      setProcessingWorkerId(null);
      return;
    }

    toast({ title: "Worker deleted", description: `${worker.name} was removed.`, variant: "success" });
    setProcessingWorkerId(null);
    handleRefresh();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    const parsedSalary = Number(form.salary_amount);
    if (!form.salary_type) {
      setSubmitError("Please select salary type");
      return;
    }
    if (!Number.isFinite(parsedSalary) || parsedSalary < 0) {
      setSubmitError("Salary amount must be a valid non-negative number");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      name: form.name,
      identity_card_no: form.identity_card_no,
      salary_type: form.salary_type,
      salary_amount: parsedSalary
    };

    const result = editingWorker ? await updateWorker(editingWorker.id, payload) : await createWorker(payload);

    if (!result.success) {
      setSubmitError(result.error || "Failed to save worker");
      setIsSubmitting(false);
      return;
    }

    toast({
      title: editingWorker ? "Worker updated" : "Worker created",
      description: `${form.name} was saved successfully.`,
      variant: "success"
    });

    setIsSubmitting(false);
    setIsDialogOpen(false);
    setEditingWorker(null);
    handleRefresh();
  };

  if (!permissions.canViewUsers) {
    return (
      <div className="rounded-lg border border-border bg-white p-4 text-sm text-muted-foreground">
        You do not have permission to manage workers.
      </div>
    );
  }

  const handleSubmitDeduction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDeductionError(null);

    if (!deductionForm.worker_id) {
      setDeductionError("Please select a worker");
      return;
    }

    const amount = Number(deductionForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setDeductionError("Amount must be greater than 0");
      return;
    }

    const months = Number(deductionForm.months);
    if (deductionForm.deduction_type === "loan" && (!Number.isInteger(months) || months <= 0)) {
      setDeductionError("Loan months must be a valid positive number");
      return;
    }

    setIsDeductionSubmitting(true);
    const result = await createWorkerDeduction({
      worker_id: deductionForm.worker_id,
      deduction_type: deductionForm.deduction_type,
      amount,
      months: deductionForm.deduction_type === "loan" ? months : undefined,
      note: deductionForm.note
    });

    if (!result.success) {
      setDeductionError(result.error || "Could not save worker deduction");
      setIsDeductionSubmitting(false);
      return;
    }

    toast({ title: "Saved", description: "Worker deduction was recorded.", variant: "success" });
    setIsDeductionSubmitting(false);
    setDeductionForm((prev) => ({ ...prev, amount: "", months: "", note: "" }));
    handleRefresh();
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Workers</h1>
          <p className="text-sm text-muted-foreground">
            Manage worker salary setup and link each worker to only one system user.
          </p>
        </div>
        {canManageWorkerMaster ? <Button onClick={handleOpenCreate}>Add Worker</Button> : null}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Identity Card No</TableHead>
            <TableHead>Salary Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Created</TableHead>
            {canManageWorkerMaster ? <TableHead>Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((worker) => {
            const isProcessing = processingWorkerId === worker.id;
            return (
              <TableRow key={worker.id}>
                <TableCell className="font-medium">{worker.name}</TableCell>
                <TableCell>{worker.identity_card_no}</TableCell>
                <TableCell>
                  <Badge className="bg-slate-200 text-slate-700">
                    {worker.salary_type === "daily" ? "Pay per Day" : "Basic Salary (Monthly)"}
                  </Badge>
                </TableCell>
                <TableCell>{Number(worker.salary_amount).toFixed(2)}</TableCell>
                <TableCell>{formatDate(worker.created_at)}</TableCell>
                {canManageWorkerMaster ? (
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" disabled={isProcessing} onClick={() => handleOpenEdit(worker)}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" disabled={isProcessing} onClick={() => handleDelete(worker)}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {canAddDeductions ? (
        <form className="space-y-3 rounded-md border border-border p-4" onSubmit={handleSubmitDeduction}>
          <h2 className="text-lg font-semibold">Add Advance / Loan</h2>
          <p className="text-sm text-muted-foreground">
            Advance deducts fully in the current month. Loan deducts monthly installments until the selected months are completed.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Worker</label>
              <SearchableSelect
                value={deductionForm.worker_id}
                options={sortedRows.map((worker) => ({ value: worker.id, label: worker.name }))}
                placeholder="Select worker"
                onChange={(value) => setDeductionForm((prev) => ({ ...prev, worker_id: value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Type</label>
              <SearchableSelect
                value={deductionForm.deduction_type}
                options={[
                  { value: "advance", label: "Advance" },
                  { value: "loan", label: "Loan" }
                ]}
                onChange={(value) =>
                  setDeductionForm((prev) => ({
                    ...prev,
                    deduction_type: value === "loan" ? "loan" : "advance"
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Amount</label>
              <Input
                required
                type="number"
                min={0.01}
                step="0.01"
                value={deductionForm.amount}
                onChange={(event) => setDeductionForm((prev) => ({ ...prev, amount: event.target.value }))}
                placeholder="0.00"
              />
            </div>
            {deductionForm.deduction_type === "loan" ? (
              <div className="space-y-1">
                <label className="text-sm font-medium">Months</label>
                <Input
                  required
                  type="number"
                  min={1}
                  step={1}
                  value={deductionForm.months}
                  onChange={(event) => setDeductionForm((prev) => ({ ...prev, months: event.target.value }))}
                  placeholder="e.g. 6"
                />
              </div>
            ) : null}
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Note</label>
              <Input
                value={deductionForm.note}
                onChange={(event) => setDeductionForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="Optional note"
              />
            </div>
          </div>
          {deductionError ? <p className="text-sm text-red-600">{deductionError}</p> : null}
          <Button type="submit" disabled={isDeductionSubmitting}>
            {isDeductionSubmitting ? "Saving..." : "Save Deduction"}
          </Button>
        </form>
      ) : null}

      {canManageWorkerMaster ? (
        <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingWorker(null);
            setIsSubmitting(false);
            setSubmitError(null);
          }
        }}
        title={editingWorker ? "Edit worker" : "Add worker"}
        description="Set worker details and salary mode."
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label htmlFor="worker-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="worker-name"
              required
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="e.g. Kamal Silva"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="worker-id-card" className="text-sm font-medium">
              Identity Card No
            </label>
            <Input
              id="worker-id-card"
              required
              value={form.identity_card_no}
              onChange={(event) => setForm((prev) => ({ ...prev, identity_card_no: event.target.value }))}
              placeholder="e.g. 901234567V"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="worker-salary-type" className="text-sm font-medium">
              Salary Type
            </label>
            <SearchableSelect
              id="worker-salary-type"
              required
              value={form.salary_type}
              placeholder="Select salary type"
              options={[
                { value: "daily", label: "Pay per Day" },
                { value: "monthly_basic", label: "Basic Salary (Monthly)" }
              ]}
              onChange={(value) => setForm((prev) => ({ ...prev, salary_type: value as WorkerFormState["salary_type"] }))}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="worker-salary-amount" className="text-sm font-medium">
              Salary Amount
            </label>
            <Input
              id="worker-salary-amount"
              required
              type="number"
              min={0}
              step="0.01"
              value={form.salary_amount}
              onChange={(event) => setForm((prev) => ({ ...prev, salary_amount: event.target.value }))}
              placeholder="0.00"
            />
          </div>

          {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : editingWorker ? "Save changes" : "Create worker"}
          </Button>
        </form>
      </Dialog>
      ) : null}
    </section>
  );
}
