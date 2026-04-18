import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";

const customers = [
  { id: "u1", name: "City Paint Mart", area: "Colombo" },
  { id: "u2", name: "Northline Traders", area: "Jaffna" },
  { id: "u3", name: "Kandy Hardware", area: "Kandy" }
];

export default function CustomersScreen() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => customers.filter((customer) => customer.name.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Customers</Text>
      <TextInput
        style={styles.input}
        placeholder="Search customers..."
        value={query}
        onChangeText={setQuery}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemTitle}>{item.name}</Text>
            <Text style={styles.area}>{item.area}</Text>
          </View>
        )}
      />
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
    marginBottom: 10,
    color: "#2f241d"
  },
  input: {
    backgroundColor: "#fff",
    borderColor: "#ddcfbf",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12
  },
  item: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e8dccf",
    padding: 12,
    marginBottom: 8
  },
  itemTitle: {
    fontWeight: "700"
  },
  area: {
    color: "#705d4e"
  }
});