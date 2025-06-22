// Theme definitions and utilities
import { useState, useEffect } from 'react';

export type Theme = 'light' | 'terminal';

export const themes = {
  light: {
    name: 'Light',
    class: 'theme-light',
  },
  terminal: {
    name: 'Terminal',
    class: 'theme-terminal',
  },
} as const;

export const getTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light';

  // Migration: Convert old 'apple' theme to 'light'
  const stored = localStorage.getItem('app-theme');
  if (stored === 'apple') {
    localStorage.setItem('app-theme', 'light');
    return 'light';
  }

  return (stored as Theme) || 'light';
};

export const setTheme = (theme: Theme) => {
  if (typeof window === 'undefined') return;

  localStorage.setItem('app-theme', theme);
  document.documentElement.classList.remove('theme-light', 'theme-terminal', 'theme-apple');
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
    const newTheme: Theme = theme === 'light' ? 'terminal' : 'light';
    setTheme(newTheme);
  };

  return { theme, toggleTheme, setTheme };
};
