import React, { useState } from "react";
import { reloadAppAsync } from "expo";
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  Text,
  Modal,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

export type ErrorFallbackProps = {
  error: Error;
  resetError: () => void;
  pageName?: string;
};

const SUPPORT_EMAIL = "lift-flowsupport@gmail.com";
const WHATSAPP_NUMBER = "96103936999";

const PAGE_LABELS: Record<string, string> = {
  Dashboard: "Dashboard",
  Programs: "Programs",
  "Client Progress": "Client Progress",
  Chat: "Chat",
  Profile: "Profile",
  "Program Editor": "Program Editor",
  "Client Detail": "Client Detail",
  Conversation: "Conversation",
  "Create Program": "Create Program",
  "Add PR": "Add PR",
  "Record Video": "Record Video",
  "Trim Video": "Trim Video",
  "Join Coach": "Join Coach",
};

export function ErrorFallback({ error, resetError, pageName }: ErrorFallbackProps) {
  const insets = useSafeAreaInsets();
  const [isModalVisible, setIsModalVisible] = useState(false);

  const displayName = pageName ? (PAGE_LABELS[pageName] || pageName) : undefined;

  const crashContext = displayName
    ? `crashed on the "${displayName}" page`
    : "crashed";

  const handleRestart = async () => {
    try {
      await reloadAppAsync();
    } catch (restartError) {
      console.error("Failed to restart app:", restartError);
      resetError();
    }
  };

  const handleGoHome = () => {
    resetError();
    try {
      router.replace("/");
    } catch {
      resetError();
    }
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(
      displayName
        ? `LiftFlow Crash Report — ${displayName}`
        : "LiftFlow App Crash Report"
    );
    const body = encodeURIComponent(
      `Hi LiftFlow Support,\n\nThe app ${crashContext} with the following error:\n\n${error.message || "Unknown error"}\n\nPlease help me resolve this issue.\n\nThank you.`
    );
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `Hi, I'm having an issue with the LiftFlow app. It ${crashContext} with this error: ${error.message || "Unknown error"}`
    );
    Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`);
  };

  const formatErrorDetails = (): string => {
    let details = "";
    if (displayName) {
      details += `Page: ${displayName}\n\n`;
    }
    details += `Error: ${error.message}\n\n`;
    if (error.stack) {
      details += `Stack Trace:\n${error.stack}`;
    }
    return details;
  };

  const monoFont = Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  });

  const showGoHome = !!pageName;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      {__DEV__ ? (
        <Pressable
          onPress={() => setIsModalVisible(true)}
          accessibilityLabel="View error details"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.topButton,
            {
              top: insets.top + 16,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons name="bug-outline" size={22} color="#999" />
        </Pressable>
      ) : null}

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="warning-outline" size={40} color="#FF9500" />
        </View>

        <Text style={styles.title}>Something went wrong</Text>

        {displayName ? (
          <Text style={styles.pageLabel}>{displayName}</Text>
        ) : null}

        <Text style={styles.message}>
          {displayName
            ? `The ${displayName} page ran into an unexpected issue. You can go back to the home screen or restart the app.`
            : "The app ran into an unexpected issue. Try restarting — if it keeps happening, reach out to support and we'll get it sorted."}
        </Text>

        {showGoHome && (
          <Pressable
            onPress={handleGoHome}
            style={({ pressed }) => [
              styles.primaryButton,
              { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <Ionicons name="home-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryButtonText}>Go Home</Text>
          </Pressable>
        )}

        <Pressable
          onPress={handleRestart}
          style={({ pressed }) => [
            showGoHome ? styles.secondaryButton : styles.primaryButton,
            { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <Ionicons name="refresh" size={20} color={showGoHome ? "#E8512F" : "#FFF"} style={{ marginRight: 8 }} />
          <Text style={[showGoHome ? styles.secondaryButtonText : styles.primaryButtonText]}>Restart App</Text>
        </Pressable>

        <Text style={styles.supportLabel}>If this keeps happening, contact support:</Text>

        <View style={styles.supportRow}>
          <Pressable
            onPress={handleWhatsApp}
            style={({ pressed }) => [
              styles.supportButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            <Text style={styles.supportButtonText}>WhatsApp</Text>
          </Pressable>

          <Pressable
            onPress={handleEmail}
            style={({ pressed }) => [
              styles.supportButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Ionicons name="mail-outline" size={20} color="#999" />
            <Text style={styles.supportButtonText}>Email</Text>
          </Pressable>
        </View>
      </View>

      {__DEV__ ? (
        <Modal
          visible={isModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Error Details</Text>
                <Pressable
                  onPress={() => setIsModalVisible(false)}
                  accessibilityLabel="Close error details"
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.closeButton,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Ionicons name="close" size={24} color="#FFF" />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={[
                  styles.modalScrollContent,
                  { paddingBottom: insets.bottom + 16 },
                ]}
                showsVerticalScrollIndicator
              >
                <View style={styles.errorContainer}>
                  <Text
                    style={[styles.errorText, { fontFamily: monoFont }]}
                    selectable
                  >
                    {formatErrorDetails()}
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#0F0F0F",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    width: "100%",
    maxWidth: 340,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 149, 0, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700" as const,
    textAlign: "center" as const,
    color: "#FFFFFF",
  },
  pageLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#E8512F",
    textAlign: "center" as const,
    backgroundColor: "rgba(232, 81, 47, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden" as const,
  },
  message: {
    fontSize: 15,
    textAlign: "center" as const,
    lineHeight: 22,
    color: "#999",
    marginBottom: 8,
  },
  topButton: {
    position: "absolute" as const,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1C1C1E",
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    zIndex: 10,
  },
  primaryButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: 14,
    borderRadius: 12,
    paddingHorizontal: 24,
    width: "100%",
    backgroundColor: "#E8512F",
  },
  primaryButtonText: {
    fontWeight: "600" as const,
    textAlign: "center" as const,
    fontSize: 16,
    color: "#FFF",
  },
  secondaryButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: 14,
    borderRadius: 12,
    paddingHorizontal: 24,
    width: "100%",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#E8512F",
  },
  secondaryButtonText: {
    fontWeight: "600" as const,
    textAlign: "center" as const,
    fontSize: 16,
    color: "#E8512F",
  },
  supportLabel: {
    fontSize: 13,
    color: "#666",
    textAlign: "center" as const,
    marginTop: 8,
  },
  supportRow: {
    flexDirection: "row" as const,
    gap: 16,
  },
  supportButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#1C1C1E",
  },
  supportButtonText: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: "#999",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end" as const,
  },
  modalContainer: {
    width: "100%",
    height: "90%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: "#1C1C1E",
  },
  modalHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600" as const,
    color: "#FFF",
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
  },
  errorContainer: {
    width: "100%",
    borderRadius: 8,
    overflow: "hidden" as const,
    padding: 16,
    backgroundColor: "#0F0F0F",
  },
  errorText: {
    fontSize: 12,
    lineHeight: 18,
    width: "100%",
    color: "#FFF",
  },
});
