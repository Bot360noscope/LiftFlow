import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { getApiUrl } from "@/lib/query-client";

const APP_VERSION = Constants.expoConfig?.version || "0.0.0";
const IOS_STORE_URL = "https://apps.apple.com/us/app/lift-flow/id6759719919";
const ANDROID_STORE_URL = "https://play.google.com/store/apps/details?id=com.liftflow";

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export default function ForceUpdate({ children }: { children: React.ReactNode }) {
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const [requiredVersion, setRequiredVersion] = useState("");

  useEffect(() => {
    if (Platform.OS === "web") return;

    const check = async () => {
      try {
        const url = new URL("/api/app-config", getApiUrl());
        const res = await fetch(url.toString());
        if (!res.ok) return;
        const data = await res.json();
        const needsUpdate = compareVersions(APP_VERSION, data.minVersion) < 0;
        if (needsUpdate || data.forceUpdate) {
          setMessage(data.updateMessage || "Please update LiftFlow to continue.");
          setRequiredVersion(data.latestVersion || data.minVersion);
          setBlocked(true);
        }
      } catch {}
    };
    check();
  }, []);

  if (blocked) {
    const storeName = Platform.OS === "ios" ? "App Store" : "Google Play";
    const storeUrl = Platform.OS === "ios" ? IOS_STORE_URL : ANDROID_STORE_URL;

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="arrow-up-circle" size={56} color="#E8512F" />
          </View>
          <Text style={styles.title}>Update Required</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.versionRow}>
            <View style={styles.versionBox}>
              <Text style={styles.versionLabel}>Your Version</Text>
              <Text style={styles.versionOld}>{APP_VERSION}</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color="#555" />
            <View style={styles.versionBox}>
              <Text style={styles.versionLabel}>Latest</Text>
              <Text style={styles.versionNew}>{requiredVersion}</Text>
            </View>
          </View>

          <Pressable
            style={styles.button}
            onPress={() => Linking.openURL(storeUrl)}
          >
            <Ionicons name={Platform.OS === "ios" ? "logo-apple" : "logo-google-playstore"} size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>Update on {storeName}</Text>
          </Pressable>

          <Text style={styles.hint}>
            After updating, re-open the app.
          </Text>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F0F0F",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  iconWrap: {
    marginBottom: 20,
  },
  title: {
    fontFamily: "Rubik_700Bold",
    fontSize: 22,
    color: "#fff",
    marginBottom: 12,
  },
  message: {
    fontFamily: "Rubik_400Regular",
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  versionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  versionBox: {
    alignItems: "center",
    gap: 4,
  },
  versionLabel: {
    fontFamily: "Rubik_400Regular",
    fontSize: 11,
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  versionOld: {
    fontFamily: "Rubik_700Bold",
    fontSize: 18,
    color: "#FF3B30",
  },
  versionNew: {
    fontFamily: "Rubik_700Bold",
    fontSize: 18,
    color: "#34C759",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8512F",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: "100%",
  },
  buttonText: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 16,
    color: "#fff",
  },
  hint: {
    fontFamily: "Rubik_400Regular",
    fontSize: 12,
    color: "#555",
    marginTop: 16,
    textAlign: "center",
  },
});
