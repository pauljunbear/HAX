import { mulberry32 } from '@/lib/effects/color-space';

/** xmur3 string hash -> 32-bit seed. */
export function xmur3(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** Deterministic PRNG (0..1) from a seed string — every randomizer draw flows from this. */
export function makeRng(seed: string): () => number {
  return mulberry32(xmur3(seed));
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** A short shareable seed string. Uses Math.random ONCE to pick a seed; all
 *  composition is then deterministic from that seed. */
export function randSeed(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}
