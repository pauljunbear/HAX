# HAX Effects Audit — Group 3: Film, Vintage, Glow, Grain

Repo: `/Users/paul/Desktop/Active Projects/Cursor Projects/imager2`
Primary file: `src/lib/effects.ts` (12,756 lines)
Helpers: `src/lib/effects/color-space.ts`, `src/lib/effects/ortonEffect.ts`, `src/lib/effects/lightLeakEffect.ts`, `src/lib/performance/OptimizedBlur.ts`
Scope: read-only audit. No source modified.

Classification key: **REAL** (documented science / physically correct), **APPROX** (plausible ad-hoc look, not grounded), **COSMETIC** (decorative, no fidelity claim), **BROKEN** (placeholder, dead controls, or wrong math).

---

## 0. Headline findings (the film/grain story)

### 0.1 The film "looks" are ad-hoc gamma-byte channel multipliers, NOT characteristic curves

Every film stock in `createUnifiedFilmEffect` (impl `applyPortra400`…`applyKodachrome`, lines 4737–4959) is a hand-tuned set of per-channel multiply+add+contrast operations applied **directly to the 8-bit gamma-encoded sRGB bytes**. There is:

- No density/characteristic (H&D) curve per layer.
- No per-channel tone curve.
- No dye-coupler / spectral crosstalk model.
- No reference to measured film data of any kind.

Representative evidence (Kodachrome, 4935–4948):

```js
r = clampByte(r * 1.1 + 5);  g = clampByte(g * 0.95);  b = clampByte(b * 1.05 + 8);
const avg = (r + g + b) / 3;
r = clampByte(avg + (r - avg) * 1.4); ... // global saturation
r = clampByte(128 + (r - 128) * 1.15); ... // global contrast around byte-128
r = clampByte(Math.max(r, 10)); ...        // "lifted blacks"
```

Portra (4748–4761): `r + shadowLift*15` for warm shadows, `128 + (r-128)*0.9 + 5` soft contrast, highlight desat toward `avg`. Kodak Gold (4838–4855), Fuji Pro (4865–4899) are the same family of moves. These produce _pleasant color grades_ but they are color presets, not film emulation.

### 0.2 The looks run on gamma bytes; only Exposure is linear

The engine HAS correct linear-light infrastructure in `color-space.ts` (`SRGB_TO_LINEAR`, `makeExposureLUT`, `linearToSrgbByte`). The unifiedFilm **exposure** pre-step uses it correctly (4680–4687, `makeExposureLUT(exposure)` — +1 stop maps mid-gray 128→~176, not to clipped white). But the moment the exposure LUT finishes, every stock function (`applyPortra400` etc.) does its color math on raw gamma bytes. Contrast pivots around byte `128` (≈ sRGB middle, not 18% scene gray), saturation is computed against arithmetic `(r+g+b)/3` rather than a luminance- or linear-correct mean. So the grade is perceptually plausible but tonally wrong vs. how film actually redistributes energy.

### 0.3 Grain is unseeded per-pixel `Math.random()` white noise — preview ≠ export

This is the single biggest correctness problem. `applyFilmStockGrain` (4962–4991):

```js
const grainSize = preset === 4 ? 1.5 : 1; // HP5 has larger grain  <-- COMPUTED, NEVER USED
const grainVariance = preset === 0 ? 0.7 : 1;
...
const noiseBase = Math.random() - 0.5;          // UNSEEDED
const noise = noiseBase * intensity * 50 * grainVariance;
const lum = ...; const midtoneFactor = 1 - Math.abs(lum - 128) / 128;
const grainAmount = noise * (0.5 + midtoneFactor * 0.5);
data[i] = clampByte(data[i] + grainAmount); // same value to R,G,B → monochromatic ✓
```

What's right: grain is **monochromatic** (same delta to all channels) and **density/midtone-weighted** (`midtoneFactor`). What's wrong:

