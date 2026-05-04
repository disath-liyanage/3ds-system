import { z } from "zod";

export const userRoleSchema = z.enum(["admin", "manager", "sales_rep", "cashier", "custom"]);

export const customRoleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string(),
  perm_create_orders: z.boolean(),
  perm_approve_orders: z.boolean(),
  perm_view_all_orders: z.boolean(),
  perm_record_collections: z.boolean(),
  perm_validate_collections: z.boolean(),
  perm_manage_products: z.boolean(),
  perm_manage_customers: z.boolean(),
  perm_create_invoices: z.boolean(),
  perm_manage_receive_notes: z.boolean(),
  perm_view_reports: z.boolean(),
  perm_export_reports: z.boolean(),
  perm_manage_users: z.boolean(),
  perm_view_users: z.boolean()
});

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: userRoleSchema,
  full_name: z.string().min(1),
  phone: z.string().nullable(),
  custom_role_id: z.string().uuid().nullable().optional(),
  custom_role: customRoleSchema.nullable().optional(),
  is_active: z.boolean().optional(),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string()
});

export const customerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().min(1),
  area: z.string().min(1),
  credit_limit: z.number(),
  balance: z.number(),
  status: z.enum(["pending_approval", "active", "rejected"]).optional(),
  created_by: z.string().uuid().optional(),
  sales_rep_id: z.string().uuid().nullable().optional(),
  approved_by: z.string().uuid().nullable().optional(),
  approved_at: z.string().nullable().optional(),
  created_at: z.string()
});

export const supplierSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().min(1),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string()
});

export const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  category: z.string().min(1),
  unit: z.string().min(1),
  price: z.number(),
  stock_qty: z.number(),
  low_stock_threshold: z.number(),
  created_at: z.string()
});

export const orderStatusSchema = z.enum(["pending", "reviewing", "approved", "rejected", "invoiced"]);

export const orderSchema = z.object({
  id: z.string().uuid(),
  order_number: z.number().int(),
  customer_id: z.string().uuid(),
  created_by: z.string().uuid(),
  status: orderStatusSchema,
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

export const orderItemSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  product_id: z.string().uuid(),
  qty: z.number(),
  unit_price: z.number()
});

export const collectionStatusSchema = z.enum(["pending", "validated", "rejected"]);

export const collectionSchema = z.object({
  id: z.string().uuid(),
  collection_number: z.number().int(),
  customer_id: z.string().uuid(),
  collected_by: z.string().uuid(),
  amount: z.number(),
  validated_by: z.string().uuid().nullable(),
  status: collectionStatusSchema,
  notes: z.string().nullable(),
  created_at: z.string()
});

export const invoiceStatusSchema = z.enum(["draft", "issued", "paid"]);

export const invoiceSchema = z.object({
  id: z.string().uuid(),
  invoice_number: z.number().int(),
  order_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  issued_by: z.string().uuid(),
  total_amount: z.number(),
  status: invoiceStatusSchema,
  created_at: z.string()
});

export const receiveNoteSchema = z.object({
  id: z.string().uuid(),
  rn_number: z.number().int(),
  invoice_number: z.string().min(1),
  supplier_name: z.string().min(1),
  received_by: z.string().uuid(),
  notes: z.string().nullable(),
  created_at: z.string()
});

export const receiveNoteItemSchema = z.object({
  id: z.string().uuid(),
  receive_note_id: z.string().uuid(),
  product_id: z.string().uuid(),
  qty: z.number(),
  free_qty: z.number(),
  unit_cost: z.number(),
  selling_price: z.number(),
  item_discount_percent: z.number(),
  rep_sales_discount: z.number(),
  rep_collection: z.number()
});

export const notificationSchema = z.object({
  id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.string().min(1),
  customer_id: z.string().uuid().nullable(),
  is_read: z.boolean(),
  read_at: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string()
});

export type UserSchemaType = z.infer<typeof userSchema>;
export type CustomRoleSchemaType = z.infer<typeof customRoleSchema>;
export type CustomerSchemaType = z.infer<typeof customerSchema>;
export type SupplierSchemaType = z.infer<typeof supplierSchema>;
export type ProductSchemaType = z.infer<typeof productSchema>;
export type OrderSchemaType = z.infer<typeof orderSchema>;
export type OrderItemSchemaType = z.infer<typeof orderItemSchema>;
export type CollectionSchemaType = z.infer<typeof collectionSchema>;
export type InvoiceSchemaType = z.infer<typeof invoiceSchema>;
export type ReceiveNoteSchemaType = z.infer<typeof receiveNoteSchema>;
export type ReceiveNoteItemSchemaType = z.infer<typeof receiveNoteItemSchema>;
export type NotificationSchemaType = z.infer<typeof notificationSchema>;
