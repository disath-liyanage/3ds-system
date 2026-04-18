import { Link } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

const orders = [
  { id: "o1", orderNumber: 1001, customer: "City Paint Mart", status: "pending" },
  { id: "o2", orderNumber: 1002, customer: "Northline Traders", status: "approved" }
];

export default function OrdersScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <Link href="/(tabs)/orders/new" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>New Order</Text>
          </Pressable>
        </Link>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemTitle}>#{item.orderNumber}</Text>
            <Text>{item.customer}</Text>
            <Text style={styles.status}>{item.status}</Text>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2f241d"
  },
  button: {
    backgroundColor: "#e36824",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600"
  },
  item: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e8dccf",
    marginBottom: 8
  },
  itemTitle: {
    fontWeight: "700"
  },
  status: {
    marginTop: 4,
    color: "#7a6859"
  }
});