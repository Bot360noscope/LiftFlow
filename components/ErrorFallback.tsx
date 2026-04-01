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

export type ErrorFallbackProps = {
  error: Error;
  resetError: () => void;
};

const SUPPORT_EMAIL = "support@lift-flow.com";

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const insets = useSafeAreaInsets();
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleRestart = async () => {
    try {
      await reloadAppAsync();
    } catch (restartError) {
      console.error("Failed to restart app:", restartError);
      resetError();
    }
  };

  const handleContactSupport = () => {
    const subject = encodeURIComponent("LiftFlow App Crash Report");
    const body = encodeURIComponent(
      `Hi LiftFlow Support,\n\nThe app crashed with the following error:\n\n${error.message}\n\nPlease help me resolve this issue.\n\nThank you.`
    );
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  const formatErrorDetails = (): string => {
    let details = `Error: ${error.message}\n\n`;
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

        <Text style={styles.message}>
          The app ran into an unexpected issue. Try restarting — if it keeps happening, reach out to support and we'll get it sorted.
        </Text>

        <Pressable
          onPress={handleRestart}
          style={({ pressed }) => [
            styles.primaryButton,
            { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <Ionicons name="refresh" size={20} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={styles.primaryButtonText}>Restart App</Text>
        </Pressable>

        <Pressable
          onPress={handleContactSupport}
          style={({ pressed }) => [
            styles.secondaryButton,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons name="mail-outline" size={18} color="#999" style={{ marginRight: 8 }} />
          <Text style={styles.secondaryButtonText}>Contact Support</Text>
        </Pressable>
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
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    fontWeight: "500" as const,
    fontSize: 14,
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
