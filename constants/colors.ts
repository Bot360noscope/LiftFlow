export type ThemeColors = typeof darkColors;

export const darkColors = {
  primary: '#E8512F',
  primaryLight: '#FF6B47',
  primaryDark: '#C43E20',
  accent: '#FF8C42',
  background: '#0F0F0F',
  backgroundElevated: '#1A1A1A',
  backgroundCard: '#242424',
  backgroundCardHover: '#2E2E2E',
  surface: '#1E1E1E',
  surfaceLight: '#2A2A2A',
  text: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#666666',
  textGhost: 'rgba(232, 81, 47, 0.4)',
  border: '#333333',
  borderLight: '#444444',
  success: '#34C759',
  successLight: 'rgba(52, 199, 89, 0.15)',
  warning: '#FF9500',
  warningLight: 'rgba(255, 149, 0, 0.15)',
  danger: '#FF3B30',
  dangerLight: 'rgba(255, 59, 48, 0.15)',
  squat: '#FF4444',
  deadlift: '#4488FF',
  bench: '#44CC44',
  tabBar: '#0F0F0F',
  tabBarBorder: '#1A1A1A',
};

export const lightColors: ThemeColors = {
  primary: '#E8512F',
  primaryLight: '#FF6B47',
  primaryDark: '#C43E20',
  accent: '#FF8C42',
  background: '#F5F5F7',
  backgroundElevated: '#FFFFFF',
  backgroundCard: '#FFFFFF',
  backgroundCardHover: '#F0F0F2',
  surface: '#EEEEF0',
  surfaceLight: '#E8E8EA',
  text: '#1A1A1A',
  textSecondary: '#555555',
  textMuted: '#888888',
  textGhost: 'rgba(232, 81, 47, 0.3)',
  border: '#D8D8DC',
  borderLight: '#C8C8CC',
  success: '#34C759',
  successLight: 'rgba(52, 199, 89, 0.12)',
  warning: '#FF9500',
  warningLight: 'rgba(255, 149, 0, 0.12)',
  danger: '#FF3B30',
  dangerLight: 'rgba(255, 59, 48, 0.1)',
  squat: '#FF4444',
  deadlift: '#4488FF',
  bench: '#44CC44',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E0E0E0',
};

const activeColors = { ...darkColors };

export function setActiveColors(newColors: ThemeColors) {
  Object.assign(activeColors, newColors);
}

export default {
  light: {
    text: darkColors.text,
    background: darkColors.background,
    tint: darkColors.primary,
    tabIconDefault: darkColors.textMuted,
    tabIconSelected: darkColors.primary,
  },
  colors: activeColors,
};
