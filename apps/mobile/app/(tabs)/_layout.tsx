import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#e36824"
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="orders/index" options={{ title: "Orders" }} />
      <Tabs.Screen name="collections/index" options={{ title: "Collections" }} />
      <Tabs.Screen name="customers/index" options={{ title: "Customers" }} />
      <Tabs.Screen name="orders/new" options={{ href: null }} />
      <Tabs.Screen name="collections/new" options={{ href: null }} />
    </Tabs>
  );
}