import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

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
  page: { padding: 20, fontSize: 11, fontFamily: "Times-Roman" },
  topWrap: { marginBottom: 10, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  logo: { width: 170, height: 70, objectFit: "contain" },
  invoiceText: { width: 110, height: 32, objectFit: "contain", marginBottom: 3 },
  rightTop: { width: "38%" },
  infoText: { fontSize: 12, marginBottom: 5, fontWeight: 700 },
  details: { flexDirection: "row", marginBottom: 8, gap: 8 },
  col: { width: "50%" },
  boxedCol: { borderWidth: 1, borderColor: "#000", padding: 8 },
  field: { marginBottom: 3 },
  tableHeader: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    borderTopColor: "#000",
    borderLeftColor: "#000",
    borderRightColor: "#000",
    paddingVertical: 6,
    marginTop: 8,
    fontWeight: 700
  },
  tableRow: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#000", borderLeftWidth: 1, borderRightWidth: 1, borderLeftColor: "#000", borderRightColor: "#000" },
  colDesc: { width: "34%" },
  colQty: { width: "10%", textAlign: "right" },
  colFQty: { width: "10%", textAlign: "right" },
  colPrice: { width: "16%", textAlign: "right" },
  colDisc: { width: "14%", textAlign: "left" },
  colTotal: { width: "16%", textAlign: "right" },
  vBorder: { borderRightWidth: 1, borderRightColor: "#000", paddingRight: 6 },
  discBox: { borderLeftWidth: 1, borderLeftColor: "#000", borderRightWidth: 1, borderRightColor: "#000", paddingHorizontal: 6 },
  totalsRow: { flexDirection: "row", borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#000" },
  totalsLeft: { width: "70%", padding: 6 },
  totalsLabel: { width: "14%", borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#000", padding: 6, textAlign: "left" },
  totalsAmount: { width: "16%", padding: 6, textAlign: "right" },
  note: { fontSize: 10, lineHeight: 1.3 },
  signRow: { flexDirection: "row", marginTop: 26, gap: 16 },
  signCol: { width: "50%" },
  signLine: { borderTopWidth: 1, borderTopColor: "#000", borderTopStyle: "dotted", marginTop: 26 },
  goodsText: { textAlign: "right", fontStyle: "italic", fontWeight: 700 }
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
          <Image src="/images/receipt-logo.svg" style={styles.logo} />
          <Image src="/images/invoice-text.svg" style={styles.invoiceText} />
          <View style={styles.rightTop}>
            <Text style={styles.infoText}>No 44/1, Tharanga Place, Panagoda, Homagama</Text>
            <Text style={styles.infoText}>077 530 3215 / 011 208 3773</Text>
            <Text style={styles.infoText}>sanulapaintshub@gmail.com</Text>
          </View>
        </View>

        <View style={styles.details}>
          <View style={[styles.col, styles.boxedCol]}>
            <Text style={styles.field}>Customer Code: {invoice.customer_id}</Text>
            <Text style={styles.field}>Customer Name: {companyName}</Text>
          </View>
          <View style={[styles.col, styles.boxedCol]}>
            <Text style={styles.field}>Invoice Number: {invoice.invoice_number}</Text>
            <Text style={styles.field}>Invoiced By: {String((invoice as { issued_by?: string }).issued_by || "-")}</Text>
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
              <Text style={[styles.colDesc, styles.vBorder]}>{item.description}</Text>
              <Text style={[styles.colQty, styles.vBorder]}>{item.qty}</Text>
              <Text style={[styles.colFQty, styles.vBorder]}>0</Text>
              <Text style={[styles.colPrice, styles.vBorder]}>{formatCurrency(item.unitPrice)}</Text>
              <Text style={[styles.colDisc, styles.discBox]}>0.00</Text>
              <Text style={styles.colTotal}>{formatCurrency(lineTotal)}</Text>
            </View>
          );
        })}

        <View style={styles.totalsRow}>
          <View style={styles.totalsLeft}>
            {(invoice as { payment_method?: string }).payment_method === "credit" ? (
              <Text style={styles.note}>
                Cheques to be written in favor of : SANULA PAINTS HUB (PVT)LTD & CROSSED as A/C PAYEE ONLY
              </Text>
            ) : null}
          </View>
          <Text style={styles.totalsLabel}>Total Amount</Text>
          <Text style={styles.totalsAmount}>{formatCurrency(total)}</Text>
        </View>
        <View style={styles.totalsRow}>
          <View style={styles.totalsLeft} />
          <Text style={styles.totalsLabel}>Total Dis Amount</Text>
          <Text style={styles.totalsAmount}>{formatCurrency(0)}</Text>
        </View>
        <View style={styles.totalsRow}>
          <View style={styles.totalsLeft} />
          <Text style={[styles.totalsLabel, { fontSize: 12, fontWeight: 700 }]}>Net Amount</Text>
          <Text style={[styles.totalsAmount, { fontSize: 12, fontWeight: 700 }]}>{formatCurrency(total)}</Text>
        </View>

        <View style={styles.signRow}>
          <View style={styles.signCol}>
            <View style={styles.signLine} />
          </View>
          <View style={styles.signCol}>
            <Text style={styles.goodsText}>Goods received in good condition & correct qty.</Text>
            <View style={styles.signLine} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
