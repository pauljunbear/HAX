import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'imHAX - a fun image editing app by Paul Jun',
  description: 'A React-based image editing app with real-time artistic effects',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
} 