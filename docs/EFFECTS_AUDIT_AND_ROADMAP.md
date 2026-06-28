# HAX Effects — Deep Audit, Film-Science Research & Build Roadmap

_June 2026. Synthesis of a 13-agent pass: 6 audited the ~110 live effects at source level; 7 researched documented film science + new effects. Full working reports live in `docs/effects-research/` (audit/ + research/, ~5,300 lines, sourced)._

> **Goal of the tool (the lens for every decision below):** a designer manipulates an image in seconds, in ways that would take ages in Photoshop, **with full granular control and without damaging quality.** That goal indicts three things the audit found everywhere: math done in the wrong color space, jaggy nearest-neighbor warps, and "looks" that are ad-hoc rather than grounded.

---

## 1. Executive summary

**The engine's bones are good; the surface is uneven.** Blur (separable, Kovesi stack-blur), bloom/halation (linear-light), oilPainting (real Kuwahara), dithering/halftone (textbook kernels), smartSharpen (real edge-aware unsharp), and the **Smart Randomizer** (slot-based, mood-weighted, OKLCH-bound, deterministic) are genuinely well-built. But a large middle tier runs correct algorithms **in the wrong color space**, a cluster of "special FX" are **content-independent gimmicks**, and a handful are **broken or mislabeled**.

**Classification of ~110 effects** (REAL = grounded algorithm; APPROX = plausible but ad-hoc constants; COSMETIC = trivial/gimmick; BROKEN = bug/no-op):

| Group                    | REAL      | APPROX              | COSMETIC | BROKEN |
| ------------------------ | --------- | ------------------- | -------- | ------ |
| Adjust / Tone (12)       | 8         | 2                   | 1        | 0      |
| Color grading (13)       | 3         | 7                   | 1        | 1      |
| Film / Vintage / Glow    | glow REAL | **all film stocks** | —        | grain  |
| Blur / Warp (17)         | 5         | 8                   | 2        | 2      |
| Stylize / Pattern (23)   | 11        | 9                   | 2        | 1      |
| Glitch / Special-FX (31) | 16        | 10                  | 4        | 1      |

**Six systemic problems** (each is one fix that lifts many effects):

1. **Unseeded `Math.random()` in ~15+ effects → the live preview never matches the export**, and grain/glitch re-roll on every slider nudge. The repo already ships a seeded PRNG (`mulberry32`) used by exactly one effect. _This is the #1 bug._
2. **Math on gamma-encoded bytes.** Only `colorTemperature`, the buried exposure LUT, and the bloom/halation blurs work in linear light. Contrast, brightness, blur (most), and every film look manipulate sRGB bytes directly → muddy mids, clipped flat highlights, hue shifts.
3. **No bilinear sampler exists** → every geometric warp (swirl, kaleidoscope, fisheye, spherize, wave, shatter) point-samples with `Math.round` → stair-step jaggies. _This is the literal "damage" to image quality._
4. **Color ramps interpolate in naive sRGB** (duotone, gradientMap) → muddy desaturated midtones, even though OKLab math (`oklch2rgb`) already ships in the repo.
5. **Dead / phantom controls & mislabeled effects.** Sliders that read settings the config never exposes (tiltShiftMiniature, temporalEcho, fractalNoise, many `opacity` sliders); effects that don't do what they're named (`sharpen`=Konva Enhance, `cinematicLut`≠a LUT, `relight`≠lighting, `stainedGlass`=mosaic, `neuralDream`≠neural, `crystallize`=no-op).
6. **No film "substrate."** There is no per-channel tone-curve LUT and no 3D-LUT path — the foundation real film emulation requires. Highlights hard-clamp with no shoulder → they clip to flat white and band on 8-bit.

**The film stocks (the headline ask) are all APPROX** — hand-tuned channel multiplies on gamma bytes. The research gives us documented, citable specs to replace them with: per-channel characteristic curves, channel matrices, RMS-anchored grain, and a physically-correct halation model. **None of the good free film LUTs are safely licensed for a product** (CC-BY-NC-SA / GPL / unverified-trademark), so the plan is **parametric recipes we own**, with optional user-imported `.cube`. We can generate our own MIT-licensed LUTs from datasheets (JanLohse/spectral_film_lut) for internal A/B.

