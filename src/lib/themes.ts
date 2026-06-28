// Theme definitions and utilities
import { useState, useEffect } from 'react';

export type Theme = 'hax' | 'light' | 'instrument' | 'terminal' | 'studio';

export const themes = {
  hax: {
    name: 'HAX',
    class: 'theme-hax',
  },
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
  studio: {
    name: 'Studio',
    class: 'theme-studio',
  },
} as const;

const THEME_ORDER: Theme[] = ['hax', 'light', 'instrument', 'terminal', 'studio'];

const isTheme = (value: string | null): value is Theme => {
  return (
    value === 'hax' ||
    value === 'light' ||
    value === 'instrument' ||
    value === 'terminal' ||
    value === 'studio'
  );
};

export const getTheme = (): Theme => {
  // Single-design reimagine: the void darkroom skin is the product. The theme
  // toggle is retired; everyone is on 'hax'. (isTheme retained for the API.)
  void isTheme;
  return 'hax';
};

export const setTheme = (theme: Theme) => {
  if (typeof window === 'undefined') return;

  localStorage.setItem('app-theme', theme);
  document.documentElement.classList.remove(
    'theme-hax',
    'theme-light',
    'theme-instrument',
    'theme-terminal',
    'theme-apple',
    'theme-studio'
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
