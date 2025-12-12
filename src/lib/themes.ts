// Theme definitions and utilities
import { useState, useEffect } from 'react';

export type Theme = 'light' | 'instrument' | 'terminal';

export const themes = {
  light: {
    name: 'Light',
    class: 'theme-light',
  },
  instrument: {
    name: 'Instrument',
    class: 'theme-instrument',
  },
  terminal: {
    name: 'Terminal',
    class: 'theme-terminal',
  },
} as const;

const THEME_ORDER: Theme[] = ['light', 'instrument', 'terminal'];

const isTheme = (value: string | null): value is Theme => {
  return value === 'light' || value === 'instrument' || value === 'terminal';
};

export const getTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light';

  // Migration: Convert old 'apple' theme to 'light'
  const stored = localStorage.getItem('app-theme');
  if (stored === 'apple') {
    localStorage.setItem('app-theme', 'light');
    return 'light';
  }

  if (isTheme(stored)) {
    return stored;
  }

  return 'light';
};

export const setTheme = (theme: Theme) => {
  if (typeof window === 'undefined') return;

  localStorage.setItem('app-theme', theme);
  document.documentElement.classList.remove(
    'theme-light',
    'theme-instrument',
    'theme-terminal',
    'theme-apple'
  );
  document.documentElement.classList.add(themes[theme].class);

  // Dispatch event for components that need to react to theme change
  window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
};

export const initializeTheme = () => {
  if (typeof window === 'undefined') return;

  const theme = getTheme();
  document.documentElement.classList.add(themes[theme].class);
};

// useTheme hook for React components
export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());

  useEffect(() => {
    const handleThemeChange = (event: CustomEvent<Theme>) => {
      setThemeState(event.detail);
    };

    window.addEventListener('themechange', handleThemeChange as EventListener);

    // Set initial theme
    const currentTheme = getTheme();
    setThemeState(currentTheme);

    return () => {
      window.removeEventListener('themechange', handleThemeChange as EventListener);
    };
  }, []);

  const toggleTheme = () => {
    const currentIndex = THEME_ORDER.indexOf(theme);
    const nextTheme = THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length];
    setTheme(nextTheme);
  };

  return { theme, toggleTheme, setTheme };
};
