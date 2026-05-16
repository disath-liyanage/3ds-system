export type ReportItem = {
  key: string;
  title: string;
};

export type ReportSection = {
  key: string;
  title: string;
  reports: ReportItem[];
};

export const REPORT_SECTIONS: ReportSection[] = [
  {
    key: "sales",
    title: "Sales",
    reports: [
      { key: "date-wise-sales-report", title: "Date wise Sales report" },
      { key: "invoice-wise-sales-report", title: "Invoice wise sales report" },
      { key: "route-wise-sales-report", title: "Route wise Sales report" },
      { key: "return-invoice-report", title: "Return Invoice report" },
      { key: "delete-invoice-report", title: "Delete invoice report" },
      { key: "department-wise-sales-invoice", title: "Department wise sales invoice" },
      { key: "customer-wise-sales-and-quantity-summary", title: "Customer wise sales and quantity summary" },
      { key: "route-wise-invoice-payment-details", title: "Route wise invoice payment details" },
      { key: "fast-moving-products-report", title: "Fast moving products report" },
      { key: "product-wise-sales-qty-reports", title: "Product wise sales qty reports" }
    ]
  },
  {
    key: "customer",
    title: "Customer",
    reports: [
      { key: "customer-outstanding-reports", title: "Customer outstanding reports" },
      { key: "daily-revenue-report", title: "Daily revenue report" },
      { key: "date-wise-cheque-payment-details", title: "Date Wise Cheque Payment Details" },
      { key: "customer-details", title: "Customer Details" }
    ]
  },
  {
    key: "stock",
    title: "Stock",
    reports: [
      { key: "product-stock-summary", title: "Product Stock Summary" },
      { key: "categorization-wise-stock-reports", title: "Categorization Wise Stock Reports" },
      { key: "return-stock-details", title: "Return Stock Details" }
    ]
  },
  {
    key: "grn",
    title: "GRN",
    reports: [{ key: "goods-received-note-reports", title: "Goods Received Note Reports" }]
  }
];

export function getReportSection(sectionKey: string) {
  return REPORT_SECTIONS.find((section) => section.key === sectionKey);
}

export function getReportItem(sectionKey: string, reportKey: string) {
  const section = getReportSection(sectionKey);
  if (!section) return null;
  return section.reports.find((report) => report.key === reportKey) ?? null;
}
