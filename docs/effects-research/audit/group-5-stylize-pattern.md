# Group 5 Audit — Stylize / Pattern / Halftone / Dither / Sketch / Painterly

File audited: `/Users/paul/Desktop/Active Projects/Cursor Projects/imager2/src/lib/effects.ts`
Helpers: `/Users/paul/Desktop/Active Projects/Cursor Projects/imager2/src/lib/effects/color-space.ts`
Dispatch switch: `getFilterForEffect` ~L382–678. Shared math helpers L104–142, L10326–10369.

## Shared-helper notes (affect many effects below)

- `computeGrayscale` (L10326): Rec.601 luma, alpha-aware. Correct.
- `sobelMagnitude01` (L10339): **real 3×3 Sobel**, gx/gy, `(|gx|+|gy|)/2040` normalize (2040 = 8·255). Correct, used by posterEdges/toon/cutout/watercolor.
- `pseudoNoise01` (L10357): deterministic GLSL hash `frac(sin(x·12.9898+y·78.233)·43758.5453)`. Position-seeded (good — no per-render flicker).
- `mulberry32` exists in color-space.ts and `createPixelExplosionEffect` (L9229) already uses a seeded LCG — so the **unseeded `Math.random()` effects below are oversights, not constraints.**
- Error-diffusion core `applyErrorDiffusion` (L11998) is genuinely well done: diffuses on a **Float32 buffer**, clamps only on final write (comment explains it fixes highlight/shadow error-clamping). Kernels are textbook-correct.

---

## REAL (11)

### oilPainting → createKuwaharaEffect — L7063 cfg / L468 dispatch / L1692 impl

- **REAL Kuwahara filter** (the canonical oil/painterly algorithm). 4 quadrants (TL/TR/BL/BR), single-pass variance `E[X²]−E[X]²` summed over RGB, picks min-variance quadrant mean. Deterministic.
- Granularity: `radius` (1–10 Brush Size), `intensity` (cfg exposes it but impl ignores it — only radius+opacity used), `opacity`. Missing: anisotropic/generalized Kuwahara would kill the blocky quadrant artifacts; `intensity` is a dead slider.
- **Verdict: REAL, best-in-group.** Top fix: honor `intensity` (e.g. blend strength) or drop the slider; optional upgrade to generalized Kuwahara.

### pencilSketch — L6079 cfg / L977 impl

- **REAL classic color-dodge sketch**: grayscale → invert → stackBlur → color-dodge blend (`base·255 / (255−blur)`), then contrast. This is THE Photoshop pencil technique. Deterministic, alpha-aware, buffer-pooled.
- Granularity: intensity (mapped to dodge mix), lineWeight→blur radius, contrast, opacity. Good. Missing: paper grain, graphite directionality.
- **Verdict: REAL.** Top fix: none critical; optional graphite grain via `pseudoNoise01`.

### halftone — L6160 cfg / L1172 impl

- **REAL AM (amplitude-modulated) halftone**: rotated lattice via `round(rotated/spacing)*spacing`, dot radius ∝ (1−brightness), drawn with **Canvas2D `ctx.arc`** (true round AA dots), cream paper bg, dark-blue ink. Single screen angle, single (mono) channel.
- ⚠ Uses `document.createElement('canvas')` → **will not run in a Web Worker** (DOM-dependent).
- Granularity: dotSize, spacing, angle, opacity. Missing: dot shape (round/line/square/euclidean), CMYK multi-angle color.
- **Verdict: REAL but mono + DOM-bound.** Top fix: add CMYK option (halftonePattern already proves the pattern) and a worker-safe path.

### dotScreen — L7592 cfg / L2049 impl

- **REAL AM dot screen**: rotated coords, nearest cell center via `round()`, dotRadius ∝ (1−avg/255)·scale·0.6, B&W output. No AA (binary pixel test) → slightly aliased vs halftone's arc.
- Granularity: scale, angle, opacity. Missing: shape, color/CMYK, AA.
- **Verdict: REAL (single channel).** Top fix: anti-alias dot edge (smoothstep on distToCenter) + CMYK.

### halftonePattern — L8750 cfg / L12261 impl

- **REAL AM halftone with B&W and CMYK modes.** CMYK uses the **classic process screen angles C15°/M75°/Y0°/K45°** (L12337–12340) and ink amount = 255−channel (K = 255−min(RGB)), `Math.min` to composite subtractively onto white. Radius ∝ ink coverage. This is the most complete screen in the group.
- Granularity: dotSize, angle, colorMode(B&W/CMYK), contrast. Missing: dot shape, per-channel angle override, GCR/UCR for K.
- **Verdict: REAL, the model halftone.** Top fix: expose dot shape + anti-alias the rasterized dots.

