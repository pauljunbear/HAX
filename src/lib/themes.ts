// Theme definitions and utilities
export type Theme = 'apple' | 'cyberpunk';

export const themes = {
  apple: {
    name: 'Apple',
    class: 'theme-apple',
  },
  cyberpunk: {
    name: 'Cyberpunk',
    class: 'theme-cyberpunk',
  },
} as const;

export const getTheme = (): Theme => {
  if (typeof window === 'undefined') return 'apple';
  return (localStorage.getItem('app-theme') as Theme) || 'apple';
};

export const setTheme = (theme: Theme) => {
  if (typeof window === 'undefined') return;

  localStorage.setItem('app-theme', theme);
  document.documentElement.classList.remove('theme-apple', 'theme-cyberpunk');
  document.documentElement.classList.add(themes[theme].class);

  // Dispatch event for components that need to react to theme change
  window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
};

export const initializeTheme = () => {
  if (typeof window === 'undefined') return;

  const theme = getTheme();
  document.documentElement.classList.add(themes[theme].class);
};
