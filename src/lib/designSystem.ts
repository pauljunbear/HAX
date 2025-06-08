// Apple-inspired Design System for Imager

export const spacing = {
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '0.75rem',    // 12px
  lg: '1rem',       // 16px
  xl: '1.5rem',     // 24px
  '2xl': '2rem',    // 32px
  '3xl': '3rem',    // 48px
  '4xl': '4rem',    // 64px
} as const;

export const borderRadius = {
  sm: '0.375rem',   // 6px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.5rem',  // 24px
  full: '9999px',
} as const;

export const colors = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  success: {
    500: '#10b981',
    600: '#059669',
  },
  warning: {
    500: '#f59e0b',
    600: '#d97706',
  },
  error: {
    500: '#ef4444',
    600: '#dc2626',
  },
} as const;

export const typography = {
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
} as const;

// Button Variants
export const buttonVariants = {
  primary: {
    base: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    disabled: 'bg-gray-300 text-gray-500 cursor-not-allowed',
  },
  secondary: {
    base: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
    disabled: 'bg-gray-100 text-gray-400 cursor-not-allowed',
  },
  ghost: {
    base: 'text-gray-600 hover:bg-gray-100 focus:ring-gray-500 dark:text-gray-400 dark:hover:bg-gray-700',
    disabled: 'text-gray-400 cursor-not-allowed',
  },
  danger: {
    base: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    disabled: 'bg-gray-300 text-gray-500 cursor-not-allowed',
  },
} as const;

// Button Sizes
export const buttonSizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
} as const;

// Animation Presets
export const animations = {
  spring: {
    type: "spring",
    damping: 25,
    stiffness: 200,
  },
  smooth: {
    type: "tween",
    duration: 0.2,
    ease: "easeOut",
  },
  bounce: {
    type: "spring",
    damping: 15,
    stiffness: 300,
  },
} as const;

// Layout Constants
export const layout = {
  sidebar: {
    left: '280px',
    right: '320px',
    collapsed: '60px',
  },
  header: {
    height: '56px', // 14 * 4 = 56px
  },
  canvas: {
    minWidth: '400px',
  },
} as const;

// Utility Functions
export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};

export const getButtonClasses = (
  variant: keyof typeof buttonVariants = 'primary',
  size: keyof typeof buttonSizes = 'md',
  disabled = false
): string => {
  const variantClasses = disabled 
    ? buttonVariants[variant].disabled 
    : buttonVariants[variant].base;
  
  return cn(
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    buttonSizes[size],
    variantClasses
  );
};

export const getSpacing = (size: keyof typeof spacing): string => spacing[size];
export const getBorderRadius = (size: keyof typeof borderRadius): string => borderRadius[size];
export const getShadow = (size: keyof typeof shadows): string => shadows[size]; 