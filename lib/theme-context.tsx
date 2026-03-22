import React, { createContext, useContext } from 'react';
import { darkColors, setActiveColors, type ThemeColors } from '@/constants/colors';

interface ThemeState {
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeState>({
  colors: darkColors,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  setActiveColors(darkColors);

  return (
    <ThemeContext.Provider value={{ colors: darkColors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