- **Unseeded `Math.random()`** → the live preview pass and the full-quality export pass produce _different grain_. The codebase even ships a seeded PRNG (`mulberry32`, color-space.ts:67) used by glitch (effects.ts:2320) — grain, where it matters most, does not use it.
- **No spatial structure.** Comment claims "Perlin-like noise for more realistic grain" but it is plain per-pixel white noise. `grainSize` is calculated then discarded, so HP5's "larger grain" never happens. Real grain has size/clumping and is resolution-dependent; this is 1-pixel hash regardless of zoom.
- Same unseeded pattern in `applyFilmGrain` (vintage, 3570–3577), `createChromaticGrainEffect` (9489), `createFractalNoiseEffect` (8916, literally `Math.random()*255`), `applyScratchedFilm` / `createScratchedFilmEffect`, and `oldPhoto` noise (2130). 63 `Math.random()` calls in the file.

### 0.4 Halation is real only on Cinestill; available generally only as a non-red bloom

Red/orange halation done correctly (linear-light blur of a red highlight mask) exists **only** in `applyCinestill800T` (4769–4828):

```js
if (lum > 200) { highlights[i]=255; highlights[i+1]=50; highlights[i+2]=0; ... } // red mask
gaussianBlurLinear(highlights, width, height, Math.ceil(halation*30));            // ✓ linear light
... r = clampByte(r + halR*80); g = clampByte(g + halR*20);                       // add red glow
```

The `halation` slider in the Film UI is consumed **only** by Cinestill; for Portra/Gold/Fuji/HP5/Kodachrome it does nothing. A general halation exists as `unifiedGlow` preset 4 and the (aliased-away) standalone `createHalationGlowEffect` (9506) — both blur in linear light, but the unifiedGlow variant is a slightly-warm whole-highlight bloom, not the red-channel-specific bleed real halation requires.

### 0.5 No 3D-LUT and no per-channel tone-curve infrastructure to plug real emulation into

- **No 3D LUT (.cube) support** anywhere in the codebase.
- The only tone-curve primitive is `toneCurve01(t,k)` (10364) — a single sigmoid with one scalar `k`, applied **identically to R, G, B** (`createToneCurveEffect`, 10412–10428). Not per-channel.
- `makeByteLUT` (color-space.ts:46) is a 1-D byte→byte LUT, used today only for exposure. It _could_ host per-channel film curves, but nothing builds them.
- Net: a real film pipeline (per-channel density curves or a 3D LUT in linear light) has no host today; it would have to be built.

---

## 1. unifiedFilm — Portra / Cinestill / Kodak Gold / Fuji Pro / Ilford HP5 / Kodachrome

- **Location:** config 6774; dispatch `case 'unifiedFilm'` 664; orchestrator `createUnifiedFilmEffect` 4657; stocks 4737–4959; grain 4962; fade 4994.
- **Classification:** **APPROX** (color grades) with a **REAL** exposure pre-step and **REAL** Cinestill halation; **grain is BROKEN** (unseeded, dead `grainSize`).
- **Math / color space:**
  - Exposure: correct linear-light LUT (4680). ✓
  - Stocks: gamma-byte ad-hoc (see §0.1/0.2). Contrast pivots on byte 128; saturation vs `(r+g+b)/3`.
  - HP5 (4903–4924) is the most defensible: panchromatic-ish weights `0.35R + 0.5G + 0.15B` (elevated red sensitivity is plausible for HP5), S-curve + `*1.3` contrast. Still no real curve, but reasonable B&W.
  - Cinestill tungsten WB `r*0.85, g*0.95, b*1.15+10` (4806–4808) is a crude channel scale, not a real 3200K→5500K chromatic adaptation.
  - Clipping/banding: all writes `clampByte` (hard clip). Highlights clip abruptly (no shoulder roll-off — a key film characteristic is _missing_). 8-bit intermediate throughout → grain+contrast can band in skies.
- **Per-stock honest verdict:**
  - **Portra 400** — generic warm-shadow / soft-contrast / highlight-desat grade. Pleasant, reads "warm portrait," not Portra's actual curve. APPROX.
  - **Cinestill 800T** — best of the set: real red halation in linear light + tungsten cast. The halation mechanism is right; the look still ad-hoc. APPROX+ (one REAL component).
  - **Kodak Gold** — warm + saturation + S-curve. Generic "nostalgic warm." APPROX.
  - **Fuji Pro 400H** — cool shadows / pastel desaturated highlights. Directionally Fuji-ish, ad-hoc. APPROX.
  - **Ilford HP5** — decent high-contrast B&W with plausible channel weights. The strongest single stock. APPROX (good).
  - **Kodachrome** — high saturation + punch + lifted blacks. Reads "punchy slide," misses Kodachrome's specific red/cyan signature. APPROX.
