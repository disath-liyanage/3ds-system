import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

type ProductLine = {
  product: string;
  qty: string;
};

export default function NewOrderScreen() {
  const [customer, setCustomer] = useState("");
  const [lines, setLines] = useState<ProductLine[]>([{ product: "", qty: "1" }]);

  const addLine = () => setLines((prev) => [...prev, { product: "", qty: "1" }]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>New Order</Text>

      <Text style={styles.label}>Customer</Text>
      <TextInput style={styles.input} placeholder="Customer ID" value={customer} onChangeText={setCustomer} />

      <Text style={styles.label}>Products</Text>
      {lines.map((line, index) => (
        <View key={`line-${index}`} style={styles.lineRow}>
          <TextInput
            style={[styles.input, styles.lineInput]}
            placeholder="Product"
            value={line.product}
            onChangeText={(text) => {
              const next = [...lines];
              next[index].product = text;
              setLines(next);
            }}
          />
          <TextInput
            style={[styles.input, styles.qtyInput]}
            placeholder="Qty"
            keyboardType="numeric"
            value={line.qty}
            onChangeText={(text) => {
              const next = [...lines];
              next[index].qty = text;
              setLines(next);
            }}
          />
        </View>
      ))}

      <Pressable style={[styles.button, styles.secondaryButton]} onPress={addLine}>
        <Text style={styles.secondaryButtonText}>Add Product</Text>
      </Pressable>

      <Pressable style={styles.button}>
        <Text style={styles.buttonText}>Save Order</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#f8f4ec",
    flexGrow: 1
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
    color: "#2f241d"
  },
  label: {
    fontWeight: "600",
    marginBottom: 6,
    color: "#4b4036"
  },
  lineRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8
  },
  lineInput: {
    flex: 1
  },
  qtyInput: {
    width: 90
  },
  input: {
    backgroundColor: "#fff",
    borderColor: "#ddcfbf",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12
  },
  button: {
    backgroundColor: "#e36824",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 6
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600"
  },
  secondaryButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e36824"
  },
  secondaryButtonText: {
    color: "#e36824",
    fontWeight: "600"
  }
});