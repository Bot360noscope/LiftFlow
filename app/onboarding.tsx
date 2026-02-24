import { StyleSheet, Text, View, Pressable, Platform, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";

const { width } = Dimensions.get("window");

interface OnboardingProps {
  onComplete: () => void;
}

const pages = [
  {
    icon: "barbell" as const,
    title: "Welcome to LiftFlow",
    description:
      "Your all-in-one fitness coaching platform. Connect with coaches, follow programs, and track your progress.",
  },
  {
    icon: "school" as const,
    title: "Build & Share Programs",
    description:
      "Create custom training programs with our spreadsheet builder. Share them with clients and track their progress in real-time.",
  },
  {
    icon: "fitness" as const,
    title: "Train Smarter",
    description:
      "Follow your coach's programs, log your weights and reps, record form check videos, and chat directly with your coach.",
  },
];

export default function OnboardingScreen({ onComplete }: OnboardingProps) {
  const insets = useSafeAreaInsets();
  const [currentPage, setCurrentPage] = useState(0);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
    } else {
      onComplete();
    }
  };

  const page = pages[currentPage];

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + webTopInset + 12 },
        ]}
      >
        <View style={{ width: 50 }} />
        <View style={{ flex: 1 }} />
        <Pressable onPress={onComplete} hitSlop={12}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <Animated.View
          entering={FadeInDown.duration(400).springify()}
          key={currentPage}
          style={styles.pageContent}
        >
          <View style={styles.iconCircle}>
            <Ionicons name={page.icon} size={48} color={Colors.colors.primary} />
          </View>
          <Text style={styles.title}>{page.title}</Text>
          <Text style={styles.description}>{page.description}</Text>
        </Animated.View>
      </View>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + webBottomInset + 20 },
        ]}
      >
        <View style={styles.dots}>
          {pages.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentPage && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <Pressable style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>
            {currentPage === pages.length - 1 ? "Get Started" : "Next"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  skipText: {
    fontFamily: "Rubik_500Medium",
    fontSize: 15,
    color: Colors.colors.textSecondary,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  pageContent: {
    alignItems: "center",
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(232, 81, 47, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  title: {
    fontFamily: "Rubik_700Bold",
    fontSize: 28,
    color: Colors.colors.text,
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    fontFamily: "Rubik_400Regular",
    fontSize: 16,
    color: Colors.colors.textSecondary,
    textAlign: "center",
    maxWidth: 300,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    gap: 24,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.colors.border,
  },
  dotActive: {
    backgroundColor: Colors.colors.primary,
    width: 24,
  },
  nextBtn: {
    backgroundColor: Colors.colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  nextBtnText: {
    fontFamily: "Rubik_700Bold",
    fontSize: 16,
    color: "#fff",
  },
});