- **Granularity:** preset, grain %, halation %, fade %, exposure (−2..+2 stops, real), opacity. Missing pro controls: per-stock grain _size_, white-balance/temp-tint, highlight shoulder/roll-off, split-tone (shadow vs highlight color), per-channel curves, halation color/threshold for all stocks.
- **Verdict + top fix:** Solid color grades mislabeled as film science. **Top fix: seed the grain** (`mulberry32` keyed on a stable per-layer seed) so preview matches export, and actually use `grainSize` (sample noise at a coarser grid + bilinear upsample for grain clumping). Second: add a highlight shoulder (linear-light soft-clip) so highlights roll instead of hard-clipping.

## 2. unifiedVintage — Sepia / Old Photo / Faded / Cross Process / Scratched / Polaroid

- **Location:** config 6419; dispatch 611; `createUnifiedVintageEffect` 3356; helpers `applySepiaTone` 3424, `applyOldPhotoTone` 3441, `applyFadedFilm` 3465, `applyCrossProcess` 3489, `applyScratchedFilm` 3506, `applyPolaroid` 3540, `applyWarmth` 3562, `applyFilmGrain` 3570, `applyVintageVignette` 3580.
- **Classification:** **APPROX** color grades; scratches + grain **COSMETIC/BROKEN** (unseeded).
- **Math / color space:** all gamma-byte. Sepia = luminance→`gray*1.2/0.9/0.6` (3431). Grain `(Math.random()-0.5)*amount*40`, monochromatic but **no** luminance weighting and **unseeded** (3573). Scratches placed by `Math.random()` per call (3519–3523) → flicker between preview/export. Vignette multiply in gamma (3598).
- **Granularity:** preset, intensity, vignette, grain, scratches, fade, warmth, opacity. Reasonable surface; same missing-seed problem.
- **Verdict + top fix:** Competent vintage grades. **Top fix: seed grain + scratches.** Also unify with the better classic-sepia matrix used by the standalone `oldPhoto` (see §3).

## 3. oldPhoto (standalone)

- **Location:** config 7625; dispatch 487; `createOldPhotoEffect` 2094. (Also aliased: `oldPhoto → unifiedVintage preset 1`, line 11285 — so two different sepia maths exist.)
- **Classification:** **APPROX**.
- **Math:** standard sepia matrix `0.393/0.769/0.189` etc. (2110–2112) — the textbook sepia, cleaner than vintage's `gray*1.2`. Noise `(Math.random()-0.5)*noise*255*0.5` (2130) unseeded. Reuses `createVignetteEffect`.
- **Granularity:** sepia, noise, vignette. No fade/temp.
- **Verdict + top fix:** Fine. **Top fix: seed the noise; dedupe against unifiedVintage** so there aren't two competing "old photo" implementations.

## 4. scratchedFilm (standalone)

- **Location:** config 8155; dispatch 549; `createScratchedFilmEffect` 8864. (Alias `scratchedFilm → unifiedVintage preset 4`, 11286.)
- **Classification:** **COSMETIC / BROKEN-determinism.**
- **Math:** flicker = `(Math.random()-0.5)*flicker*2` global brightness (8872); scratches and dust all `Math.random()` (8883–8910). Every render reseeds → scratches/dust/flicker jump between the fast preview pass and the full export pass, and re-randomize on every parameter tweak.
- **Granularity:** scratchDensity, dustOpacity, flicker. No seed, no scratch color/length control, no vertical-only constraint exposed.
- **Verdict + top fix:** Decorative only. **Top fix: seed everything with `mulberry32`** so the damage is stable; expose the seed as a control.

## 5. unifiedGlow — Bloom / Dreamy / Neon / Bioluminescent / Halation