### advancedDithering — L8592 cfg / L11917 impl

- **REAL error diffusion**: FS, Atkinson (divisor 8, 6 unit taps — correct), Stucki (÷42), Sierra (÷32), all via the float-buffer `applyErrorDiffusion`. Ordered = **real Bayer** with `(M+0.5)/n²` centering (L12125, comment correctly notes plain M/n² injects DC darkening). "Blue Noise" = IGN approximation.
- **BUG (palette):** `palette` 4=GameBoy / 5=CGA just set `levels=4` (L11951–11956) — the **named palettes are never applied**; it only quantizes each RGB channel to N levels. So "GameBoy"/"CGA" produce generic 4-level color, not the green GB / cyan-magenta CGA palette (the `PALETTES` table at L11812 exists but isn't used here — only `retroPalette` uses it). Also "B&W" = 2 levels **per channel** = 8 RGB-corner colors, not true 1-bit gray.
- Granularity: algorithm(6), palette(6, two broken), threshold, patternScale, contrast. Missing: **serpentine/boustrophedon scan** (reduces directional worming), real palette mapping, per-channel-vs-luma toggle.
- **Verdict: REAL engine, broken palette wiring.** Top fix: route palette 4/5 through `findNearestColor(PALETTES.gameboy/cga)`; add serpentine.

### atkinsonDithering — L8644 cfg / L12192 impl

- **REAL Atkinson** via shared `ATKINSON_KERNEL` (÷8, 6/8 of error diffused — the authentic classic-Mac look). colorMode 0/1 grayscale-convert first; mode 2 dithers RGB. levels honored.
- Granularity: colorMode(3), levels, threshold. Missing: serpentine.
- **Verdict: REAL.** Top fix: serpentine scan.

### orderedDithering — L8677 cfg / L12218 impl

- **REAL Bayer ordered dither**: matrixSize→BAYER_2x2/4x4/8x8 (matrices are the correct recursive van-der-Corput permutations, L11788–11809), `(M+0.5)/n²` centered, `spread` scales threshold offset.
- Granularity: matrixSize(2/4/8), colorMode, levels, spread. Good coverage. Missing: void-and-cluster / blue-noise mask option.
- **Verdict: REAL.** Top fix: none critical.

### posterEdges — L7190 cfg / L10645 impl

- **REAL**: per-channel posterize to N levels + Sobel-magnitude edge ink (`lerp(color,0,line)`). Classic "Poster Edges". Deterministic, alpha-aware, pooled.
- Granularity: levels, edgeThreshold, edgeStrength, opacity. Good.
- **Verdict: REAL.** Top fix: none.

### toon — L7139 cfg / L10748 impl

- **APPROX→REAL cartoon**: stackBlur (smoothness) → posterize → Sobel edge darkening. The textbook cheap toon is bilateral-filter + quantize + edge; stackBlur is a reasonable stand-in for the edge-preserving smooth. Deterministic.
- Granularity: smoothness, levels, edgeThreshold, edgeStrength, opacity. Good.
- **Verdict: REAL (stackBlur substitutes for bilateral).** Top fix: swap stackBlur→bilateral/Kuwahara for cleaner flats.

### asciiArt — L7771 cfg / L2445 impl

- **REAL luminance→glyph-density ramp.** 10 hand-built 8×8 bitmap glyphs ordered by fill % (space `.` `:` `-` `+` `*` `#` `%` `@` `█`); per cell: average luma → `floor((1−bright)·10)` → render that glyph's bitmap scaled into the square cell. This is the canonical ASCII mapping; monospace square-cell sampling is correct. B&W only, bitmap (not real font text).
- Granularity: **only `scale` (cell size)**. Missing: charset selection, color/terminal-green mode, invert, real font glyphs, aspect-correct cells.
- **Verdict: REAL core, thin controls.** Top fix: add color mode + invert + charset choice.

---

## APPROX (9)

### watercolor — L7097 cfg / L10815 impl

- **The "gaussian + noise" fake the brief warns about.** `lerp(original, stackBlur, intensity)` + Sobel edge-darken + `pseudoNoise01` paper grain. No pigment density, no wet-in-wet bleeding, no edge-darkening-from-pigment-accumulation, no color abstraction, no granulation tied to luminance.
- Canonical: Bousseau et al. "Interactive Watercolor" — abstraction (mean/Kuwahara) + wobble + **edge darkening via Gaussian-of-difference** + pigment granulation + turbulence. At minimum should reuse Kuwahara for abstraction.
- Granularity: intensity(wash), edges, texture, opacity. Deterministic (good).
- **Verdict: APPROX/cosmetic.** Top fix: base on Kuwahara abstraction + true edge-darkening (darken where blurred<original), granulation ∝ luma.

### crosshatch — L7559 cfg / L1945 impl

- **APPROX (legit tonal hatching).** 4 hatch angles (45/135/90/0) each gated by escalating darkness thresholds (0.15/0.35/0.55/0.75) → darker regions accumulate more line families — this is correct engraving/hatching logic, tone-driven. Lines via `(x·cos+y·sin) % spacing`. NOT edge-based (fine for shading).
- ⚠ Paper texture uses **unseeded `Math.random()`** (L2038) → preview≠export flicker (texture only).
- Granularity: spacing, strength, opacity. Missing: angle control, ink color.
- **Verdict: APPROX, good intent.** Top fix: seed the noise with `mulberry32`.

### unifiedSketch — L6098 cfg / L1067 impl (5 presets)

- Base = **real Sobel** (kernel center weights scaled by lineWeight — unusual but functional). Presets: 0 Pencil (`255−mag·density`, real edge), 4 Bold Outline (`mag>thr?0:255`, real edge) are solid. 1 Crosshatch = `sin((x+y))`/`sin((x−y))` gated by magnitude — **binary, edge-keyed not tone-keyed** (the standalone `crosshatch` is better). 2 Etched = `sin(angle·3)` modulation (cosmetic). 3 Ink Wash uses **unseeded `Math.random()`** (L1140).
- Granularity: style, lineWeight, density, contrast, invert, opacity. Good breadth.
- **Verdict: APPROX (2 real presets, 3 weak).** Top fix: seed Ink Wash; make Crosshatch tone-driven like the standalone.

### unifiedPattern — L6171 cfg / L1308 impl (4 patterns)

- 0 Dots = real rotated halftone (binary, no AA). 1 Screen = `(rx%size + ry%size)` line threshold (rough line screen). 2 Dither = **FAKE Bayer**: `((dx + dy·4)·17) % 255` (L1372) is a linear hash, **not the real 4×4 Bayer matrix** → diagonal banding, not an ordered pattern. 3 Stipple = GLSL hash (deterministic white noise, not blue-noise).
- Granularity: pattern, size, density, angle, colorMode(B&W/Original), opacity.
- **Verdict: APPROX, with one real bug (pattern 2).** Top fix: replace fake Bayer with the real `BAYER_4x4` table already in the file.

### cutout — L7232 cfg / L10693 impl

- **APPROX.** stackBlur(soften) → per-channel posterize → Sobel edge darkening. Approximates a posterized paper-cutout but is essentially posterEdges-on-blur; real "cutout" wants flat connected regions (mean-shift / k-means color regions / region merge), not per-pixel channel quantize.
- Granularity: levels, edgeStrength, soften, opacity.
- **Verdict: APPROX.** Top fix: region-based quantization (mean-shift or palette k-means) for true flat shapes.

### retroPalette — L8788 cfg / L12408 impl

- **APPROX/REAL.** Real `findNearestColor` against the genuine `PALETTES` (GameBoy/CGA/EGA/C64/NES/Macintosh, L11812). Dithering 0=none, 1=Atkinson-with-palette (full FS-style diffusion onto palette, ÷8), 2=ordered. The actual retro-palette effect (advancedDithering should call this).
- Granularity: palette(6), dithering(3), ditherStrength. Good.
- **Verdict: APPROX→REAL palette mapping.** Top fix: none major; could add serpentine.

### inkBleed — L9130 impl (cfg: amount/intensity/strength/softness)

- **APPROX (deterministic).** Dark pixels (luma<threshold) scatter their color into a radius ∝ darkness with linear distance falloff — a directional dark-ink dilation. No iteration, no capillary/wet diffusion, but a legitimate ink-spread approximation. Deterministic (no random). Minor: self-term `+r·(1+soften·0.6)` can over-brighten.
- **Verdict: APPROX.** Top fix: iterate (multi-pass) or Gaussian-weight for smoother capillary bleed.

### blueNoiseDithering ("Gradient Noise Dithering") — L8718 cfg / L12240 impl

- **APPROX, honestly labeled.** `generateBlueNoise` (L12173) is **Interleaved Gradient Noise (Jimenez)**, not blue noise — no void-and-cluster, no spectral high-pass. Config label was renamed to "Gradient Noise Dithering" with a comment admitting this (L8719). Deterministic, threshold ∝ (noise−0.5)/levels.
- Granularity: colorMode, levels, noiseScale.
- **Verdict: APPROX (label honest).** Top fix: ship a real precomputed void-and-cluster blue-noise tile to deliver actual blue-noise spectrum.

### retroDithering — L8577 cfg / L11747 impl

- **APPROX (legacy FS).** Floyd-Steinberg per-channel but **accumulates error directly into the Uint8ClampedArray** (clamps/loses error at extremes) — the exact bug the newer `applyErrorDiffusion` was written to fix. Quantizes each channel to `levels`. Works, looks fine, but is the inferior path.
- Granularity: **only `levels`** (2–8).
- **Verdict: APPROX (superseded).** Top fix: route through `applyErrorDiffusion(FLOYD_STEINBERG_KERNEL)`; add palette/colorMode.

---

## COSMETIC (2)

### stainedGlass — L7274 cfg / L10883 impl

- **COSMETIC.** It's a **square-grid block average with darkened cell-edge borders** — i.e. a mosaic with lead-looking gridlines. Real stained glass = irregular **Voronoi cells** (or segmented regions) with organic lead came between them. Square grid reads as pixelate/mosaic, not glass.
- Granularity: cellSize, borderThickness, borderDarkness, opacity.
- **Verdict: COSMETIC.** Top fix: replace grid with jittered Voronoi cells (the crystallize code already has Voronoi — share it) + draw lead on cell boundaries.

### stippling — L7475 cfg / L802 impl

- **COSMETIC + unseeded.** Random-scatter rejection sampling: throw `maxDots` random points, keep with probability ∝ darkness, draw a disc (or hatch line). Uses **`Math.random()`** for both position and acceptance (L823, L824, L832) → **preview≠export, re-renders flicker**, and clumpy white-noise distribution.
- Canonical: **Weighted Voronoi Stippling (Secord 2002)** or Poisson-disk / blue-noise point sets for even, organic dot spacing.
- Granularity: density, dotSize, useHatching, opacity.
- **Verdict: COSMETIC, worst-distributed.** Top fix: seed with `mulberry32` (immediate); longer-term Poisson-disk/weighted-Voronoi sampling.

---

## BROKEN (1)

### crystallize — L11328 impl — **DOUBLE-BROKEN**

1. **Not wired.** Listed in UI (`effectCategories.Stylize` L11110 and `src/lib/effects/categories.ts:61`) but has **no `effectsConfig['crystallize']` entry** (no label/settings) **and no `case 'crystallize':`** in the dispatch switch → falls to `default:` (L675) → `return [null, null]` + `console.warn('Unknown effect')`. **Selecting it in the UI does nothing.** `createCrystallizeEffect` is dead/unreachable code.
2. **Unseeded even if wired.** Crystal centers use `Math.random()` (L11339–11340) → non-deterministic; preview≠export. Also O(pixels × crystals) brute-force nearest-center (no spatial grid) → slow on large images.

- The algorithm itself (jittered-grid Voronoi → fill each pixel with nearest center's color) is otherwise correct and would be REAL once seeded.
- **Verdict: BROKEN.** Top fix: add a config block + dispatch case (or remove from categories), then seed centers with `mulberry32` and add a spatial-grid nearest lookup.

---

## Cross-cutting findings

- **Unseeded `Math.random()`** in stippling (L823/824/832), crosshatch noise (L2038), unifiedSketch ink-wash (L1140), crystallize (L11339/40). All should use `mulberry32` — the codebase already does in pixelExplosion. This is the single most common defect and breaks preview/export parity.
- **Fake Bayer** in unifiedPattern pattern 2 (L1372) while a correct `BAYER_4x4` table sits in the same file (L11793).
- **Unused palette wiring**: advancedDithering's GameBoy/CGA options ignore the `PALETTES` table; only retroPalette uses it.
- **No serpentine scan** in any error-diffusion path (all left-to-right) → mild directional worming.
- **Granularity gaps**: halftone/dotScreen lack shape + CMYK; dither lacks serpentine + real palette; ascii lacks charset/color/invert.
- **DOM dependency**: `createHalftoneEffect` uses `document.createElement` → not worker-safe (others are pure typed-array).
