import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, setActiveColors, type ThemeColors } from '@/constants/colors';

type ThemeMode = 'dark' | 'light';

interface ThemeState {
  theme: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const STORAGE_KEY = 'liftflow_theme';

const ThemeContext = createContext<ThemeState>({
  theme: 'dark',
  colors: darkColors,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'light' || val === 'dark') {
        setThemeState(val);
        setActiveColors(val === 'light' ? lightColors : darkColors);
      }
      setReady(true);
    });
  }, []);

  const colors = theme === 'light' ? lightColors : darkColors;

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    setActiveColors(mode === 'light' ? lightColors : darkColors);
    AsyncStorage.setItem(STORAGE_KEY, mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  if (!ready) return null;

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
