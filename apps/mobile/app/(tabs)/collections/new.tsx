import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function NewCollectionScreen() {
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Record Collection</Text>

      <Text style={styles.label}>Customer ID</Text>
      <TextInput style={styles.input} placeholder="Customer ID" value={customer} onChangeText={setCustomer} />

      <Text style={styles.label}>Amount</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder="Amount"
        value={amount}
        onChangeText={setAmount}
      />

      <Pressable style={styles.button}>
        <Text style={styles.buttonText}>Save Collection</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f8f4ec"
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
    alignItems: "center"
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600"
  }
});