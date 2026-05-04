"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  address: string;
  area: string;
  credit_limit: number;
  balance: number;
  status: string;
};

export function useCustomers() {
  const supabase = createClient();

  return useQuery<CustomerRow[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("name");

      if (error) throw new Error(error.message);

      return (data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        address: row.address,
        area: row.area,
        credit_limit: Number(row.credit_limit),
        balance: Number(row.balance),
        status: row.status
      }));
    }
  });
}
