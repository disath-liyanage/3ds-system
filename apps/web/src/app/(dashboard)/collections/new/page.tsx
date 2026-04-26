"use client";

import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";

type NewCollectionForm = {
  customer_id: string;
  amount: number;
  notes: string;
};

export default function NewCollectionPage() {
  const { permissions, isLoading } = useCurrentUserPermissions();
  const { register, handleSubmit } = useForm<NewCollectionForm>();

  const onSubmit = async (values: NewCollectionForm) => {
    console.log("new collection payload", values);
  };

  if (!isLoading && !permissions?.canRecordCollections) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">New Collection</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to record collections.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">New Collection</h1>
        <p className="text-sm text-muted-foreground">Record a collection against a customer account.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Collection Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-1">
              <label className="text-sm font-medium">Customer ID</label>
              <Input placeholder="Customer UUID" {...register("customer_id")} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Amount</label>
              <Input type="number" step="0.01" {...register("amount", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Notes</label>
              <Input placeholder="Payment reference" {...register("notes")} />
            </div>
            <Button type="submit">Save Collection</Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}