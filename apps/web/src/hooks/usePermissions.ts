import type { CustomRole, User } from "@paintdist/shared";

export function usePermissions(user: User, customRole?: CustomRole) {
  const isAdmin = user.role === "admin";
  const isManager = user.role === "manager";

  return {
    canCreateOrders:
      isAdmin ||
      isManager ||
      user.role === "sales_rep" ||
      user.role === "cashier" ||
      Boolean(customRole?.perm_create_orders),
    canApproveOrders:
      isAdmin || isManager || user.role === "cashier" || Boolean(customRole?.perm_approve_orders),
    canViewAllOrders:
      isAdmin || isManager || user.role === "cashier" || Boolean(customRole?.perm_view_all_orders),
    canRecordCollections:
      isAdmin || isManager || user.role === "sales_rep" || Boolean(customRole?.perm_record_collections),
    canValidateCollections:
      isAdmin || isManager || user.role === "cashier" || Boolean(customRole?.perm_validate_collections),
    canManageProducts: isAdmin || isManager || Boolean(customRole?.perm_manage_products),
    canManageCustomers:
      isAdmin || isManager || user.role === "cashier" || Boolean(customRole?.perm_manage_customers),
    canCreateInvoices:
      isAdmin || isManager || user.role === "cashier" || Boolean(customRole?.perm_create_invoices),
    canManageReceiveNotes: isAdmin || isManager || Boolean(customRole?.perm_manage_receive_notes),
    canViewReports: isAdmin || isManager || Boolean(customRole?.perm_view_reports),
    canExportReports: isAdmin || isManager || Boolean(customRole?.perm_export_reports),
    canManageUsers: isAdmin || Boolean(customRole?.perm_manage_users),
    canViewUsers: isAdmin || isManager || Boolean(customRole?.perm_view_users)
  };
}
