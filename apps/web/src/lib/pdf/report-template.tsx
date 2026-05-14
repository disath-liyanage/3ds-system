import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { ReportResult } from "@/app/actions/reports";

type ReportPdfTemplateProps = {
  sectionTitle: string;
  reportTitle: string;
  dateRangeLabel: string;
  mode: "detail" | "summary";
  result: ReportResult;
};

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#4b5563", marginBottom: 2 },
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

export function ReportPdfTemplate({ sectionTitle, reportTitle, dateRangeLabel, mode, result }: ReportPdfTemplateProps) {
  const colWidth = `${100 / Math.max(result.columns.length, 1)}%`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{reportTitle}</Text>
        <Text style={styles.subtitle}>Section: {sectionTitle}</Text>
        <Text style={styles.subtitle}>Type: {mode === "detail" ? "Detail" : "Summary"}</Text>
        <Text style={styles.subtitle}>Date Range: {dateRangeLabel}</Text>
        <Text style={styles.subtitle}>Rows: {result.rows.length}</Text>

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
