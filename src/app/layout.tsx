import './globals.css';
import '../styles/apple-colors.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { initializeTheme } from '@/lib/themes';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'HAX - Real-time Image Effects',
  description: 'A React-based image editing app with real-time artistic effects',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  themeColor: '#28a078',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'HAX',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Initialize theme before React hydration to prevent flash
              (function() {
                const theme = localStorage.getItem('app-theme') || 'apple';
                document.documentElement.classList.add('theme-' + theme);
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
