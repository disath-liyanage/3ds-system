import { z } from "zod";

export const userRoleSchema = z.enum(["admin", "manager", "sales_rep", "cashier"]);

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: userRoleSchema,
  full_name: z.string().min(1),
  phone: z.string().min(1),
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
  unit_cost: z.number()
});

export type UserSchemaType = z.infer<typeof userSchema>;
export type CustomerSchemaType = z.infer<typeof customerSchema>;
export type ProductSchemaType = z.infer<typeof productSchema>;
export type OrderSchemaType = z.infer<typeof orderSchema>;
export type OrderItemSchemaType = z.infer<typeof orderItemSchema>;
export type CollectionSchemaType = z.infer<typeof collectionSchema>;
export type InvoiceSchemaType = z.infer<typeof invoiceSchema>;
export type ReceiveNoteSchemaType = z.infer<typeof receiveNoteSchema>;
export type ReceiveNoteItemSchemaType = z.infer<typeof receiveNoteItemSchema>;