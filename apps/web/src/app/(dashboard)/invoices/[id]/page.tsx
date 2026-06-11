"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import { Printer } from "lucide-react";
import { Pencil } from "lucide-react";
import { Trash2 } from "lucide-react";

import { approveInvoice, deleteInvoice, rejectInvoice } from "@/app/actions/invoices";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserPermissions } from "@/hooks/useCurrentUserPermissions";
import { useInvoice } from "@/hooks/useInvoice";
import { toast } from "@/lib/toast";
import { PageHeader } from "@/components/page-header";

export default function InvoiceDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const shouldPrint = searchParams.get("print") === "true";
  const invoiceId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { permissions, user, isLoading: isPermissionsLoading } = useCurrentUserPermissions();
  const { data: invoice, isLoading: isInvoiceLoading, isError } = useInvoice(invoiceId);

  const [isReviewing, setIsReviewing] = useState(false);

  useEffect(() => {
    if (shouldPrint && invoice && !isInvoiceLoading && !isError) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [shouldPrint, invoice, isInvoiceLoading, isError]);

  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  const handleDelete = async () => {
    if (!invoiceId) return;
    const confirmed = window.confirm("Delete this invoice? This will restore product stock and customer balance. This cannot be undone.");
    if (!confirmed) return;

    const result = await deleteInvoice(invoiceId);
    if (!result.success) {
      toast({
        title: "Failed to delete invoice",
        description: result.error || "Please try again.",
        variant: "error"
      });
      return;
    }

    toast({ title: "Invoice deleted", variant: "success" });
    router.push("/invoices");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleApprove = async () => {
    if (!invoiceId) return;
    setIsReviewing(true);
    const result = await approveInvoice(invoiceId);
    setIsReviewing(false);

    if (!result.success) {
      toast({ title: "Approval failed", description: result.error, variant: "error" });
      return;
    }

    toast({ title: "Invoice approved", description: result.message, variant: "success" });
    router.refresh();
  };

  const handleReject = async () => {
    if (!invoiceId) return;
    const confirmed = window.confirm("Reject this invoice request?");
    if (!confirmed) return;

    setIsReviewing(true);
    const result = await rejectInvoice(invoiceId);
    setIsReviewing(false);

    if (!result.success) {
      toast({ title: "Rejection failed", description: result.error, variant: "error" });
      return;
    }

    toast({ title: "Invoice rejected", description: result.message, variant: "success" });
    router.refresh();
  };

  const getDiscountPerUnit = (unitPrice: number, discountType: "percent" | "amount", discountValue: number) => {
    if (!discountValue) return 0;
    if (discountType === "percent") return (unitPrice * discountValue) / 100;
    return discountValue;
  };

  if (isPermissionsLoading || isInvoiceLoading) {
    return (
      <section className="space-y-4">
        <PageHeader title="Invoice Details" description="Loading invoice..." />
      </section>
    );
  }

  if (isError || !invoice) {
    return (
      <section className="space-y-4">
        <PageHeader title="Invoice Details" description="Unable to find this invoice." />
      </section>
    );
  }

  const isQuotation = invoice.invoice_kind === "quotation";
  const documentLabel = isQuotation ? "Quotation" : "Invoice";
  const documentNumber = isQuotation ? `Q${invoice.quotation_number ?? invoice.invoice_number}` : String(invoice.invoice_number);
  const createdDate = new Date(invoice.created_at);
  const formatAmount = (amount: number) => `LKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  const buildCustomerCode = (rawId?: string) => {
    if (!rawId) return "C001";
    const digits = rawId.replace(/\D/g, "");
    if (!digits) return "C001";
    const num = (Number(digits.slice(-6)) % 999) + 1;
    return `C${String(num).padStart(3, "0")}`;
  };
  const totalDiscountAmount = invoice.items.reduce((sum, item) => {
    const discountPerUnit = getDiscountPerUnit(item.unit_price, item.discount_type, item.discount_value);
    return sum + (Number(item.qty) || 0) * discountPerUnit;
  }, 0);
  const netAmount = Math.max(0, Number(invoice.total_amount) - totalDiscountAmount);
  const paymentTermsText = invoice.payment_method === "credit" ? <strong>14 Days Credit Only</strong> : <strong>Cash on Delivery Only</strong>;
  const salesRepDisplayName = invoice.sales_rep_name?.trim().split(/\s+/)[0] || "Unassigned";
  const outstandingRows = invoice.outstanding_invoices ?? [];
  const totalOutstandingAmount = outstandingRows.reduce((sum, row) => sum + (Number(row.due_amount) || 0), 0);

  return (
    <section className="space-y-6">
      <PageHeader
        className="print:hidden"
        title={`${documentLabel} #${documentNumber}`}
        description={`View and print ${documentLabel.toLowerCase()} details.`}
        actions={
          <>
            {invoice.status !== "paid" ? (
              <Button asChild variant="outline">
                <Link
                  href={
                    invoice.status === "draft"
                      ? `/invoices/new?draftId=${invoice.id}`
                      : `/invoices/new?editId=${invoice.id}`
                  }
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {isQuotation ? "Edit" : "Edit"}
                </Link>
              </Button>
            ) : null}
            <Button variant="default" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              {isQuotation ? "Print Quotation" : "Print Invoice"}
              </Button>
            {isAdminOrManager && (
              <Button variant="danger" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </>
        }
      />

      {/* Printable Area */}
      <div className="print-area invoice-print bg-white p-8 rounded-lg shadow-sm border print:shadow-none print:border-none print:p-0">
        <div className="invoice-print-header relative mb-4 flex items-center justify-between gap-6 overflow-visible">
          <div className="invoice-print-logo-wrap min-w-0 flex-1 overflow-visible pr-4">
            <img
              src="/images/receipt-logo.svg"
              alt="Receipt logo"
              className="invoice-print-logo block h-32 w-auto max-w-[340px] shrink-0 object-contain object-left"
            />
          </div>
          <div className="invoice-print-title pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center px-4">
            <img src="/images/invoice-text.svg" alt="Invoice text" className="h-10 w-auto object-contain" />
          </div>
          <div className="invoice-print-contact ml-auto w-[320px] max-w-[320px] shrink-0 self-center pl-2 text-[15px] font-bold leading-[1] space-y-1 translate-x-20">
            <div className="flex items-start gap-1.5 leading-[1]">
              <MapPin className="h-[18px] w-[18px] mt-[1px] shrink-0" />
              <span>
                No 44/1, Tharanga Place
                <br />
                Panagoda, Homagama
              </span>
            </div>
            <div className="flex items-center gap-1.5 leading-[1.25]"><Phone className="h-[18px] w-[18px] shrink-0" /><span className="block leading-[1.25]">077 530 3215 / 011 208 3773</span></div>
            <div className="flex items-center gap-1.5 leading-[1.25]"><Mail className="h-[18px] w-[18px] shrink-0" /><span className="block leading-[1.25]">sanulapaintshub@gmail.com</span></div>
          </div>
        </div>

        <div className="invoice-details-grid grid grid-cols-[1.2fr_0.8fr] gap-4 text-sm mb-4">
          <div className="space-y-1 border border-black px-2 py-0.5 leading-[1.1]">
            <div className="grid grid-cols-[137px_10px_auto]">
              <span className="font-semibold">Customer Code</span>
              <span>:</span>
              <span>{buildCustomerCode(invoice.customer_code || invoice.customer_id)}</span>
            </div>
            <div className="grid grid-cols-[137px_10px_auto]">
              <span className="font-semibold">Customer Name</span>
              <span>:</span>
              <span>{invoice.customer_name}</span>
            </div>
            <div className="grid grid-cols-[137px_10px_auto]">
              <span className="font-semibold">Customer Address</span>
              <span>:</span>
              <span>{invoice.customer_address || "-"}</span>
            </div>
            <div className="grid grid-cols-[137px_10px_auto]">
              <span className="font-semibold">Customer Contact No</span>
              <span>:</span>
              <span>{invoice.customer_phone || "-"}</span>
            </div>
            <div className="grid grid-cols-[137px_10px_auto]">
              <span className="font-semibold">Total Outstanding</span>
              <span>:</span>
              <span>{formatAmount(totalOutstandingAmount)}</span>
            </div>
          </div>
          <div className="space-y-1 border border-black px-2 py-0.5 leading-[1.1]">
            <div className="grid grid-cols-[102px_10px_auto]">
              <span className="font-semibold">Invoice Number</span>
              <span>:</span>
              <span>{documentNumber}</span>
            </div>
            <div className="grid grid-cols-[102px_10px_auto]">
              <span className="font-semibold">Invoice Date</span>
              <span>:</span>

              <span>
                {createdDate.toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                })}

                <span className="ml-6 font-semibold">Time :</span>

                {" "}

                {createdDate.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </span>
            </div>
            <div className="grid grid-cols-[102px_10px_auto]">
              <span className="font-semibold">Sales Person</span>
              <span>:</span>
              <span className="whitespace-nowrap">
                {salesRepDisplayName}
                {invoice.sales_rep_phone ? <span className="ml-9">{invoice.sales_rep_phone}</span> : null}
              </span>
            </div>
            <div className="grid grid-cols-[102px_10px_auto]">
              <span className="font-semibold">Invoice Root</span>
              <span>:</span>
              <span>{invoice.customer_route || "-"}</span>
            </div>
            <div className="grid grid-cols-[102px_10px_auto]">
              <span className="font-semibold">Invoiced By</span>
              <span>:</span>
              <span>{invoice.issued_by_name}</span>
            </div>
          </div>
        </div>

        <Table className="invoice-products-table border border-black" containerClassName="rounded-none border-0 bg-transparent">
          <TableHeader>
            <TableRow className="border-black border-b">
              <TableHead className="!py-0 text-center bg-transparent border-r border-black">Product</TableHead>
              <TableHead className="!py-0 text-center bg-transparent border-r border-black">Qty</TableHead>
              <TableHead className="!py-0 text-center bg-transparent border-r border-black">F QTY</TableHead>
              <TableHead className="!py-0 text-center bg-transparent border-r border-black">U Price</TableHead>
              <TableHead className="!py-0 text-center bg-transparent border-r border-l border-black">DSCNT</TableHead>
              <TableHead className="!py-0 text-center bg-transparent">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.items.map((item, idx) => {
              const discountPerUnit = getDiscountPerUnit(item.unit_price, item.discount_type, item.discount_value);
              const effectiveUnitPrice = Math.max(0, item.unit_price - discountPerUnit);
              const firstRowTopBorder = idx === 0 ? "border-t border-black" : "";

              return (
                <TableRow key={item.id} className="border-b border-black">
                  <TableCell className={`!py-0 font-medium border-r border-black border-b border-black ${firstRowTopBorder}`}>
                    {item.product_name} <span className="text-muted-foreground text-xs">({item.product_unit})</span>
                  </TableCell>
                  <TableCell className={`!py-0 text-right border-r border-black border-b border-black ${firstRowTopBorder}`}>{item.qty}</TableCell>
                  <TableCell className={`!py-0 text-right border-r border-black border-b border-black ${firstRowTopBorder}`}>{item.free_qty || 0}</TableCell>
                  <TableCell className={`!py-0 text-right border-r border-black border-b border-black ${firstRowTopBorder}`}>
                    {formatAmount(item.unit_price)}
                  </TableCell>
                  <TableCell className={`!py-0 text-right border-r border-l border-black border-b border-black ${firstRowTopBorder}`}>
                    {item.discount_type === "percent"
                      ? `${item.discount_value}%`
                      : formatAmount(Number(item.discount_value) || 0)}
                  </TableCell>
                  <TableCell className={`!py-0 text-right font-medium border-b border-black ${firstRowTopBorder}`}>
                    {formatAmount(item.qty * effectiveUnitPrice)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="mt-1 mb-2 text-sm">{paymentTermsText}</div>
        
        <div className="invoice-totals-box mb-4 -mt-[33px] ml-auto w-[42%] border border-black">
          <div className="grid grid-cols-[1fr_auto]">
            <div className="px-3 py-0 font-semibold">Total Amount</div>
            <div className="px-3 py-0 text-right font-semibold">{formatAmount(invoice.total_amount)}</div>
          </div>
          <div className="grid grid-cols-[1fr_auto]">
            <div className="px-3 py-0 font-semibold">Total Dis Amount</div>
            <div className="px-3 py-0 text-right font-semibold">{formatAmount(totalDiscountAmount)}</div>
          </div>
          <div className="grid grid-cols-[1fr_auto]">
            <div className="px-3 py-0 font-bold text-[15px]">Net Amount</div>
            <div className="px-3 py-0 text-right font-bold text-[15px]">{formatAmount(netAmount)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10 text-sm mb-3 mt-6">
          <div />
          <div className="pl-20">
            <p className="italic font-bold">Goods received in good condition &amp; correct qty.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-10 text-sm mb-6 mt-10">
          <div>
            <svg className="w-full h-4" aria-hidden="true">
              <line x1="25%" y1="2" x2="75%" y2="2" stroke="black" strokeWidth="1" strokeDasharray="2 4" />
            </svg>
          </div>
          <div>
            <svg className="w-full h-4" aria-hidden="true">
              <line x1="20%" y1="2" x2="90%" y2="2" stroke="black" strokeWidth="1" strokeDasharray="2 4" />
            </svg>
          </div>
        </div>

        {outstandingRows.length > 0 ? (
          <div className="mt-4">
            <h3 className="font-semibold text-sm mb-2">Customer Available Credit Invoice List</h3>
            <Table className="invoice-credit-table border border-black" containerClassName="rounded-none border-0 bg-transparent">
              <TableHeader>
                <TableRow className="border-black border-b">
                  <TableHead className="!py-0 text-center bg-transparent border-r border-black">Invoice Date</TableHead>
                  <TableHead className="!py-0 text-center bg-transparent border-r border-black">Invoice No</TableHead>
                  <TableHead className="!py-0 text-center bg-transparent border-r border-black">Net Amount</TableHead>
                  <TableHead className="!py-0 text-center bg-transparent border-r border-black">Credit Amount</TableHead>
                  <TableHead className="!py-0 text-center bg-transparent border-r border-black">Settled Amount</TableHead>
                  <TableHead className="!py-0 text-center bg-transparent">Due Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outstandingRows.map((row, idx) => (
                  <TableRow key={row.id} className={`border-b border-black ${idx === 0 ? "border-t border-black" : ""}`}>
                    <TableCell className={`!py-0 border-r border-black border-b border-black ${idx === 0 ? "border-t border-black" : ""}`}>{new Date(row.created_at).toLocaleDateString("en-GB")}</TableCell>
                    <TableCell className={`!py-0 border-r border-black border-b border-black ${idx === 0 ? "border-t border-black" : ""}`}>
                      <Link href={`/invoices/${row.id}`} className="hover:underline">
                        {row.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell className={`!py-0 text-right border-r border-black border-b border-black ${idx === 0 ? "border-t border-black" : ""}`}>{formatAmount(row.net_amount)}</TableCell>
                    <TableCell className={`!py-0 text-right border-r border-black border-b border-black ${idx === 0 ? "border-t border-black" : ""}`}>{formatAmount(row.credit_amount)}</TableCell>
                    <TableCell className={`!py-0 text-right border-r border-black border-b border-black ${idx === 0 ? "border-t border-black" : ""}`}>{formatAmount(row.settled_amount)}</TableCell>
                    <TableCell className={`!py-0 text-right font-semibold border-b border-black ${idx === 0 ? "border-t border-black" : ""}`}>{formatAmount(row.due_amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
        <style jsx global>{`
          @media print {
            @page {
              size: Letter;
              margin: 6mm;
            }
            html,
            body {
              width: 216mm;
              min-height: 279mm;
            }
            body * {
              visibility: hidden;
            }
            .print-area,
            .print-area * {
              visibility: visible;
            }
            .print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0 !important;
              padding: 0 !important;
              transform: none !important;
            }
            .invoice-print {
              font-family: "Times New Roman", Times, serif !important;
              font-size: 12px !important;
            }
            .invoice-print-header,
            .invoice-print-header * {
              overflow: visible !important;
            }
            .invoice-print-header {
              break-inside: avoid;
              page-break-inside: avoid;
              display: flex !important;
              align-items: center !important;
              justify-content: space-between !important;
              gap: 1rem !important;
              position: relative !important;
            }
            .invoice-print-header > * {
              min-width: 0;
              overflow: visible !important;
            }
            .invoice-print-logo-wrap {
              overflow: visible !important;
              flex: 1 1 auto !important;
              min-width: 0 !important;
              max-width: 56% !important;
              padding-right: 0.75rem !important;
            }
            .invoice-print-logo {
              display: block !important;
              max-width: 100% !important;
              width: auto !important;
              height: 6.9rem !important;
              object-fit: contain !important;
              object-position: left center !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .invoice-print-title {
              position: absolute !important;
              left: 50% !important;
              top: 50% !important;
              transform: translate(-50%, -50%) !important;
              z-index: 2 !important;
            }
            .invoice-print-contact {
              margin-left: auto !important;
              width: 320px !important;
              flex: 0 0 320px !important;
              max-width: 320px !important;
              line-height: 1 !important;
              text-align: left !important;
              transform: translateX(20mm) !important;
            }
            .invoice-totals-box {
              margin-right: 2px !important;
            }
            .invoice-credit-table {
              width: calc(100% - 2px) !important;
            }
            .invoice-details-grid,
            .invoice-products-table {
              width: calc(100% - 2px) !important;
            }
          }
        `}</style>
      </div>

      {isAdminOrManager && invoice.status === "pending_approval" ? (
        <div className="flex justify-end gap-2 print:hidden">
          <Button onClick={handleApprove} disabled={isReviewing}>
            Accept
          </Button>
          <Button variant="danger" onClick={handleReject} disabled={isReviewing}>
            Reject
          </Button>
        </div>
      ) : null}

    </section>
  );
}
