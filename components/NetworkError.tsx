import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

interface NetworkErrorProps {
  onRetry: () => void;
  message?: string;
}

export default function NetworkError({ onRetry, message }: NetworkErrorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="cloud-offline-outline" size={40} color={Colors.colors.textMuted} />
        <Text style={styles.title}>Connection Issue</Text>
        <Text style={styles.message}>
          {message || "Unable to load data. Check your connection and try again."}
        </Text>
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.colors.background,
    padding: 20,
  },
  card: {
    backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 12,
    padding: 32,
    gap: 12,
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
  },
  title: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 16,
    color: Colors.colors.text,
  },
  message: {
    fontFamily: "Rubik_400Regular",
    fontSize: 14,
    color: Colors.colors.textMuted,
    textAlign: "center",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  retryText: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
});
