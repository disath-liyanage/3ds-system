"use client";

import { AlertTriangle, Download, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateBackupSQLAction } from "@/app/actions/backup";
import { downloadBackupFile } from "@/lib/backup/generateBackupSQL";
import { cn } from "@/lib/utils";

export function BackupClient() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsGenerating(true);
    setError(null);
    setStatus("Fetching backup data...");

    try {
      const result = await generateBackupSQLAction();

      if (!result.success || !result.sql) {
        throw new Error(result.error ?? "Failed to generate backup.");
      }

      setStatus("Starting download...");
      downloadBackupFile(result.sql);
      setStatus("Backup downloaded.");
    } catch (backupError) {
      setError(backupError instanceof Error ? backupError.message : "Failed to generate backup.");
      setStatus("");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass-panel border-red-200 bg-red-50/90 p-4 text-red-800">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm font-medium leading-6">
            Restoring will permanently overwrite all current data with this snapshot.
            <br />
            Ensure the schema is already applied before running a restore.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Download Backup</CardTitle>
          <CardDescription>Generate a SQL snapshot containing all application data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button onClick={handleDownload} disabled={isGenerating} className="gap-2 sm:w-auto">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isGenerating ? "Generating..." : "Download Backup"}
            </Button>

            {status ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin text-brand" /> : null}
                <span>{status}</span>
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Restore Instructions</CardTitle>
          <CardDescription>Use the downloaded SQL file to manually restore a Supabase project.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className={cn("list-decimal space-y-3 pl-5 text-sm leading-6 text-muted-foreground")}>
            <li>Ensure the schema is already applied on the target Supabase project.</li>
            <li>Open the Supabase SQL Editor from the Supabase dashboard.</li>
            <li>Copy the entire contents of the downloaded .sql file.</li>
            <li>Paste into the SQL editor and click Run.</li>
            <li>All data will be restored to the state at the time of the backup.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
