import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "@/lib/theme-context";
import { getUnreadNotificationCount, getCachedNotifications, pushCachedNotification, getNotifications, getCachedProfile, type AppNotification } from "@/lib/storage";
import { addWSListener } from "@/lib/websocket";

export default function TabLayout() {
  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";
  const { colors, theme } = useTheme();
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [isCoach, setIsCoach] = useState<boolean>(() => getCachedProfile()?.role === 'coach');
  const wsUnreadRef = useRef(false);
  const pollCountRef = useRef(0);

  const checkUnread = useCallback(async () => {
    try {
      const profile = getCachedProfile();
      if (profile) setIsCoach(profile.role === 'coach');
      if (wsUnreadRef.current) {
        setHasUnreadChat(true);
        return;
      }
      pollCountRef.current += 1;
      if (pollCountRef.current % 3 === 0) {
        const notifs = await getNotifications();
        const hasChat = notifs.some(n => n.type === 'chat' && !n.read);
        setHasUnreadChat(hasChat);
        if (hasChat) wsUnreadRef.current = true;
      } else {
        const cached = getCachedNotifications();
        setHasUnreadChat(cached.some(n => n.type === 'chat' && !n.read));
      }
    } catch {}
  }, []);

  useEffect(() => {
    checkUnread();
    const removeListener = addWSListener((event: any) => {
      if ((event.type === 'new_message' || event.type === 'new_notification') && event.notification) {
        const n = event.notification;
        pushCachedNotification({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          read: false,
          createdAt: n.createdAt || n.created_at,
          programId: n.programId || n.program_id,
          programTitle: n.programTitle || n.program_title,
          exerciseName: n.exerciseName || n.exercise_name,
          fromRole: n.fromRole || n.from_role,
        });
        if (n.type === 'chat') {
          wsUnreadRef.current = true;
          setHasUnreadChat(true);
        }
      }
    });
    const interval = setInterval(checkUnread, 10000);
    return () => { removeListener(); clearInterval(interval); };
  }, [checkUnread]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.tabBar,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={theme === 'dark' ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.tabBar }]} />
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
        listeners={{
          tabPress: () => {
            wsUnreadRef.current = false;
          },
        }}
        options={{
          title: "Chat",
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="chatbubbles" size={size} color={color} />
              {hasUnreadChat && (
                <View style={{
                  position: 'absolute',
                  top: -2,
                  right: -4,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: colors.primary,
                  borderWidth: 1.5,
                  borderColor: colors.tabBar,
                }} />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progress",
          tabBarButton: isCoach ? undefined : () => null,
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
