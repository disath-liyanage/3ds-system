import type { User } from "@paintdist/shared";

type Role = User["role"];

export function canApproveOrders(role: Role): boolean {
  return role === "admin" || role === "manager";
}

export function canValidateCollections(role: Role): boolean {
  return role === "admin" || role === "manager" || role === "cashier";
}

export function canViewReports(role: Role): boolean {
  return role === "admin" || role === "manager";
}

export function canManageProducts(role: Role): boolean {
  return role === "admin" || role === "manager";
}