**The "Surprise me" randomizer is smart but undernourished:** its `EFFECT_META` vocabulary covers only ~31 of ~110 effects, so the film stocks, painterly, and print looks **never get composed**. And there is **no curated "Looks"/templates gallery** — the single highest-value _product_ addition.

---

## 2. The effects audit (detail)

### 2.1 What's genuinely good — keep & protect

- **Blur engine** (`OptimizedBlur.ts`): real separable Gaussian, Kovesi 3-box stack-blur, edge-bias bug already fixed.
- **Glow family** (bloom, neonGlowEdges, bioluminescence, unifiedGlow, Cinestill halation): blur in **linear light** — the correct bloom mechanism.
- **oilPainting** (genuine Kuwahara), **dithering** (Floyd–Steinberg / Atkinson kernels on a Float32 error buffer + real centered Bayer), **halftone/dotScreen/halftonePattern** (real AM rotated-lattice screens; halftonePattern has correct CMYK angles C15/M75/Y0/K45), **asciiArt** (correct luminance→glyph ramp), **pencilSketch** (color-dodge), **smartSharpen** (real edge-aware unsharp, full pro controls).
- **colorTemperature**: the model citizen — linear-light, luminance-preserving channel gains.
- **Smart Randomizer**: see §4.

### 2.2 Broken / no-op (fix or remove first — these are visibly wrong)

- **`thermalPalette`** — listed + dispatched but has **no `effectsConfig` entry** → no label, no sliders; its one param is stuck mid-range so the black & white-hot bands are mathematically unreachable. Duplicates `heatmap`.
- **`crystallize`** — shown in the UI but has no config and no dispatch case → falls through to no-op; `createCrystallizeEffect` is dead code.
- **`tiltShiftMiniature`** — reads `settings.focalLength`/`aperture`; config exposes `focusY`/`focusHeight`/`blurStrength`/`saturation`. **All four sliders are dead**; output hardcoded.
- **`fractalNoise`** — flat `Math.random()` gray noise (not fBm); `scale` + `blendMode` sliders dead; unseeded.
- **`pixelExplosion`** — forward-mapped → leaves holes/gaps.
- **`temporalEcho`** — `echoes` hardcoded, `offset` reads a phantom setting → 2 of 3 sliders are no-ops.

### 2.3 Mislabeled (rename or re-implement to match the promise)

