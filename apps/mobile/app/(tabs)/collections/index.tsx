import { Link } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

const collections = [
  { id: "c1", number: 2201, customer: "City Paint Mart", amount: "LKR 30,000" },
  { id: "c2", number: 2202, customer: "Kandy Hardware", amount: "LKR 12,500" }
];

export default function CollectionsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Collections</Text>
        <Link href="/(tabs)/collections/new" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>New</Text>
          </Pressable>
        </Link>
      </View>

      <FlatList
        data={collections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemTitle}>#{item.number}</Text>
            <Text>{item.customer}</Text>
            <Text>{item.amount}</Text>
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
    fontWeight: "700",
    marginBottom: 2
  }
});