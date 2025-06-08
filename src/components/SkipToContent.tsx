'use client';

import React from 'react';
import { ARIA_LABELS, focusRingClass } from '@/lib/accessibility';

interface SkipToContentProps {
  targetId?: string;
  className?: string;
}

const SkipToContent: React.FC<SkipToContentProps> = ({ 
  targetId = 'main-content',
  className = ''
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.tabIndex = -1;
      target.focus();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className={`sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 
                  bg-primary-accent text-white px-4 py-2 rounded-md text-sm font-medium
                  ${focusRingClass} ${className}`}
      aria-label={ARIA_LABELS.skipToContent}
    >
      Skip to main content
    </a>
  );
};

export default SkipToContent; 