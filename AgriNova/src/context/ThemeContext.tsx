import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ThemeMode } from '../types/auth';

const THEME_STORAGE_KEY = 'agrinova_theme_mode';

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'coffee' | 'dark';
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem('sfc_theme_mode');
    if (saved === 'light' || saved === 'coffee' || saved === 'dark' || saved === 'system') {
      return saved;
    }
    return 'coffee';
  });

  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemTheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme: 'light' | 'coffee' | 'dark' = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'theme-coffee', 'theme-light');
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else if (resolvedTheme === 'coffee') {
      root.classList.add('theme-coffee');
    } else {
      root.classList.add('theme-light');
    }
  }, [resolvedTheme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
