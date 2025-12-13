/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', 'class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          light: 'rgb(var(--primary-light))',
          dark: 'rgb(var(--primary-dark))',
          accent: 'rgb(var(--primary-accent, 88 80 236))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        canvas: {
          bg: 'rgb(var(--canvas-bg))',
        },
        dark: {
          bg: 'rgb(var(--dark-bg, 10 10 10))',
          surface: 'rgb(var(--dark-surface, 18 18 18))',
          border: 'rgb(var(--dark-border, 28 28 28))',
          text: 'rgb(var(--dark-text, 235 235 235))',
          textMuted: 'rgb(var(--dark-text-muted, 140 140 140))',
        },
        apple: {
          blue: 'rgb(var(--apple-blue))',
          red: 'rgb(var(--apple-red))',
          green: 'rgb(var(--apple-green))',
          yellow: 'rgb(var(--apple-yellow))',
          orange: 'rgb(var(--apple-orange))',
          purple: 'rgb(var(--apple-purple))',
          teal: 'rgb(var(--apple-teal))',
          indigo: 'rgb(var(--apple-indigo))',
          gray: {
            50: 'rgb(var(--apple-gray-50))',
            100: 'rgb(var(--apple-gray-100))',
            200: 'rgb(var(--apple-gray-200))',
            300: 'rgb(var(--apple-gray-300))',
            400: 'rgb(var(--apple-gray-400))',
            500: 'rgb(var(--apple-gray-500))',
            600: 'rgb(var(--apple-gray-600))',
            700: 'rgb(var(--apple-gray-700))',
            800: 'rgb(var(--apple-gray-800))',
            900: 'rgb(var(--apple-gray-900))',
          },
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      boxShadow: {
        'apple-sm': '0 2px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)',
        apple: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.05)',
        'apple-md': '0 8px 24px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)',
        'apple-lg': '0 12px 32px rgba(0, 0, 0, 0.1), 0 2px 10px rgba(0, 0, 0, 0.05)',
        'apple-xl': '0 20px 48px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(0, 0, 0, 0.06)',
      },
      borderRadius: {
        'apple-sm': '0.5rem',
        apple: '0.75rem',
        'apple-md': '1rem',
        'apple-lg': '1.25rem',
        'apple-xl': '1.5rem',
        'apple-2xl': '2rem',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'San Francisco',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
        mono: ['SFMono-Regular', 'SF Mono', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      backdropBlur: {
        apple: '12px',
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require('tailwindcss-animate')],
};
