import type { User, UserRole } from "@paintdist/shared";

export type UserRoleOption = Exclude<UserRole, "admin"> | "admin";

export type UserCustomRoleSummary = {
  id: string;
  name: string;
};

export type AdminUserRow = Pick<User, "id" | "email" | "role" | "full_name" | "phone" | "created_at"> & {
  is_active: boolean;
  custom_role_id: string | null;
  custom_role: UserCustomRoleSummary | null;
};

export type CustomRoleSelectOption = {
  id: string;
  name: string;
};
