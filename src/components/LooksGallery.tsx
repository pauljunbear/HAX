'use client';

import React from 'react';
import type { Look } from '@/lib/looks/looks';

const INK = '#ECEAE3';

/**
 * Curated Looks — one-click starting points (a Look is a full, editable layer
 * recipe). Sits as its own strip in the dock beneath the canvas, paired above
 * the Randomizer: "pick a look" alongside "roll a look". Never overlaps the hero
 * image. Applying a Look replaces the stack but stays fully decomposable.
 */
interface LooksGalleryProps {
  looks: Look[];
  onApply: (look: Look) => void;
}

export default function LooksGallery({ looks, onApply }: LooksGalleryProps) {
  return (
    <div
      className="hx-dock"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        overflowX: 'auto',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-fraunces, Georgia), serif',
          fontSize: 15,
          fontWeight: 600,
          color: INK,
          paddingRight: 2,
          whiteSpace: 'nowrap',
          letterSpacing: '-0.01em',
        }}
      >
        Looks
      </span>
      <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
        {looks.map(look => (
          <button
            key={look.id}
            className="hx-look-chip"
            onClick={() => onApply(look)}
            title={look.blurb}
            aria-label={`Apply the ${look.name} look`}
            style={{
              whiteSpace: 'nowrap',
              fontSize: 12.5,
              padding: '8px 14px',
              minHeight: 40,
              borderRadius: 999,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {look.name}
          </button>
        ))}
      </div>
    </div>
  );
}
