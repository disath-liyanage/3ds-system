export type UserRole = "admin" | "manager" | "sales_rep" | "cashier" | "custom";

export interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  perm_create_orders: boolean;
  perm_approve_orders: boolean;
  perm_view_all_orders: boolean;
  perm_record_collections: boolean;
  perm_validate_collections: boolean;
  perm_manage_products: boolean;
  perm_manage_customers: boolean;
  perm_create_invoices: boolean;
  perm_manage_receive_notes: boolean;
  perm_view_reports: boolean;
  perm_export_reports: boolean;
  perm_manage_users: boolean;
  perm_view_users: boolean;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  custom_role_id?: string | null;
  custom_role?: CustomRole | null;
  is_active?: boolean;
  created_by?: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  area: string;
  credit_limit: number;
  balance: number;
  status?: "pending_approval" | "active" | "rejected";
  created_by?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  stock_qty: number;
  low_stock_threshold: number;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: number;
  customer_id: string;
  created_by: string;
  status: "pending" | "reviewing" | "approved" | "rejected" | "invoiced";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  qty: number;
  unit_price: number;
}

export interface Collection {
  id: string;
  collection_number: number;
  customer_id: string;
  collected_by: string;
  amount: number;
  validated_by: string | null;
  status: "pending" | "validated" | "rejected";
  notes: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: number;
  order_id: string;
  customer_id: string;
  issued_by: string;
  total_amount: number;
  status: "draft" | "issued" | "paid";
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  title: string;
  message: string;
  type: string;
  customer_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ReceiveNote {
  id: string;
  rn_number: number;
  supplier_name: string;
  received_by: string;
  notes: string | null;
  created_at: string;
}

export interface ReceiveNoteItem {
  id: string;
  receive_note_id: string;
  product_id: string;
  qty: number;
  unit_cost: number;
}
