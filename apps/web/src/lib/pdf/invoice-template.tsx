import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { Invoice } from "@paintdist/shared";
import { formatDate } from "@/lib/utils";

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
  page: { padding: 20, fontSize: 11, fontFamily: "Times-Roman" },
  topWrap: { borderWidth: 1, borderColor: "#000", marginBottom: 8, flexDirection: "row" },
  leftTop: { width: "60%", borderRightWidth: 1, borderRightColor: "#000", padding: 8 },
  rightTop: { width: "40%", padding: 8 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { width: 100, height: 40, objectFit: "contain" },
  invoiceText: { width: 90, height: 20, objectFit: "contain" },
  infoText: { fontSize: 10, marginBottom: 4 },
  details: { flexDirection: "row", marginBottom: 8 },
  col: { width: "50%" },
  field: { marginBottom: 3 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    paddingBottom: 6,
    marginTop: 12,
    fontWeight: 700
  },
  tableRow: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#e5e5e5" },
  colDesc: { width: "34%" },
  colQty: { width: "10%", textAlign: "right" },
  colFQty: { width: "10%", textAlign: "right" },
  colPrice: { width: "16%", textAlign: "right" },
  colDisc: { width: "14%", textAlign: "right" },
  colTotal: { width: "16%", textAlign: "right" },
  creditNote: { marginTop: 10, fontSize: 10 }
});

function formatCurrency(amount: number): string {
  return `LKR ${amount.toFixed(2)}`;
}

export function InvoiceTemplate({ invoice, items, companyName }: InvoiceTemplateProps) {
  const total = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.topWrap}>
          <View style={styles.leftTop}>
            <View style={styles.topRow}>
              <Image src="/images/receipt-logo.svg" style={styles.logo} />
              <Image src="/images/invoice-text.svg" style={styles.invoiceText} />
            </View>
          </View>
          <View style={styles.rightTop}>
            <Text style={styles.infoText}>No 44/1, Tharanga Place, Panagoda, Homagama</Text>
            <Text style={styles.infoText}>077 530 3215 / 011 208 3773</Text>
            <Text style={styles.infoText}>sanulapaintshub@gmail.com</Text>
          </View>
        </View>

        <View style={styles.details}>
          <View style={styles.col}>
            <Text style={styles.field}>Customer Code: {invoice.customer_id}</Text>
            <Text style={styles.field}>Customer Name: {companyName}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.field}>Invoice Number: {invoice.invoice_number}</Text>
            <Text style={styles.field}>Invoice Date: {formatDate(invoice.created_at)}</Text>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.colDesc}>Product</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colFQty}>FQTY</Text>
          <Text style={styles.colPrice}>U Price</Text>
          <Text style={styles.colDisc}>DSCNT</Text>
          <Text style={styles.colTotal}>Amount</Text>
        </View>

        {items.map((item, index) => {
          const lineTotal = item.qty * item.unitPrice;
          return (
            <View key={`${item.description}-${index}`} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.qty}</Text>
              <Text style={styles.colFQty}>0</Text>
              <Text style={styles.colPrice}>{formatCurrency(item.unitPrice)}</Text>
              <Text style={styles.colDisc}>0.00</Text>
              <Text style={styles.colTotal}>{formatCurrency(lineTotal)}</Text>
            </View>
          );
        })}

        <View style={styles.tableRow}>
          <Text style={[styles.colDesc, { width: "84%", textAlign: "right" }]}>Total Amount</Text>
          <Text style={styles.colTotal}>{formatCurrency(total)}</Text>
        </View>
        {(invoice as { payment_method?: string }).payment_method === "credit" ? (
          <Text style={styles.creditNote}>
            Cheques to be written infavor of : SANULA PAINTS HUB (PVT)LTD & CROSSED as A/C PAYEE ONLY
          </Text>
        ) : null}
      </Page>
    </Document>
  );
}
