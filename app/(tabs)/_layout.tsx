import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect, useCallback } from "react";
import Colors from "@/constants/colors";
import { getUnreadNotificationCount, getCachedNotifications } from "@/lib/storage";

export default function TabLayout() {
  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";
  const [hasUnreadChat, setHasUnreadChat] = useState(false);

  const checkUnread = useCallback(async () => {
    try {
      const cached = getCachedNotifications();
      const notifs = cached.length > 0 ? cached : [];
      setHasUnreadChat(notifs.some(n => n.type === 'chat' && !n.read));
    } catch {}
  }, []);

  useEffect(() => {
    checkUnread();
    const interval = setInterval(checkUnread, 10000);
    return () => clearInterval(interval);
  }, [checkUnread]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.colors.primary,
        tabBarInactiveTintColor: Colors.colors.textMuted,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : Colors.colors.tabBar,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: Colors.colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.colors.tabBar }]} />
          ) : null,
        tabBarLabelStyle: {
          fontFamily: "Rubik_500Medium",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="programs"
        options={{
          title: "Programs",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="barbell" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="chatbubbles" size={size} color={color} />
              {hasUnreadChat && (
                <View style={styles.chatBadge} />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progress",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  chatBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.colors.primary,
    borderWidth: 1.5,
    borderColor: Colors.colors.tabBar,
  },
});
