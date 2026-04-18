import { StyleSheet, Text, View } from "react-native";

export default function DashboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today's Orders</Text>
        <Text style={styles.cardValue}>0</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today's Collections</Text>
        <Text style={styles.cardValue}>LKR 0.00</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Low Stock</Text>
        <Text style={styles.cardValue}>0</Text>
      </View>
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
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
    color: "#2f241d"
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e8dccf",
    marginBottom: 10
  },
  cardTitle: {
    color: "#5f5348",
    marginBottom: 4
  },
  cardValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f1b18"
  }
});