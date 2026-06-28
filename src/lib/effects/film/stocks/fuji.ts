/**
 * Fujifilm stock recipes for the film substrate.
 *
 * Source of every number: docs/effects-research/research/r3-fuji.md. Confidence
 * tags from that doc are carried through inline: [M] = measured/documented from a
 * Fuji datasheet or Fuji's published rating table; [E] = an estimated seed tuned
 * to the documented *direction* (contrast class, cast, dye behaviour). Per r3's
 * big caveat, every tone curve is [E] — Fuji publishes characteristic curves only
 * as plotted images, never numeric tables — shaped to the documented contrast
 * class (Velvia = High, Provia = Standard, Astia = Soft) and cast.
 *
 * Translating r3 → this engine (substrate.ts capabilities):
 *  - r3's `channel_gains` → `gain` (linear).            1:1.
 *  - r3's linear `color_matrix` → `matrix` (row-major). 1:1.
 *  - r3's `global_saturation` → `saturation`.           1:1.
 *  - r3's `per_hue_saturation` has NO slot here (the substrate's saturation is
 *    global + luma-preserving only). Its signature direction is therefore carried
 *    by the matrix (which already deepens/cools greens, purifies blues) — not lost,
 *    but flattened from per-hue to per-channel-crosstalk.
 *  - r3's `shadow_/highlight_desaturation` (luma-windowed chroma scaling, Pro 400H)
 *    likewise has no slot; it is approximated by the global saturation pull plus
 *    the curve-driven highlight hue shift.
 *  - r3's per-channel tone curves: r3 authors a shared luma S-curve PLUS small
 *    per-channel deltas. This engine applies exactly one standalone LUT per channel
 *    (`curveR ?? curve`, etc.), so the shared S is baked into `curve` (used by any
 *    un-overridden channel) and re-baked WITH each channel's delta into curveR/G/B.
 *  - Curves are display-space, monotonic, toe + shoulder. Slides reach y=1 via a
 *    soft shoulder (steep mids, no flat hard clip); negatives roll the shoulder
 *    off below 1.0 for latitude.
 *  - Grain `intensity` ≈ Kodak/Fuji RMS σ_D shape (ISO50≈0.008 … ISO400≈0.018);
 *    r3 quotes 8-bit sigmas, mapped to this scale.
 */

import type { FilmRecipe } from '../substrate';

