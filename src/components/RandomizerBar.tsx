'use client';

import React from 'react';
import { Sparkles, Shuffle } from 'lucide-react';
import { MOODS, MOOD_IDS } from '@/lib/randomizer/effectMeta';

interface RandomizerBarProps {
  moodId: string;
  wildness: number;
  seed: string;
  onMood: (id: string) => void;
  onWildness: (w: number) => void;
  onSurprise: () => void;
  onReroll: () => void;
}

const INK = '#ECEAE3';
const INK2 = '#A8A49A';
const SPARK = '#F53001';
const HAIR = 'rgba(255,255,255,.1)';
const RAISE = 'rgba(255,255,255,.05)';

/**
 * The Smart Randomizer — "a machine you play". Surprise / reroll (Space) /
 * mood / wildness / seed. Docked beneath the canvas in its own strip, so it
 * never sits over the hero image.
 */
export default function RandomizerBar({
  moodId,
  wildness,
  seed,
  onMood,
  onWildness,
  onSurprise,
  onReroll,
}: RandomizerBarProps) {
  return (
    <div
      className="hx-dock"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '11px 16px',
        flexWrap: 'wrap',
      }}
    >
      <button
        onClick={onSurprise}
        title="Compose a fresh look (Space)"
        aria-label="Compose a fresh look"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          height: 44,
          padding: '0 20px',
          borderRadius: 11,
          border: 0,
          cursor: 'pointer',
          background: SPARK,
          color: '#fff',
          fontWeight: 600,
          fontSize: 13.5,
          boxShadow: '0 4px 16px rgba(245,48,1,.24)',
        }}
      >
        <Sparkles className="w-4 h-4" />
        Surprise me
      </button>

      <button
        onClick={onReroll}
        title="Reroll unlocked layers (Space)"
        aria-label="Reroll unlocked layers"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          height: 44,
          padding: '0 18px',
          borderRadius: 11,
          border: `1px solid ${HAIR}`,
          background: RAISE,
          color: INK,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        <Shuffle className="w-4 h-4" />
        Reroll
      </button>

      <span style={{ width: 1, height: 24, background: HAIR }} />

      {/* Moods */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
        {MOOD_IDS.map(id => {
          const on = id === moodId;
          return (
            <button
              key={id}
              onClick={() => onMood(id)}
              aria-label={`${MOODS[id].name} mood`}
              aria-pressed={on}
              style={{
                fontSize: 12,
                minHeight: 44,
                padding: '8px 16px',
                borderRadius: 999,
                cursor: 'pointer',
                border: '1px solid ' + (on ? SPARK : HAIR),
                background: on ? 'rgba(245,48,1,.14)' : 'transparent',
                color: on ? '#FF6A42' : INK2,
                fontWeight: on ? 600 : 400,
                transition: 'color .12s ease, border-color .12s ease, background .12s ease',
              }}
            >
              {MOODS[id].name}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minWidth: 12 }} />

      {/* Wildness */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 11.5, color: INK2 }}>
        <span>calm</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(wildness * 100)}
          onChange={e => onWildness(Number(e.target.value) / 100)}
          style={{ width: 96, accentColor: SPARK, cursor: 'pointer' }}
          title="Wildness"
          aria-label="Wildness"
        />
        <span>wild</span>
      </div>

      {/* Seed */}
      <span
        style={{
          fontFamily: 'var(--font-jetbrains, ui-monospace), Menlo, monospace',
          fontSize: 11,
          color: INK2,
          minWidth: 56,
          textAlign: 'right',
        }}
        title="Recipe seed — same seed reproduces the look"
      >
        {seed ? `#${seed}` : '—'}
      </span>
    </div>
  );
}
