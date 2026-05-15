import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { ReportResult } from "@/app/actions/reports";

type ReportPdfTemplateProps = {
  reportTitle: string;
  fromDate: string;
  toDate: string;
  reportDate: string;
  userName: string;
  mode: "detail" | "summary";
  result: ReportResult;
};

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 11, fontFamily: "Times-Roman" },
  companyName: { fontSize: 13, fontWeight: 700, marginBottom: 2 },
  companyAddress: { fontSize: 10, marginBottom: 1 },
  companyContact: { fontSize: 10, marginBottom: 6 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#111827", marginBottom: 8 },
  reportTitle: { fontSize: 15, fontWeight: 700, textAlign: "center", marginBottom: 8 },
  filterHeading: { fontSize: 11, fontWeight: 700, marginBottom: 4 },
  filterRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  filterItem: { width: "48%", fontSize: 10 },
  metaValue: { fontWeight: 700 },
  modeText: { fontSize: 10, marginBottom: 8 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    marginTop: 12,
    paddingVertical: 6
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 5
  },
  tableRowNoBorder: {
    flexDirection: "row",
    paddingVertical: 5
  },
  tableRowWithBorder: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 5
  },
  customerRow: {
    backgroundColor: "#f3f4f6"
  },
  dividerRow: {
    flexDirection: "row",
    paddingVertical: 8
  },
  dividerLine: {
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: "#000000"
  },
  cell: { paddingRight: 8 }
});

export function ReportPdfTemplate({ reportTitle, fromDate, toDate, reportDate, userName, mode, result }: ReportPdfTemplateProps) {
  const isOutstandingLayout =
    result.columns.length === 3 &&
    result.columns[0] === "Customer / Invoice" &&
    result.columns[1] === "Route / Date Issued" &&
    result.columns[2] === "Total Outstanding / Amount";
  const formatPdfDate = (value: unknown) => {
    const raw = String(value ?? "");
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return raw;
    const [, year, month, day] = match;
    return `${year.slice(-2)}/${Number(month)}/${Number(day)}`;
  };

  const getColumnWidth = (column: string) => {
    const columns = result.columns;
    const normalized = column.trim().toLowerCase();
    const hasInvoiceLayout = columns.some((c) => c.toLowerCase() === "invoice no") && columns.some((c) => c.toLowerCase() === "customer");
    if (!hasInvoiceLayout) {
      return `${100 / Math.max(columns.length, 1)}%`;
    }

    if (normalized === "invoice no") return "9%";
    if (normalized === "date") return "8%";
    if (normalized === "customer") return "48%";
    if (normalized === "payment method" || normalized === "p. method") return "11%";
    if (normalized === "status") return "8%";
    if (normalized === "amount") return "10%";
    if (normalized === "route") return "6%";

    return `${100 / Math.max(columns.length, 1)}%`;
  };

  const totalRowConfig = (() => {
    if (mode !== "detail") return null;
    const hasInvoiceWiseLayout =
      result.columns.includes("Invoice No") &&
      result.columns.includes("Amount") &&
      result.columns.includes("P. Method") &&
      result.columns.includes("Status");
    if (hasInvoiceWiseLayout) {
      const total = result.rows.reduce((sum, row) => sum + (Number(row.Amount) || 0), 0);
      return { labelColumn: "Invoice No", amountColumn: "Amount", total };
    }

    const hasReturnInvoiceLayout = result.columns.includes("Return No") && result.columns.includes("Return Amount");
    if (hasReturnInvoiceLayout) {
      const total = result.rows.reduce((sum, row) => sum + (Number(row["Return Amount"]) || 0), 0);
      return { labelColumn: "Return No", amountColumn: "Return Amount", total };
    }

    return null;
  })();

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.companyName}>3D&apos;s Distributors (PVT) ltd.</Text>
        <Text style={styles.companyAddress}>No : 44/1,Tharanga Place, Panagoda, Homagama</Text>
        <Text style={styles.companyContact}>070 321 5756/ 011 208 3773</Text>
        <View style={styles.divider} />

        <Text style={styles.reportTitle}>{reportTitle}</Text>
        <Text style={styles.filterHeading}>Filter Details</Text>
        <View style={styles.filterRow}>
          <Text style={styles.filterItem}>
            From Date : <Text style={styles.metaValue}>{fromDate}</Text>
          </Text>
          <Text style={styles.filterItem}>
            Report Date : <Text style={styles.metaValue}>{reportDate}</Text>
          </Text>
        </View>
        <View style={styles.filterRow}>
          <Text style={styles.filterItem}>
            To Date : <Text style={styles.metaValue}>{toDate}</Text>
          </Text>
          <Text style={styles.filterItem}>
            User : <Text style={styles.metaValue}>{userName}</Text>
          </Text>
        </View>
        <Text style={styles.modeText}>Type: {mode === "detail" ? "Detail" : "Summary"} | Rows: {result.rows.length}</Text>

        <View style={styles.tableHeader}>
          {result.columns.map((column) => (
            <Text key={column} style={{ ...styles.cell, width: getColumnWidth(column) }}>
              {column.trim().toLowerCase() === "invoice no" ? "Invoice" : column}
            </Text>
          ))}
        </View>

        {result.rows.map((row, index) => {
          const rowType = String(row.__rowType || "");
          if (isOutstandingLayout && rowType === "divider") {
            return (
              <View key={`r-${index}`} style={styles.dividerRow}>
                <View style={styles.dividerLine} />
              </View>
            );
          }

          return (
            <View
              key={`r-${index}`}
              style={
                isOutstandingLayout && rowType === "customer"
                  ? [styles.tableRowWithBorder, styles.customerRow]
                  : isOutstandingLayout
                    ? Number(row.__isLastInvoice) === 1
                      ? styles.tableRowNoBorder
                      : styles.tableRowWithBorder
                    : styles.tableRow
              }
            >
              {result.columns.map((column) => {
                const value = row[column];
                const displayValue = column.trim().toLowerCase() === "date" ? formatPdfDate(value) : value;
                return (
                  <Text key={`${index}-${column}`} style={{ ...styles.cell, width: getColumnWidth(column) }}>
                    {typeof displayValue === "number"
                      ? displayValue.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : String(displayValue ?? "")}
                  </Text>
                );
              })}
            </View>
          );
        })}
        {totalRowConfig ? (
          <View style={styles.tableRow}>
            {result.columns.map((column) => (
              <Text key={`total-${column}`} style={{ ...styles.cell, width: getColumnWidth(column) }}>
                {column === totalRowConfig.labelColumn
                  ? "Total"
                  : column === totalRowConfig.amountColumn
                    ? totalRowConfig.total.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : ""}
              </Text>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