export const FUJI_STOCKS: FilmRecipe[] = [
  // 1. VELVIA 50 (RVP50) — the reference for extreme saturation.
  // [M] saturation "world's highest"; contrast High; RMS 9; warm bias vs RVP100.
  {
    name: 'velvia50',
    displayName: 'Velvia 50',
    blurb:
      'The punchiest landscape slide ever made: electric greens, hot reds, deep blues on a steep clipping curve with a faint warm cast. Unkind to skin.',
    gain: [1.06, 1.0, 0.96], // [E] warm bias
    matrix: [
      // [E] cross-channel to deepen greens/reds, purify blue
      1.14, -0.1, -0.04, -0.08, 1.16, -0.08, -0.04, -0.12, 1.16,
    ],
    // Steep "High"-contrast luma S (drives G + any un-overridden channel). [E]
    curve: [
      [0, 0],
      [0.12, 0.06],
      [0.25, 0.18],
      [0.5, 0.5],
      [0.75, 0.84],
      [0.88, 0.95],
      [1, 1],
    ],
    // R = S + tiny warm mid lift. [E]
    curveR: [
      [0, 0],
      [0.12, 0.065],
      [0.25, 0.19],
      [0.5, 0.52],
      [0.75, 0.85],
      [0.88, 0.955],
      [1, 1],
    ],
    // B = S + slight blue-shadow lift, blue-highlight roll-off. [E]
    curveB: [
      [0, 0.01],
      [0.12, 0.063],
      [0.25, 0.175],
      [0.5, 0.48],
      [0.75, 0.825],
      [0.88, 0.94],
      [1, 0.99],
    ],
    saturation: 1.3, // [E] highest-saturation stock; eased from 1.35 so it does not go neon on already-warm scenes
    grain: { intensity: 0.008, grainSize: 2 }, // fine; ISO 50 / RMS 9 [E]
    halation: { intensity: 0.1, threshold: 0.8 }, // subtle slide-red bloom on brightest highlights
  },

  // 2. VELVIA 100 (RVP100) — Velvia saturation, one stop faster.
  // [M] saturation "quintessentially high" (= RVP50); contrast High; RMS 8.
  // Signature: neutral-to-cool white balance, cooler/tamed yellows, a hair less
  // shadow crush, marginally better skin than the 50.
  {
    name: 'velvia100',
    displayName: 'Velvia 100',
    blurb:
      'Velvia-level saturation with a neutral-to-cool white balance and slightly gentler contrast than the 50 — flashier, marginally more forgiving.',
    gain: [1.03, 1.0, 1.0], // [E] less warm than RVP50
    matrix: [
      // shared with RVP50 (r3: "start from Velvia 50")
      1.14, -0.1, -0.04, -0.08, 1.16, -0.08, -0.04, -0.12, 1.16,
    ],
    // Slightly gentler S than the 50 (still High). [E]
    curve: [
      [0, 0],
      [0.12, 0.07],
      [0.25, 0.19],
      [0.5, 0.5],
      [0.75, 0.82],
      [0.88, 0.94],
      [1, 1],
    ],
    saturation: 1.28, // [E] eased from 1.33
    grain: { intensity: 0.01, grainSize: 2 }, // ISO 100 / RMS 8 [E]
    halation: { intensity: 0.08, threshold: 0.8 },
  },

  // 3. PROVIA 100F (RDP III) — the neutral, all-round professional slide.
  // [M] colour "natural"; saturation High but a clear step below Velvia; contrast
  // Standard; finest grain (RMS 8); holds highlights far better than Velvia.
  {
    name: 'provia100f',
    displayName: 'Provia 100F',
    blurb:
      'The slide-family calibration baseline: clean, accurate, natural colour with a gentle standard-contrast curve and intact highlights. Restraint, not punch.',
    gain: [1.0, 1.0, 1.02], // [E] faint cool/clean cast
    matrix: [
      // near-identity, mild green purity [E]
      1.06, -0.04, -0.02, -0.03, 1.07, -0.04, -0.02, -0.06, 1.08,
    ],
    // Gentle normal S, standard contrast, highlights held to 1.0 via soft shoulder. [E]
    curve: [
      [0, 0],
      [0.15, 0.12],
      [0.5, 0.5],
      [0.82, 0.86],
      [1, 1],
    ],
    saturation: 1.14, // [E] "High but < Velvia"
    grain: { intensity: 0.009, grainSize: 2 }, // finest of the line, RMS 8 [E]
    // halation off — Provia holds highlights cleanly (restraint).
  },

  // 4. ASTIA 100F (RAP) — the soft portrait/fashion slide; the anti-Velvia.
  // [M] colour "real"; saturation Standard (lowest of the line); contrast Soft;
  // RMS 7 (finest). The only slide here that should NOT clip.
  {
    name: 'astia100f',
    displayName: 'Astia 100F',
    blurb:
      'Soft, low-contrast slide with a lifted toe and held-back shoulder, faithful but gently muted colour, and creamy skin. Designed not to clip.',
    gain: [1.0, 1.0, 1.01], // [E]
    // No matrix — r3 keeps it faithful (no green boost).
    // SOFT curve: lifted toe (0,0.03), pulled shoulder (1,0.98), low slope. [E]
    curve: [
      [0, 0.03],
      [0.12, 0.12],
      [0.5, 0.5],
      [0.85, 0.82],
      [1, 0.98],
    ],
    saturation: 1.0, // [E] r3 ×1.04 "or even ×1.00"; held at 1.0 for the faithful soft read
    grain: { intensity: 0.009, grainSize: 2 }, // RMS 7, finest [E]
    // halation off.
  },

  // 5. FUJICOLOR PRO 400H — C-41 negative; the marquee pastel/wedding look.
  // [M] datasheet spine: "clearer colours in the highlights and appropriately
  // reduced colour saturation in the shadows" → lift + desaturate highlights,
  // desaturate shadows. Cool cyan-leaning highlights, denser/cooler greens,
  // clean desaturated shadows, low contrast, ~10-stop latitude.
  {
    name: 'pro400h',
    displayName: 'Fujicolor Pro 400H',
    blurb:
      'Airy low-contrast pastel: cyan-leaning desaturated highlights, cool dense greens, clean desaturated shadows. Highlights drift cyan/white, never warm.',
    gain: [0.99, 1.0, 1.04], // [E] overall cool lean
    matrix: [
      // green row pulls red+blue out → denser, cooler greens; skin kept faithful [E]
      1.04, -0.02, -0.02, -0.05, 1.08, -0.03, -0.02, -0.04, 1.06,
    ],
    // Master = LOW contrast, lifted toe (airy), soft shoulder; drives G. [E]
    curve: [
      [0, 0.04],
      [0.15, 0.16],
      [0.5, 0.51],
      [0.8, 0.8],
      [1, 0.96],
    ],
    // R pulled progressively DOWN toward the highlights (less red up top). [E]
    curveR: [
      [0, 0.04],
      [0.15, 0.155],
      [0.5, 0.5],
      [0.8, 0.78],
      [1, 0.93],
    ],
    // B lifted in shadows (cool clean shadows) AND in highlights (push them cyan). [E]
    curveB: [
      [0, 0.07],
      [0.15, 0.18],
      [0.5, 0.51],
      [0.8, 0.82],
      [1, 0.99],
    ],
    // Cyan highlights are encoded by the R/B/G curve split: at white R→0.93,
    // G→0.96, B→0.99, so the brightest tones lose red and gain blue → cyan/white,
    // never warm. In shadows R/G→0.04 but B→0.07 → cool, clean blacks.
    saturation: 0.92, // [E] low overall (the luma-windowed shadow/highlight desat has no slot here)
    grain: { intensity: 0.014, grainSize: 2.5 }, // looks grainier than RMS-4 implies [E]
    // halation deliberately off: r3's optional warm bloom would fight the
    // cyan-highlight signature, so it is omitted to keep highlights cool.
  },

  // 6. SUPERIA X-TRA 400 — C-41 consumer negative; the colour-pop snapshot look.
  // [M] vivid Fuji greens + punchy blues, higher contrast/saturation than Pro 400H,
  // a cool green-cyan cast in shadows (and green under fluorescent), visible grain.
  {
    name: 'superia400',
    displayName: 'Superia X-TRA 400',
    blurb:
      'Lively consumer pop: boosted Fuji greens and punchy blues, snappy contrast, and a cool green-cyan shadow cast, with visible grain.',
    gain: [1.0, 1.03, 1.02], // [E] green+cyan lean (classic Fuji consumer cast)
    matrix: [
      // boost green presence, cool shadows [E]
      1.08, -0.05, -0.03, -0.04, 1.12, -0.06, -0.03, -0.05, 1.1,
    ],
    // Master = moderately punchy S; drives R. [E]
    curve: [
      [0, 0.02],
      [0.15, 0.13],
      [0.5, 0.5],
      [0.82, 0.85],
      [1, 0.99],
    ],
    // G lifted in shadows + mids → the green-cyan cast. [E]
    curveG: [
      [0, 0.04],
      [0.15, 0.15],
      [0.5, 0.52],
      [0.82, 0.86],
      [1, 1],
    ],
    // B lifted slightly in shadows (cyan, not pure green) → green-CYAN. [E]
    curveB: [
      [0, 0.03],
      [0.15, 0.135],
      [0.5, 0.5],
      [0.82, 0.84],
      [1, 0.98],
    ],
    // Shadow split R 0.02 < B 0.03 < G 0.04 → green-cyan cast in the blacks.
    saturation: 1.18, // [E]
    grain: { intensity: 0.016, grainSize: 2.5, colorAmount: 0.1 }, // consumer, visible chroma grain [E]
    // halation off.
  },
];
