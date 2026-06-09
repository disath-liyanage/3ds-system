const PAGE_SIZE = 1000;

export const TABLES = [
  "custom_roles",
  "workers",
  "users_profile",
  "products",
  "customers",
  "suppliers",
  "orders",
  "order_items",
  "receive_notes",
  "receive_note_items",
  "invoices",
  "invoice_items",
  "collection_expenses",
  "collections",
  "worker_attendance",
  "worker_deductions",
  "sales_rep_monthly_targets",
  "manager_monthly_sales_targets",
  "collection_incentives",
  "notifications",
  "return_invoices",
  "return_invoice_items",
  "audit_log"
] as const;

type Row = Record<string, unknown>;
type SupabaseRowsResponse = { data: unknown[] | null; error: { message: string } | null };
type SupabaseTableClient = {
  from: (tableName: string) => {
    select: (columns: string) => {
      order: (
        column: string,
        options: { ascending: boolean }
      ) => {
        range: (from: number, to: number) => PromiseLike<SupabaseRowsResponse>;
      };
    };
  };
};

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function escapeSqlString(value: string) {
  return value.replaceAll("'", "''");
}

function serializeValue(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "object") return `'${escapeSqlString(JSON.stringify(value))}'::jsonb`;

  return `'${escapeSqlString(String(value))}'`;
}

export async function fetchAllRows(tableName: string, supabase: SupabaseTableClient) {
  const rows: Row[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch ${tableName}: ${error.message}`);
    }

    const pageRows = (data ?? []) as Row[];
    rows.push(...pageRows);

    if (pageRows.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}

export function generateInsertBlock(tableName: string, rows: Row[]) {
  if (rows.length === 0) {
    return `-- No data in ${tableName}`;
  }

  const columns = Object.keys(rows[0]);
  const columnList = columns.map(quoteIdentifier).join(", ");
  const values = rows
    .map((row) => `(${columns.map((column) => serializeValue(row[column])).join(", ")})`)
    .join(",\n");
  const updateSet = columns
    .filter((column) => column !== "id")
    .map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`)
    .join(", ");
  const conflictClause = updateSet ? `DO UPDATE SET ${updateSet}` : "DO NOTHING";

  return `INSERT INTO ${quoteIdentifier(tableName)} (${columnList}) VALUES\n${values}\nON CONFLICT (id) ${conflictClause};`;
}

export async function generateBackupSQL(supabase: SupabaseTableClient, onProgress?: (msg: string) => void) {
  const generatedAt = new Date().toISOString();
  const insertBlocks: string[] = [];

  for (const tableName of TABLES) {
    onProgress?.(`Fetching ${tableName.replaceAll("_", " ")}...`);
    const rows = await fetchAllRows(tableName, supabase);
    insertBlocks.push(generateInsertBlock(tableName, rows));
  }

  const truncateTables = [...TABLES].reverse().map(quoteIdentifier).join(", ");

  return [
    "-- 3DS System Data Backup",
    `-- Generated: ${generatedAt}`,
    "-- WARNING: This file restores data only. Schema must already exist.",
    "-- Run migrations before applying this backup to a fresh Supabase project.",
    "",
    "BEGIN;",
    "",
    "SET session_replication_role = replica;",
    "",
    `TRUNCATE TABLE ${truncateTables} RESTART IDENTITY CASCADE;`,
    "",
    insertBlocks.join("\n\n"),
    "",
    "SET session_replication_role = DEFAULT;",
    "",
    "COMMIT;",
    ""
  ].join("\n");
}

export function downloadBackupFile(sql: string) {
  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const blob = new Blob([sql], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `3ds-backup-${timestamp}.sql`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
