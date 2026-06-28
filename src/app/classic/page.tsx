import dynamic from 'next/dynamic';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HAX Classic — Image Effects',
  description: 'The original HAX editor (three-panel layout), kept alongside STUDIO.',
};

// The original editor, preserved at /classic after STUDIO became the home (/).
const EditorApp = dynamic(() => import('@/components/EditorApp'), {
  ssr: false,
  loading: () => null,
});

export default function ClassicPage() {
  return <EditorApp />;
}
