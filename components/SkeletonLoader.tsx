import { View, StyleSheet } from "react-native";
import { useEffect, useRef } from "react";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useTheme } from "@/lib/theme-context";

function SkeletonPulse({ width, height, borderRadius = 8, style, surfaceLightColor }: { width: number | string; height: number; borderRadius?: number; style?: any; surfaceLightColor?: string }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: surfaceLightColor || Colors.colors.surfaceLight },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function HomeSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={s.container}>
      <SkeletonPulse width={180} height={28} surfaceLightColor={colors.surfaceLight} />
      <SkeletonPulse width={120} height={14} style={{ marginTop: 6 }} surfaceLightColor={colors.surfaceLight} />
      <View style={s.row}>
        {[1, 2, 3].map(i => (
          <View key={i} style={[s.statBox, { backgroundColor: colors.backgroundCard }]}>
            <SkeletonPulse width={36} height={36} borderRadius={18} surfaceLightColor={colors.surfaceLight} />
            <SkeletonPulse width={40} height={20} style={{ marginTop: 8 }} surfaceLightColor={colors.surfaceLight} />
            <SkeletonPulse width={50} height={12} style={{ marginTop: 4 }} surfaceLightColor={colors.surfaceLight} />
          </View>
        ))}
      </View>
      <SkeletonPulse width={120} height={18} style={{ marginTop: 24 }} surfaceLightColor={colors.surfaceLight} />
      {[1, 2].map(i => (
        <View key={i} style={[s.card, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
          <SkeletonPulse width="70%" height={16} surfaceLightColor={colors.surfaceLight} />
          <SkeletonPulse width="50%" height={12} style={{ marginTop: 8 }} surfaceLightColor={colors.surfaceLight} />
          <SkeletonPulse width="90%" height={4} borderRadius={2} style={{ marginTop: 12 }} surfaceLightColor={colors.surfaceLight} />
        </View>
      ))}
    </View>
  );
}

export function ProgramsSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={s.container}>
      <View style={[s.rowBetween, { marginBottom: 16 }]}>
        <SkeletonPulse width={120} height={28} surfaceLightColor={colors.surfaceLight} />
        <SkeletonPulse width={70} height={36} borderRadius={18} surfaceLightColor={colors.surfaceLight} />
      </View>
      {[1, 2, 3].map(i => (
        <View key={i} style={[s.card, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
          <View style={s.row}>
            <SkeletonPulse width={8} height={8} borderRadius={4} surfaceLightColor={colors.surfaceLight} />
            <SkeletonPulse width="60%" height={16} surfaceLightColor={colors.surfaceLight} />
          </View>
          <SkeletonPulse width="80%" height={12} style={{ marginTop: 8 }} surfaceLightColor={colors.surfaceLight} />
          <View style={[s.row, { marginTop: 12 }]}>
            <SkeletonPulse width={70} height={14} surfaceLightColor={colors.surfaceLight} />
            <SkeletonPulse width={70} height={14} surfaceLightColor={colors.surfaceLight} />
            <SkeletonPulse width={70} height={14} surfaceLightColor={colors.surfaceLight} />
          </View>
          <SkeletonPulse width="100%" height={4} borderRadius={2} style={{ marginTop: 12 }} surfaceLightColor={colors.surfaceLight} />
        </View>
      ))}
    </View>
  );
}

export function ChatSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={s.container}>
      <SkeletonPulse width={80} height={28} style={{ marginBottom: 16 }} surfaceLightColor={colors.surfaceLight} />
      {[1, 2, 3, 4].map(i => (
        <View key={i} style={[s.row, { marginBottom: 16, gap: 12 }]}>
          <SkeletonPulse width={48} height={48} borderRadius={24} surfaceLightColor={colors.surfaceLight} />
          <View style={{ flex: 1 }}>
            <SkeletonPulse width="50%" height={16} surfaceLightColor={colors.surfaceLight} />
            <SkeletonPulse width="80%" height={12} style={{ marginTop: 6 }} surfaceLightColor={colors.surfaceLight} />
          </View>
          <SkeletonPulse width={30} height={12} surfaceLightColor={colors.surfaceLight} />
        </View>
      ))}
    </View>
  );
}

export function ProgressSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={s.container}>
      <SkeletonPulse width={120} height={28} style={{ marginBottom: 16 }} surfaceLightColor={colors.surfaceLight} />
      <View style={[s.card, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
        <SkeletonPulse width={100} height={14} surfaceLightColor={colors.surfaceLight} />
        <SkeletonPulse width={80} height={32} style={{ marginTop: 8 }} surfaceLightColor={colors.surfaceLight} />
      </View>
      {[1, 2, 3].map(i => (
        <View key={i} style={[s.card, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
          <View style={s.rowBetween}>
            <SkeletonPulse width={100} height={16} surfaceLightColor={colors.surfaceLight} />
            <SkeletonPulse width={60} height={20} surfaceLightColor={colors.surfaceLight} />
          </View>
          <SkeletonPulse width="100%" height={4} borderRadius={2} style={{ marginTop: 12 }} surfaceLightColor={colors.surfaceLight} />
        </View>
      ))}
    </View>
  );
}

export function ProfileSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={s.container}>
      <SkeletonPulse width={80} height={28} style={{ marginBottom: 20 }} surfaceLightColor={colors.surfaceLight} />
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <SkeletonPulse width={80} height={80} borderRadius={40} surfaceLightColor={colors.surfaceLight} />
        <SkeletonPulse width={140} height={20} style={{ marginTop: 12 }} surfaceLightColor={colors.surfaceLight} />
        <SkeletonPulse width={60} height={14} style={{ marginTop: 6 }} surfaceLightColor={colors.surfaceLight} />
      </View>
      <View style={[s.row, { justifyContent: 'center', gap: 24, marginBottom: 20 }]}>
        {[1, 2, 3].map(i => (
          <View key={i} style={{ alignItems: 'center' }}>
            <SkeletonPulse width={36} height={24} surfaceLightColor={colors.surfaceLight} />
            <SkeletonPulse width={50} height={12} style={{ marginTop: 4 }} surfaceLightColor={colors.surfaceLight} />
          </View>
        ))}
      </View>
      {[1, 2, 3].map(i => (
        <View key={i} style={[s.row, { marginBottom: 16, gap: 12 }]}>
          <SkeletonPulse width={36} height={36} borderRadius={10} surfaceLightColor={colors.surfaceLight} />
          <View style={{ flex: 1 }}>
            <SkeletonPulse width="60%" height={14} surfaceLightColor={colors.surfaceLight} />
            <SkeletonPulse width="40%" height={11} style={{ marginTop: 4 }} surfaceLightColor={colors.surfaceLight} />
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statBox: { flex: 1, alignItems: 'center', backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, padding: 14, marginTop: 16 },
  card: { backgroundColor: Colors.colors.backgroundCard, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.colors.border },
});
