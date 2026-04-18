"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [status, setStatus] = useState("reviewing");

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Order Detail</h1>
        <p className="text-sm text-muted-foreground">Order ID: {params.id}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Approval Workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Current status: <Badge variant="warning">{status}</Badge>
          </p>
          <div className="flex gap-3">
            <Button onClick={() => setStatus("approved")}>Approve</Button>
            <Button variant="danger" onClick={() => setStatus("rejected")}>
              Reject
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}