export interface User {
  id: string;
  email: string;
  role: "admin" | "manager" | "sales_rep" | "cashier";
  full_name: string;
  phone: string;
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