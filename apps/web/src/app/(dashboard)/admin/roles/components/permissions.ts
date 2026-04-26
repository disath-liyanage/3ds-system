import type { CustomRole } from "@paintdist/shared";

export type PermissionKey =
  | "perm_create_orders"
  | "perm_approve_orders"
  | "perm_view_all_orders"
  | "perm_record_collections"
  | "perm_validate_collections"
  | "perm_manage_products"
  | "perm_manage_customers"
  | "perm_create_invoices"
  | "perm_manage_receive_notes"
  | "perm_view_reports"
  | "perm_export_reports"
  | "perm_manage_users"
  | "perm_view_users";

export const permissionGroups: Array<{
  title: string;
  items: Array<{ key: PermissionKey; label: string }>;
}> = [
  {
    title: "Orders",
    items: [
      { key: "perm_create_orders", label: "Create orders" },
      { key: "perm_approve_orders", label: "Approve/reject orders" },
      { key: "perm_view_all_orders", label: "View all orders" }
    ]
  },
  {
    title: "Collections",
    items: [
      { key: "perm_record_collections", label: "Record collections" },
      { key: "perm_validate_collections", label: "Validate collections" }
    ]
  },
  {
    title: "Products & Customers",
    items: [
      { key: "perm_manage_products", label: "Manage products" },
      { key: "perm_manage_customers", label: "Manage customers" }
    ]
  },
  {
    title: "Invoices & Docs",
    items: [
      { key: "perm_create_invoices", label: "Create invoices" },
      { key: "perm_manage_receive_notes", label: "Manage receive notes" }
    ]
  },
  {
    title: "Reports",
    items: [
      { key: "perm_view_reports", label: "View reports" },
      { key: "perm_export_reports", label: "Export reports" }
    ]
  },
  {
    title: "Users",
    items: [
      { key: "perm_view_users", label: "View users" },
      { key: "perm_manage_users", label: "Manage users" }
    ]
  }
];

export const defaultPermissions: Record<PermissionKey, boolean> = {
  perm_create_orders: false,
  perm_approve_orders: false,
  perm_view_all_orders: false,
  perm_record_collections: false,
  perm_validate_collections: false,
  perm_manage_products: false,
  perm_manage_customers: false,
  perm_create_invoices: false,
  perm_manage_receive_notes: false,
  perm_view_reports: false,
  perm_export_reports: false,
  perm_manage_users: false,
  perm_view_users: false
};

export function extractEnabledPermissionLabels(role: CustomRole) {
  return permissionGroups
    .flatMap((group) => group.items)
    .filter((item) => role[item.key])
    .map((item) => item.label);
}