- **`sharpen`** → maps to `Konva.Filters.Enhance` (a contrast/saturation stretch). Not sharpening. (A real one, smartSharpen, exists but isn't on the main switch.)
- **`cinematicLut`** → parametric curves, not a LUT; also applies `strength` twice.
- **`relight`** → a screen-space brightness wedge, no dependence on image content; `ambient` is a global gain, not a floor.
- **`stainedGlass`** → square-grid block-average with dark gridlines (a mosaic). Real version = Voronoi cells + lead came.
- **`neuralDream` / `holographicInterference` / `liquidMetal` / `crystalFacet`** → fixed positional patterns; the image barely participates.
- **`colorQuantization`** "Number of Colors" is actually levels-per-channel (→ up to N³ colors), no true palette reduction.

### 2.4 The cross-cutting fixes (do these as shared infrastructure)

| Fix                                                                                            | Lifts                                                                                                                                      | Effort |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| **F1. Seed all stochastic effects** via `mulberry32(settings.seed)` + a Seed control           | grain, stippling, glitch/VHS/databend, liquidMetal, paperRelief/cut, weave, fractalNoise, unifiedPrint registration, scratches/dust (~15+) | S      |
| **F2. Shared `sampleBilinear()`** + route all backward-mapped warps through it                 | swirl, kaleidoscope ×2, fisheye, spherize, pinch, wave, shatter, dispersion                                                                | S–M    |
| **F3. Linear-light helpers already exist — apply them** to contrast, brightness, blur defaults | tone fidelity across the Adjust group + blurs                                                                                              | M      |
| **F4. OKLab interpolation** for color ramps (reuse `oklch2rgb`)                                | duotone, gradientMap                                                                                                                       | S      |
| **F5. Sweep dead/phantom controls**; wire `opacity` everywhere it's declared                   | threshold, chromaticAberration, edgeDetection, cellular, tiltShift, temporalEcho, fractalNoise                                             | S      |
| **F6. Real `sharpen`** = luminance unsharp mask (or alias to smartSharpen)                     | sharpen                                                                                                                                    | S      |

---

## 3. Film emulation — the real plan

### 3.1 Build the substrate (this is the keystone; everything else plugs in)

A new module — call it `src/lib/effects/film/substrate.ts` — providing a **physically-ordered pipeline** every stock runs through:

```
sRGB byte → linear (SRGB_TO_LINEAR LUT)
  → white-balance / channel matrix (3×3 or per-channel gain)   [the cast]
  → per-channel characteristic curve with toe + shoulder       [the contrast & crossover]
  → saturation (global + per-hue), in a perceptual space       [the color signature]
  → back to display, dithered                                  [no banding]
  → halation pass (linear-light, reusable)                     [the glow]
  → seeded structured grain (display space, last)              [the texture]
```

Primitives needed (all cheap, all CPU-JS):

- **Per-channel tone curve → 256-byte LUT.** Author curves as monotone-cubic control points (input→output, 0–1); prebake to a `Uint8ClampedArray` per channel per render. A **highlight shoulder** (soft roll-off instead of hard clamp) is non-negotiable — it's what stops the flat clipped highlights.
- **3×3 color matrix** apply in linear light.
- **Optional 33³ `.cube` trilinear evaluator** for accurate cross-channel emulation and for user-imported LUTs. Cost ≈ 60–150 ms/MP single-thread (tileable to the existing Worker pool); 33³ is the sweet spot (17³ bands, 65³ wasteful). Dither the 8-bit output.

Verdict from research: **ship both** — the parametric curves+matrix core for live, instant tweaking, and the `.cube` path for fidelity / BYO-LUT.

### 3.2 The correct halation module (reusable across all stocks)

Do it all in **linear light** (light scatter is additive):

1. Linearize; linear luma `Y = 0.2126R+0.7152G+0.0722B`.
2. Soft highlight mask: `e = smoothstep(T, T+knee, Y)`, `energy = pow(e, P)` — defaults `T=0.55`, `knee=0.25`, `P=1.6` (super-linear: brighter sources halate disproportionately).
3. Tint orange-hot-core → red-outer-rim: `mix(RED(1.0,0.07,0.05), ORANGE(1.0,0.32,0.10), energy)`. The radial orange→red gradient is the authentic tell.
4. **Two summed blurs** — ring + bloom: `σ_core ≈ 0.004·maxDim`, `σ_bloom ≈ 0.025·maxDim` (fractions of image size → resolution-independent), weights 0.7 / 0.45.
5. Recombine via **screen**: `out = 1−(1−base)(1−halo·intensity)`; `intensity` 0.3 (subtle) → 0.8 (Cinestill).

_Why red: film layer order is blue→green→red(deepest); light penetrates, reflects off the pressure plate, returns with blue/green absorbed → re-exposes the red layer. Cinema film blocks this with a remjet backing; Cinestill strips it → halation in C-41._

### 3.3 The correct grain module (reusable; replaces the broken one)

Distilled from Newson et al., "Realistic Film Grain Rendering" (IPOL 2017):

- **mulberry32-hashed value noise** on a lattice of spacing `grainSize`, bilinear-upsampled, ~2 octaves, Gaussian-distributed → real spatial correlation (grain _size_) **and seeded** (preview == export).
- Amplitude ∝ **`sqrt(Y·(1−Y))`** — variance peaks in the **midtones** (matches Kodak's own statement that midtones look grainiest), × shadow/mid/high weights.
- Apply as **luminance** (R=G=B), optional small per-channel chroma (`colorAmount` default 0); in display space, **after** the look.
- UI: `intensity` (map to Kodak RMS granularity — slide stocks 8–13, fine neg as low as 5), `grainSize` 1–6px, shadow/mid/high weights, `colorAmount`, `seed`.

### 3.4 The stocks — documented specs (full numbers in `docs/effects-research/research/`)

Every recipe below is in the per-research file with confidence tags ([M]easured / [E]stimated) and source URLs. The **one trait to nail** per stock:

**Kodak negative — `r1-kodak-negative.md`**

- **Portra 400** ⭐ — warm-highlight / cool-shadow **split-tone at low contrast**, huge highlight latitude. Measured per-layer slopes R 0.545 / G 0.554 / B 0.638.
- **Portra 160 / 800** — same split-tone; 160 finer & micro-contrastier, 800 opener shadows + visible grain.
- **Ektar 100** — high blue/green saturation + steeper contrast, near-grainless. Not a skin stock.
- **Gold 200** — yellow/warm nostalgic cast, more contrast than Portra.

**Kodak reversal + Kodachrome — `r2-kodachrome-ektachrome.md`** (best research; current code gets this WRONG)

- **Kodachrome 64** ⭐ — **NOT** global oversaturation. Four documented pillars: (1) deep, dense, shadow-weighted blacks (moody); (2) a **warm/cool crossover split-tone** (reds/skin warm, shadows/skies cool-cyan — the red layer peaks ~650nm); (3) **selective red saturation** ("NatGeo red"), only ~+10% global; (4) very fine grain + high acutance, **no halation**. The gamut fits inside sRGB. _Current `applyKodachrome` does the naive opposite (global +40% sat, lifted blacks) — replace it._
- **Ektachrome E100** — the clean opposite: cool-neutral, whiter whites, open low-contrast shadows, faithful skies/greens, very fine grain. (E100VS = the punchy high-sat variant people often mean by "slide film.")

**Fujifilm — `r3-fuji.md`**

- **Velvia 50** ⭐ — maximal green+red saturation on a steep clipping curve, faint warm bias.
- **Provia 100F** — the neutral reference; nail _restraint_.
- **Astia 100F** — soft portrait slide; lifted-toe/held-shoulder, slightly muted skin (the only slide that shouldn't clip).
- **Pro 400H** ⭐ — airy pastel: **cyan-leaning desaturated highlights** (must drift cyan, never warm) + cool dense greens + clean desaturated shadows.
- **Superia 400** — vivid consumer pop: boosted Fuji greens + cool green-cyan shadow cast.

**Cinema & specialty — `r4-cinema-halation.md`**

- **Cinestill 800T** ⭐ — four tells: red halation (hero, intensity 0.6–0.8), cool teal shadows (tungsten, gains R0.90/G1.00/B1.15), warm amber highlights (split-tone), lifted blacks + moderate grain. Based on Vision3 500T.
- **Kodak Vision3 250D / 500T** — the cine-neg "cinematic" curve; daylight vs tungsten balance, ~10-stop latitude.
- **Cross-process** — steep S-curve + hard shoulder, sat +30–50%, shadows cyan-green / highlights yellow (Fuji) or warm (Kodak).

**Black & white — `r5-bw.md`** (these need real **channel mixing**, not Rec.709 luma)

- Per-stock RGB→gray weights (linear, ΣW=1) + RMS grain + contrast character:
  - **Tri-X 400** ⭐ 0.25/0.35/0.40 · RMS 17 cubic/gritty · medium contrast, soft long shoulder (forgiving highs).
  - **HP5+ 400** 0.23/0.37/0.40 · RMS ~18 · low contrast, very forgiving.
  - **T-Max 100/400** 0.25/0.40/0.35 · RMS 8/10 tabular · high acutance, straight line; T-Max is deliberately blue-_reduced_ (darker, natural skies).
  - **Acros 100** 0.25/0.40/0.35 · RMS 7 · finest, smoothest. **Delta 3200** coarse, veiled, heavy grain.
  - Documented finding: classic films are **blue-heavy** (~0.40 B vs Rec.709's 0.07) → pale skies.
- **Contrast-filter control** (multiply weights, renormalize) anchored to Wratten factors: None / Yellow#8 / Orange#21 / Red#25 (2.40/0.55/0.08) / Green#58 / Blue#47, with a 0–100% strength lerp. This is a great granular control to expose.

### 3.5 Licensing decision

Ship **our own parametric recipes** (curves + matrices + grain + halation). The strong free LUT sets are CC-BY-NC-SA (Fuji profiles), GPL-3.0 / CeCILL (G'MIC, hald-clut), or MIT-but-trademark-disclaimed — none cleanly bundle in a product. For optional fidelity: **generate our own MIT-licensed `.cube` files from datasheets** with `JanLohse/spectral_film_lut` (MIT) and let users import their own `.cube`. Use third-party LUTs only for internal A/B calibration. ("Kodachrome", "Portra", etc. are trademarks — consider neutral display names with the stock as a subtitle, or a clear "emulation, not affiliated" note.)

---

## 4. The randomizer + a "Looks" gallery (the "templates" ask)

**The randomizer's brain is good — feed it.** (Full detail: `docs/effects-research/audit/track-c-randomizer-templates.md`.)

- **R-C1 ⭐ Build a "Looks" gallery** — ~12–16 curated, named, one-click, reproducible starting points spanning registers (film, cinematic, print, painterly, glitch, mono, dreamy). A Look is just `{seed, moodId, wildness}` or an explicit layer recipe; deterministic seeds make this trivial. One click to apply, **fully editable after** (stack stays decomposable / non-destructive). _This is the "templates" the user wants and the highest-value product addition._
- **R-C2 ⭐ Expand `EFFECT_META`** from ~31 → cover the high-value families it currently can't reach: **film stocks** (grade slot), print + painterly (stylize/grade), a few content-driven Special FX as hero gestures. Immediately enriches "Surprise me."
- **R-C3** Wire the new seeded grain + halation into film-bearing looks.
- **R-C4** Add 3–4 distinct moods (cinematic teal-orange, riso-poster, darkroom B&W, pastel) once coverage expands — the current 8 cluster around soft-vintage.
- **R-C5** Enforce the declared-but-unused `excl` exclusions; bias the "hero" pick toward strong slots (grade/stylize/glow/glitch).

---

## 5. Prioritized roadmap

**Phase 0 — Correctness foundation (no taste calls; do first).**
F1 seed-all-stochastic · F2 shared bilinear sampler · F5 dead-control sweep · fix the 6 broken/no-op effects (or remove). _All verifiable by tests + before/after renders; preview==export becomes true._

**Phase 1 — Film substrate.**
Build `film/substrate.ts` (per-channel curve LUT + matrix + shoulder, linear pipeline), the reusable **halation** module, and the reusable **seeded grain** module. Unit-test the curve/LUT math. _Foundation — no user-visible look change yet beyond corrected grain._

**Phase 2 — Real film stocks (the headline).**
Re-implement the 6 existing stocks on the substrate using the documented recipes; add the high-value new ones (Ektar, Gold, Velvia, Provia, Pro 400H, Kodachrome-corrected, Ektachrome, Tri-X/HP5/T-Max with channel-mix + contrast filters, Vision3, cross-process). **Each look gets a before/after render for approval before it lands** (visual = show-before-ship).

**Phase 3 — New pro effects (from `r7-novel-effects.md`).**
Must-haves: Clarity/local-contrast, Color Balance (lift/gamma/gain), Pro-Mist diffusion, Split Toning, Graduated ND, HSL Secondary, Surface Blur (bilateral). Cheapest first bundle (no new infra): Split Toning + Bleach Bypass + Channel Mixer + Exposure-Vignette. Promote the buried linear **Exposure** to a standalone effect; add `gamma`/`levels`.

**Phase 4 — Randomizer + Looks gallery.**
Expand `EFFECT_META`, build the curated Looks gallery, add moods, wire grain/halation, enforce `excl`.

**Phase 5 — Color-space + quality sweep.**
F3 (linear-light for contrast/brightness/blur), F4 (OKLab ramps), output dithering on quantizing effects, real `sharpen`, fix mislabeled effects.

---

## Appendix — stale docs to supersede

- `docs/new-effects-brainstorm.md` — ranks film emulation/B&W **last (Phase 4)** and is dominated by out-of-scope features for a client-side Konva pixel editor (AI background removal, AI upscaling, content-aware fill, healing brush). **Superseded by this document.**
- `docs/library-evaluation.md` — recommends **tsParticles**, which was purged in the recent dead-code cleanup. **Stale.**
- `CLAUDE.md` effects section lists Three.js, ControlPanelV2/V3, and "4 themes" — all since removed/replaced (theme-hax). Update when Phase 0 ships.
