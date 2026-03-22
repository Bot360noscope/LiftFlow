import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ActivityIndicator, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider, useTheme } from "@/lib/theme-context";
import { loadCacheFromDisk, getCachedProfile } from "@/lib/storage";
import { connectWebSocket, disconnectWebSocket } from "@/lib/websocket";
import { registerForPushNotifications, setupNotificationResponseHandler } from "@/lib/push-notifications";
import { router } from "expo-router";
import AuthScreen from "./auth";
import OnboardingScreen from "./onboarding";
import Colors from "@/constants/colors";
import OfflineBanner from "@/components/OfflineBanner";
import UploadBanner from "@/components/UploadBanner";
import { UploadProvider } from "@/lib/upload-context";
import {
  useFonts,
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
} from "@expo-google-fonts/rubik";

SplashScreen.preventAutoHideAsync();

function ThemedStatusBar() {
  return <StatusBar style="light" />;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back", headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="program/[id]" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="add-pr" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="create-program" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="join-coach" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="client/[id]" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="conversation" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="record-video" options={{ headerShown: false, presentation: "fullScreenModal", gestureEnabled: false }} />
      <Stack.Screen name="trim-video" options={{ headerShown: false, presentation: "fullScreenModal", gestureEnabled: false }} />
      <Stack.Screen name="legal" options={{ headerShown: false, presentation: "card" }} />
    </Stack>
  );
}

function AppContent() {
  const { isLoggedIn, isLoading } = useAuth();
  const { colors } = useTheme();
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      Promise.all([
        loadCacheFromDisk().then(() => {
          const cached = getCachedProfile();
          if (cached?.id) {
            connectWebSocket(cached.id);
            registerForPushNotifications(cached.id);
          }
        }),
        AsyncStorage.getItem("liftflow_onboarding_done").then((val) => {
          setHasOnboarded(val === "true");
        }),
      ]).then(() => setAppReady(true));
    } else {
      disconnectWebSocket();
      setAppReady(true);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const sub = setupNotificationResponseHandler((data) => {
      if (data.type === 'chat' && data.programId && data.programTitle) {
        router.push({ pathname: '/conversation', params: { coachId: data.programId, clientProfileId: data.programTitle } });
      } else if (data.programId) {
        router.push({ pathname: '/program/[id]', params: { id: data.programId } });
      }
    });
    return () => sub.remove();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoading && appReady) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, appReady]);

  if (isLoading || !appReady) {
    return null;
  }

  if (!isLoggedIn) {
    return <AuthScreen />;
  }

  if (hasOnboarded === null) {
    return null;
  }

  if (!hasOnboarded) {
    return (
      <OnboardingScreen
        onComplete={async () => {
          await AsyncStorage.setItem("liftflow_onboarding_done", "true");
          setHasOnboarded(true);
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <RootLayoutNav />
      <UploadBanner />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <ThemeProvider>
              <AuthProvider>
                <UploadProvider>
                  <ThemedStatusBar />
                  <AppContent />
                </UploadProvider>
              </AuthProvider>
            </ThemeProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
