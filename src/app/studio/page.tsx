'use client';

import dynamic from 'next/dynamic';

// STUDIO — the simplified editor (Jun 2026 redesign), served as a non-destructive
// route alongside the current home editor. Konva needs the browser, so SSR is off.
const StudioApp = dynamic(() => import('@/components/studio/StudioApp'), {
  ssr: false,
  loading: () => null,
});

export default function StudioPage() {
  return <StudioApp />;
}
