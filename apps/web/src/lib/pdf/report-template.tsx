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
  page: { padding: 24, fontSize: 10, fontFamily: "Helvetica" },
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
  cell: { paddingRight: 8 }
});

export function ReportPdfTemplate({ reportTitle, fromDate, toDate, reportDate, userName, mode, result }: ReportPdfTemplateProps) {
  const colWidth = `${100 / Math.max(result.columns.length, 1)}%`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
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
            <Text key={column} style={{ ...styles.cell, width: colWidth }}>
              {column}
            </Text>
          ))}
        </View>

        {result.rows.map((row, index) => (
          <View key={`r-${index}`} style={styles.tableRow}>
            {result.columns.map((column) => {
              const value = row[column];
              return (
                <Text key={`${index}-${column}`} style={{ ...styles.cell, width: colWidth }}>
                  {typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(value ?? "")}
                </Text>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
}
