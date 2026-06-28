import dynamic from 'next/dynamic';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HAX - Real-time Image Effects',
  description: 'A React-based image editing app with real-time artistic effects.',
};

// STUDIO is the home experience (Jun 2026 redesign). The original editor lives
// at /classic. Konva needs the browser, so SSR is off.
const StudioApp = dynamic(() => import('@/components/studio/StudioApp'), {
  ssr: false,
  loading: () => null,
});

export default function Page() {
  return <StudioApp />;
}