- **Location:** config 6250; dispatch (via alias) ; `createUnifiedGlowEffect` 1575; blur `gaussianBlurLinear` (OptimizedBlur.ts:386).
- **Classification:** **REAL bloom mechanism** (threshold extract → linear-light blur → additive composite); preset tints **APPROX**.
- **Math / color space:** threshold mask (1608), per-preset tint (1611–1650), then `gaussianBlurLinear` (1660) — energy-correct linear-light spreading ✓. Composite `original*bgMultiplier + glow*intensity*2` (1665). Neon uses an `atan2` pseudo-hue (1625) → `hslToRgb`, approximate. Halation preset (1639) is a slightly-warm whole-highlight bloom, **not** red-channel halation.
- **Granularity:** preset, intensity, radius (1–150), threshold, colorShift, darkenBg, opacity. Good. Missing: separate highlight knee, chroma-preserving vs white bloom toggle.
- **Verdict + top fix:** The strongest family in this group — correct physics. **Top fix: make the Halation preset actually red** (bias the blurred glow toward the red channel) so it differs from Bloom.

## 6. bloom (standalone)

- **Location:** config 6232; dispatch 463; `createBloomEffect` 1536.
- **Classification:** **APPROX** (it's diffusion glow, not threshold bloom).
- **Math:** blurs the **entire** image in linear light then `original + blur*strength` (1555–1561). Comment says "add blurred highlights" but there is **no threshold** — it adds the whole blurred frame, so midtones glow too (Orton-like diffusion). Linear blur is correct ✓; only-add means it can clip but not darken.
- **Granularity:** strength %, radius (1–100), opacity. No threshold control — the missing knob is the defining one.
- **Verdict + top fix:** **Top fix: add a luminance threshold** (reuse unifiedGlow's mask) so it's a real bloom, or relabel as "Diffusion/Glow."

## 7. orton (config 8851) + ortonEffect.ts

- **Location:** config 8851; dispatch `case 'orton'` 655; `createOrtonFallback` 258 (linear, reads settings); `OrtonFilter` ortonEffect.ts:173 (gamma-space, registered to `Konva.Filters.Orton`).
- **Classification:** **APPROX**, with a likely **dead-controls bug** in the shipped path (medium confidence).
- **Math / two-path problem:**
  - Dispatch prefers `Konva?.Filters?.Orton` and, when present, returns config `{}` (658) — i.e. **no attrs are passed**. `OrtonFilter` then reads `this.ortonIntensity?.() || 0.7`, `this.ortonBlurRadius?.() || 15`, etc. (ortonEffect.ts:179–184) which are **different setting names** than the config sliders (`blur`, `brightness`, `glow`, `blendMode`). With `{}` passed, those node attrs are unset → OrtonFilter runs on **hardcoded defaults and ignores the user's sliders.** Caveat: this only bites if `Konva.Filters.Orton` actually got registered (ortonEffect.ts:247 requires `window.Konva` at import time); if not, the linear `createOrtonFallback` runs and respects the sliders.
  - `OrtonFilter` also blurs in **gamma space** (`gaussianBlur`, ortonEffect.ts:21) — muddier halos than the linear fallback. So the _worse_ implementation is the _preferred_ one.
- **Granularity:** blur (1–20), brightness, glow, blendMode (screen/overlay/soft-light). Fallback honors them; Konva path likely doesn't.
- **Verdict + top fix:** **Top fix: drop the `Konva.Filters.Orton` path (or map sliders→node attrs) and always use the linear `createOrtonFallback`** — it's correct and actually reads the controls.

## 8. bioluminescence (config 8832) — and unifiedGlow preset 3

- **Location:** config 8832; dispatch 605; `createBioluminescenceEffect` 12638; alias → unifiedGlow preset 3 (11260).
- **Classification:** **APPROX** glow + **COSMETIC** sparkles.
- **Math:** brightness+saturation threshold extract (12655–12670), cyan/green push `(g*0.8 + b*0.3 + 100)*glow` (12675), `gaussianBlurLinear` (12688) ✓, dark composite. Sparkles `Math.random()` (12710) unseeded.
- **Granularity:** glowIntensity, glowSpread. Thin. No color control, no seed for sparkles.
- **Verdict + top fix:** Looks good; **top fix: seed the sparkles** and expose the glow color.

## 9. neonGlowEdges (config 8529) — and unifiedGlow preset 2

- **Location:** config 8529; dispatch 583; `createNeonGlowEdgesEffect` 11593; alias → unifiedGlow preset 2 (11258).
- **Classification:** **APPROX** (sound technique).
- **Math:** Sobel edge magnitude (11609–11635) → per-pixel HSL hue from local mean → `hslToRgb(hue,1,0.55)` tint scaled by edge (11655–11660) → `gaussianBlurLinear` (11672) ✓ → dark-bg composite `original*0.08 + glow*intensity*2.5`. Deterministic (no RNG). Good.
- **Granularity:** glowWidth (1–10 → radius 5–50), glowIntensity. Missing fixed-hue / hue-rotate control.
- **Verdict + top fix:** Solid. **Top fix: optional fixed neon color** instead of always deriving hue from content.

## 10. vignette (config 7359)

- **Location:** config 7359; dispatch 475; `createVignetteEffect` 1824; vintage variant `applyVintageVignette` 3580.
- **Classification:** **APPROX** (functional, not optically modeled).
- **Math:** radial `factor = 1 - sqrt(distSq/scaleSq)` then `multiply` the gamma bytes (1852–1859). Darkening in gamma space (acceptable since it only attenuates; no clip risk). Not a real cos⁴ optical falloff; no exposure-based (linear) darkening.
- **Granularity:** amount, falloff. Missing: roundness/shape, midpoint, color (warm vignette), feather independent of size.
- **Verdict + top fix:** **Top fix: darken in linear light** (decode→multiply→encode) for natural falloff, and add roundness + midpoint.

## 11. lensFlare (config 7876)

- **Location:** config 7876; dispatch 505; `createLensFlareEffect` 10172.
- **Classification:** **COSMETIC** (procedural overlay).
- **Math:** 5 colored ghost discs along the source→center axis (10199–10221) + star rays via `cos(angle*4/8)` × radial falloff (10230–10238), additively composited in gamma. Not driven by actual image highlights; fixed 5-ghost palette. No linear light. O(w·h·flares) per pixel.
- **Granularity:** x, y, strength, opacity. Missing: ghost count/spacing, color/chromatic dispersion, anamorphic streak, threshold-from-highlights.
- **Verdict + top fix:** Decorative and fine as such. **Top fix: seed ghosts from real bright pixels** (threshold mask) and composite additively in linear light so it reads as light, not paint.

## 12. lightLeak (src/lib/effects/lightLeakEffect.ts)

- **Location:** `lightLeakEffect.ts` (radial+directional gradient generators, blend modes, noise).
- **Classification:** **APPROX/COSMETIC** — well-structured but gamma-space, and its noise is deterministic-by-coordinate not film-like.
- **Math:** radial gradient with quadratic falloff (lines 41–46), directional streak with exp falloff (85–93), blend modes (screen/overlay/soft-light/color-dodge) computed on normalized gamma values (104–131). "Noise" is `sin(x*12.9898+y*78.233)*43758.5453` hash (140–142) — deterministic (good for preview=export) but a high-frequency hash, not organic. Reads settings via Konva node attrs (`this.lightLeakIntensity?.()` 156) — same attr-plumbing dependency as Orton; verify sliders actually bind.
- **Granularity:** intensity, color RGB, position, size, spread, softness, angle, opacity, blendMode + 4 presets. Rich.
- **Verdict + top fix:** Good controls. **Top fix: composite in linear light** (light leaks are additive light) and verify the `this.lightLeak*` attrs are actually populated from the UI.

## 13. noise (config 6013)

- **Location:** config 6013; dispatch 423 → `Konva.Filters.Noise`.
- **Classification:** **COSMETIC** (Konva builtin).
- **Math:** Konva's built-in uniform RGB noise — **not** monochromatic, **not** seeded, **not** luminance-weighted. Color noise, not film grain.
- **Granularity:** value (0–2), opacity. Minimal.
- **Verdict + top fix:** **Top fix: replace with a seeded monochromatic grain** for any "film texture" use; keep Konva noise only for chroma-noise looks.

## 14. fractalNoise (config 7998)

- **Location:** config 7998; dispatch 513; `createFractalNoiseEffect` 8916.
- **Classification:** **BROKEN / placeholder.**
- **Math:** the entire body is `const noiseVal = Math.random()*255; data[i]=lerp(data[i],noiseVal,opacity)` (8924–8928). Comment at 8915: _"Using Simple Random Noise as Placeholder."_ The config exposes **`scale`** and **`blendMode`** sliders that are **completely ignored** (`scale` is commented out at 8920). It is not fractal, not seeded, and two of its three controls are dead.
- **Granularity:** scale (dead), opacity, blendMode (dead).
- **Verdict + top fix:** **Top fix: implement real value/fBm noise** (seeded lattice + octaves honoring `scale`/`blendMode`) or remove the effect. As shipped it is mislabeled and half-inert.

## 15. chromaticGrain

- **Location:** dispatch 531; `createChromaticGrainEffect` 9489.
- **Classification:** **COSMETIC / BROKEN-determinism.**
- **Math:** `grain=(Math.random()-0.5)*grainAmount*255` added to all channels **plus** a per-pixel `chromaShift=(Math.random()-0.5)*chroma*8` pushed +R/−G/+0.5B (9496–9501). Unseeded → preview≠export. Real chroma grain is correlated across a dye layer, not independent per pixel.
- **Granularity:** grain, chroma. No seed, no size.
- **Verdict + top fix:** **Top fix: seed it** and derive chroma offset from a low-freq field rather than per-pixel independent noise.

---

## Cross-cutting issues

1. **Unseeded RNG is endemic.** Grain (film + vintage), scratches, dust, sparkles, lens-flare placement, fractalNoise, chromaticGrain all use `Math.random()`. The fast preview pass (pixelRatio 0.6) and full export pass therefore disagree, and any slider tweak re-rolls the texture. `mulberry32` exists and is used by glitch — grain just doesn't call it.
2. **No film science substrate.** No characteristic curves, no per-channel curves, no 3D LUT. `makeByteLUT` (1-D) and `toneCurve01` (single scalar, all channels) are the only curve primitives; neither is wired for film. Real emulation has nothing to plug into.
3. **Looks live in gamma space.** Only exposure (film) and the glow blurs (`gaussianBlurLinear`) are linear-correct. Color grades, vignette, lens flare, light leak all operate on gamma bytes; contrast pivots on byte 128.
4. **Hard clipping, no highlight shoulder.** Everything `clampByte`s; films roll highlights off — that signature is absent, so bright areas clip flat and can band on 8-bit intermediates.
5. **Duplicate/aliased implementations diverge.** `oldPhoto`/`scratchedFilm`/`bioluminescence`/`neonGlowEdges`/`halationGlow` exist both standalone and as unified-effect aliases (11258–11286), sometimes with different math (e.g. two different sepias). Maintenance + inconsistency risk.
6. **Orton ships the worse path.** Gamma-space `Konva.Filters.Orton` is preferred over the correct linear `createOrtonFallback`, and is passed `{}` so it likely ignores the sliders (setting-name mismatch).

## Top 3 highest-value fixes (whole group)

1. **Seed all stochastic texture with `mulberry32`** (grain, scratches, dust, sparkles, chromaticGrain, fractalNoise). Single highest-impact correctness fix: makes preview match export and stops textures re-rolling on every tweak. Low effort, the PRNG already exists.
2. **Build a real film substrate: per-channel tone-curve LUTs (extend `makeByteLUT`) and/or 3D-LUT (.cube) support, evaluated in linear light, with a highlight shoulder.** Convert the six stocks from gamma-byte multipliers to curve/LUT lookups so the "looks" become grounded and gain roll-off instead of hard clip. This is the structural fix that turns "color presets" into "film emulation."
3. **Give grain real structure and density response:** sample seeded noise on a coarse grid scaled by a per-stock `grainSize` (currently computed and discarded), bilinear-upsample for clumping, keep it monochromatic and midtone-weighted (already correct). Optionally make halation red-channel-specific and available on all stocks, not just Cinestill.

---

_File: `/private/tmp/claude-501/-Users-paul/c8210d3d-5609-4ce7-adb2-65e6a1595eb4/scratchpad/audit/group-3-film-vintage-glow.md`_
