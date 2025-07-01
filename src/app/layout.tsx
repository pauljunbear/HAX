import './globals.css';
import '../styles/apple-colors.css';
import '../styles/light-theme.css';
import '../styles/terminal-theme.css';
import type { Metadata } from 'next';
import { Inter, Fira_Code, Space_Mono } from 'next/font/google';
import { initializeTheme } from '@/lib/themes';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  variable: '--font-fira-code',
});

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
});

export const metadata: Metadata = {
  title: 'HAX - Real-time Image Effects',
  description: 'A React-based image editing app with real-time artistic effects',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'HAX',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#007aff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Initialize theme before React hydration to prevent flash
              (function() {
                const stored = localStorage.getItem('app-theme');
                // Migration: Convert old 'apple' theme to 'light'
                const theme = stored === 'apple' ? 'light' : (stored || 'light');
                if (stored === 'apple') {
                  localStorage.setItem('app-theme', 'light');
                }
                document.documentElement.classList.add('theme-' + theme);
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${firaCode.variable} ${spaceMono.variable}`}>
        <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
          <defs>
            <filter id="lg-dist">
              <feTurbulence baseFrequency="0.01 0.03" numOctaves="3" seed="2" type="fractalNoise" />
              <feDisplacementMap in="SourceGraphic" scale="70" />
            </filter>
          </defs>
        </svg>
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
