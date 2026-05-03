"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { deleteReceiveNote } from "@/app/actions/receive-notes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useProducts } from "@/hooks/useProducts";
import { useReceiveNote } from "@/hooks/useReceiveNote";
import { toast } from "@/lib/toast";

export default function ViewReceiveNotePage() {
  const router = useRouter();
  const params = useParams();
  const receiveNoteId = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const { permissions, isLoading: isPermissionsLoading } = useCurrentUserPermissions();
  const { data: receiveNote, isLoading: isReceiveNoteLoading, isError } = useReceiveNote(receiveNoteId);
  const { data: products } = useProducts();

  const canManageReceiveNotes = permissions?.canManageReceiveNotes ?? false;

  const handleDelete = async () => {
    if (!receiveNoteId) return;
    const confirmed = window.confirm("Delete this GRN? This cannot be undone.");
    if (!confirmed) return;

    const result = await deleteReceiveNote(receiveNoteId);
    if (!result.success) {
      toast({
        title: "Failed to delete GRN",
        description: result.error || "Please try again.",
        variant: "error"
      });
      return;
    }

    toast({ title: "GRN deleted", variant: "success" });
    router.push("/receive-notes");
  };

  if (isPermissionsLoading || isReceiveNoteLoading) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">GRN Details</h1>
        <p className="text-sm text-muted-foreground">Loading GRN...</p>
      </section>
    );
  }

  if (isError || !receiveNote) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">GRN Details</h1>
        <p className="text-sm text-muted-foreground">Unable to find this GRN.</p>
        <Button asChild variant="outline">
          <Link href="/receive-notes">Back to GRNs</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">GRN Details</h1>
          <p className="text-sm text-muted-foreground">View supplier stock received into inventory.</p>
        </div>
        <div className="flex gap-2">
          {canManageReceiveNotes && (
            <>
              <Button asChild variant="default">
                <Link href={`/receive-notes/${receiveNoteId}/edit`}>Edit GRN</Link>
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                Delete GRN
              </Button>
            </>
          )}
          <Button asChild variant="outline">
            <Link href="/receive-notes">Back</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Header Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">GRN Number:</span>
            <span>{receiveNote.rn_number}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Invoice Number:</span>
            <span>{receiveNote.invoice_number}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Supplier:</span>
            <span>{receiveNote.supplier_name}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Date Received:</span>
            <span>{new Date(receiveNote.created_at).toLocaleDateString()}</span>
          </div>
          {receiveNote.notes && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Notes:</span>
              <span>{receiveNote.notes}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Products Added</CardTitle>
        </CardHeader>
        <CardContent>
          {receiveNote.receive_note_items && receiveNote.receive_note_items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Free Qty</TableHead>
                  <TableHead>Unit Cost</TableHead>
                  <TableHead>Selling Price</TableHead>
                  <TableHead>Discount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receiveNote.receive_note_items.map((item) => {
                  const product = products?.find((p) => p.id === item.product_id);
                  const productName = product ? `${product.name} · ${product.unit}` : "Unknown product";

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{productName}</TableCell>
                      <TableCell>{item.qty}</TableCell>
                      <TableCell>{item.free_qty}</TableCell>
                      <TableCell>LKR {item.unit_cost}</TableCell>
                      <TableCell>LKR {item.selling_price}</TableCell>
                      <TableCell>{item.item_discount_percent}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No products found in this GRN.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
