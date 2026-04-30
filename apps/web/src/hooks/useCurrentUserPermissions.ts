"use client";

import type { CustomRole, User } from "@paintdist/shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { createClient } from "@/lib/supabase/client";

import { usePermissions } from "./usePermissions";

type CurrentUserProfileResult = {
  user: User;
  customRole?: CustomRole;
} | null;

type RawCustomRoleRelation = CustomRole | CustomRole[] | null;

type CurrentUserProfileResponse = {
  user: User;
  customRole?: CustomRole | null;
};

const emptyUser: User = {
  id: "",
  email: "",
  role: "sales_rep",
  full_name: "",
  phone: null,
  created_at: new Date(0).toISOString()
};

export function useCurrentUserPermissions() {
  const supabase = useMemo(() => createClient(), []);

  const query = useQuery<CurrentUserProfileResult>({
    queryKey: ["current-user-profile"],
    queryFn: async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) return null;

      const { data: profile, error } = await supabase
        .from("users_profile")
        .select(
          "id, email, role, full_name, phone, created_at, custom_role_id, is_active, custom_role:custom_roles(id, name, description, created_by, created_at, perm_create_orders, perm_approve_orders, perm_view_all_orders, perm_record_collections, perm_validate_collections, perm_manage_products, perm_manage_customers, perm_create_invoices, perm_manage_receive_notes, perm_view_reports, perm_export_reports, perm_manage_users, perm_view_users)"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (!error && profile) {
        const roleRelation = profile.custom_role as RawCustomRoleRelation;
        const customRole = Array.isArray(roleRelation) ? roleRelation[0] || undefined : roleRelation || undefined;

        return {
          user: {
            id: profile.id,
            email: profile.email,
            role: profile.role,
            full_name: profile.full_name,
            phone: profile.phone,
            custom_role_id: profile.custom_role_id,
            is_active: profile.is_active ?? true,
            created_at: profile.created_at
          },
          customRole
        };
      }

      const fallbackResponse = await fetch("/api/current-user-profile", {
        cache: "no-store"
      });

      if (!fallbackResponse.ok) {
        throw new Error(error?.message || "Could not load current user profile");
      }

      const fallbackData = (await fallbackResponse.json()) as CurrentUserProfileResponse;

      return {
        user: fallbackData.user,
        customRole: fallbackData.customRole ?? undefined
      };
    }
  });

  const permissions = usePermissions(query.data?.user ?? emptyUser, query.data?.customRole);

  return {
    user: query.data?.user ?? null,
    customRole: query.data?.customRole,
    permissions: query.data?.user ? permissions : null,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null
  };
}
