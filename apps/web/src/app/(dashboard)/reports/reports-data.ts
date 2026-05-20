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
      { key: "date-wise-sales-report", title: "Date wise Sales Report" },
      { key: "invoice-wise-sales-report", title: "Invoice wise sales Report" },
      { key: "quotation-sales-report", title: "Quotation sales Report" },
      { key: "route-wise-sales-report", title: "Route wise Sales Report" },
      { key: "return-invoice-report", title: "Return Invoice Report" },
      { key: "delete-invoice-report", title: "Delete invoice Report" },
      { key: "department-wise-sales-invoice", title: "Department wise Sales Invoice" },
      { key: "customer-wise-sales-and-quantity-summary", title: "Customer wise Sales & Quantity Summary" },
      { key: "route-wise-invoice-payment-details", title: "Route wise Invoice Payment Details" },
      { key: "fast-moving-products-report", title: "Fast Moving Products Report" },
      { key: "product-wise-sales-qty-reports", title: "Product wise Sales Quantity Reports" }
    ]
  },
  {
    key: "customer",
    title: "Customer",
    reports: [
      { key: "customer-outstanding-reports", title: "Customer Outstanding reports" },
      { key: "daily-revenue-report", title: "Daily Revenue report" },
      { key: "date-wise-cheque-payment-details", title: "Date wise Cheque Payment Details" },
      { key: "customer-details", title: "Customer Details" },
      { key: "customer-payment-details", title: "Customer Payment Details" },
      { key: "available-credit-invoices", title: "Available Credit Invoices" }
    ]
  },
  {
    key: "stock",
    title: "Stock",
    reports: [
      { key: "product-stock-summary", title: "Product Stock Summary" },
      { key: "return-stock-details", title: "Return Stock Details" }
    ]
  },
  {
    key: "grn",
    title: "GRN",
    reports: [{ key: "goods-received-note-reports", title: "Goods Received Note Reports" }]
  },
  {
    key: "profit",
    title: "Profit",
    reports: [{ key: "profit-summary", title: "Profit Summary" }]
  },
  {
    key: "expenses",
    title: "Expenses",
    reports: [{ key: "expenses-by-user", title: "Expenses by User and Category" }]
  },
  {
    key: "salary",
    title: "Salary",
    reports: [{ key: "salary-slip", title: "Salary Slip" }]
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
