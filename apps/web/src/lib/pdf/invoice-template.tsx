import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { Invoice } from "@paintdist/shared";

export type InvoicePdfItem = {
  description: string;
  qty: number;
  unitPrice: number;
};

type InvoiceTemplateProps = {
  invoice: Invoice;
  items: InvoicePdfItem[];
  companyName: string;
};

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 11, fontFamily: "Helvetica" },
  header: { marginBottom: 16 },
  title: { fontSize: 18, marginBottom: 6 },
  subTitle: { color: "#666" },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#dcdcdc",
    paddingBottom: 6,
    marginTop: 12,
    fontWeight: 700
  },
  tableRow: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  colDesc: { width: "50%" },
  colQty: { width: "15%", textAlign: "right" },
  colPrice: { width: "15%", textAlign: "right" },
  colTotal: { width: "20%", textAlign: "right" },
  total: { marginTop: 12, textAlign: "right", fontSize: 12, fontWeight: 700 }
});

function formatCurrency(amount: number): string {
  return `LKR ${amount.toFixed(2)}`;
}

export function InvoiceTemplate({ invoice, items, companyName }: InvoiceTemplateProps) {
  const total = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{companyName}</Text>
          <Text style={styles.subTitle}>Invoice #{invoice.invoice_number}</Text>
          <Text style={styles.subTitle}>Status: {invoice.status}</Text>
        </View>

        <View style={styles.row}>
          <Text>Customer ID: {invoice.customer_id}</Text>
          <Text>Date: {new Date(invoice.created_at).toLocaleDateString()}</Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.colDesc}>Description</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colPrice}>Unit Price</Text>
          <Text style={styles.colTotal}>Line Total</Text>
        </View>

        {items.map((item, index) => {
          const lineTotal = item.qty * item.unitPrice;
          return (
            <View key={`${item.description}-${index}`} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.qty}</Text>
              <Text style={styles.colPrice}>{formatCurrency(item.unitPrice)}</Text>
              <Text style={styles.colTotal}>{formatCurrency(lineTotal)}</Text>
            </View>
          );
        })}

        <Text style={styles.total}>Total: {formatCurrency(total)}</Text>
      </Page>
    </Document>
  );
}