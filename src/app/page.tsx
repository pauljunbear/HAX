import dynamic from 'next/dynamic';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HAX - Real-time Image Effects',
  description: 'A React-based image editing app with real-time artistic effects.',
};

const EditorApp = dynamic(() => import('@/components/EditorApp'), {
  ssr: false,
  loading: () => null,
});

export default function Page() {
  return <EditorApp />;
}

