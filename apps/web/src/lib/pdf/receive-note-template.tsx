import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { ReceiveNote } from "@paintdist/shared";

export type ReceiveNotePdfItem = {
  description: string;
  qty: number;
  unitCost: number;
};

type ReceiveNoteTemplateProps = {
  receiveNote: ReceiveNote;
  items: ReceiveNotePdfItem[];
  companyName: string;
};

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 11, fontFamily: "Helvetica" },
  title: { fontSize: 18, marginBottom: 8 },
  subTitle: { color: "#666", marginBottom: 2 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#dcdcdc",
    paddingBottom: 6,
    marginTop: 14,
    fontWeight: 700
  },
  tableRow: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  colDesc: { width: "50%" },
  colQty: { width: "20%", textAlign: "right" },
  colCost: { width: "30%", textAlign: "right" }
});

function formatCurrency(amount: number): string {
  return `LKR ${amount.toFixed(2)}`;
}

export function ReceiveNoteTemplate({ receiveNote, items, companyName }: ReceiveNoteTemplateProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{companyName}</Text>
        <Text style={styles.subTitle}>Receive Note #{receiveNote.rn_number}</Text>
        <Text style={styles.subTitle}>Supplier: {receiveNote.supplier_name}</Text>
        <Text style={styles.subTitle}>Date: {new Date(receiveNote.created_at).toLocaleDateString()}</Text>

        <View style={styles.tableHeader}>
          <Text style={styles.colDesc}>Description</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colCost}>Unit Cost</Text>
        </View>

        {items.map((item, index) => (
          <View key={`${item.description}-${index}`} style={styles.tableRow}>
            <Text style={styles.colDesc}>{item.description}</Text>
            <Text style={styles.colQty}>{item.qty}</Text>
            <Text style={styles.colCost}>{formatCurrency(item.unitCost)}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}