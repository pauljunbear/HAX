import './globals.css';
import '../styles/apple-colors.css';
import '../styles/light-theme.css';
import '../styles/instrument-theme.css';
import '../styles/terminal-theme.css';
import '../styles/studio-theme.css';
import '../styles/hax-system.css'; // void darkroom skin — imported last so it wins
import type { Metadata } from 'next';
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';

// HAX type system: Fraunces (display) · Hanken Grotesk (text) · JetBrains Mono (data)
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
});

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-hanken',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
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
  themeColor: '#0b0b0c',
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
              // Initialize theme before React hydration to prevent flash.
              // The reimagined single design is 'hax' (void darkroom). The theme
              // toggle is retired, so legacy stored themes migrate to 'hax' —
              // existing users land on the new design, not a stale skin.
              (function() {
                try {
                  const stored = localStorage.getItem('app-theme');
                  if (stored && stored !== 'hax') localStorage.setItem('app-theme', 'hax');
                } catch (e) {}
                document.documentElement.classList.add('theme-hax');
              })();
            `,
          }}
        />
      </head>
      <body className={`${fraunces.variable} ${hanken.variable} ${jetbrains.variable}`}>
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
