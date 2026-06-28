# Audit — Group 6: Glitch + Special-FX effects (`src/lib/effects.ts`)

Scope: 31 effects. Each effect = Konva filter `(imageData)=>void` mutating RGBA in place. Dispatch `switch` at ~L382. Helpers in `src/lib/effects/color-space.ts` (`mulberry32` seeded PRNG, sRGB LUTs, `clampByteRound`).

**Classification key**

- REAL — implements the named algorithm correctly.
- APPROX — recognizable but simplified / mislabeled / partial.
- COSMETIC — a positional pattern or recolor that barely uses image content; "special FX" gimmick.
- BROKEN — does not do what it claims / dead.

**Counts:** REAL 16 · APPROX 10 · COSMETIC 4 · BROKEN 1.

**Cross-cutting bug — unseeded `Math.random()` (live preview ≠ export):** `mulberry32` exists and is used by `glitchArt`, but these still call global `Math.random()` and re-roll every render pass and on export: `unifiedGlitch` (VHS + Corrupt presets), `chromaticGlitch`, `voronoi`, `databending`, `liquidMetal`, `paperRelief`, `paperCutArt`, `weavePattern`, `fractalNoise`. None expose a Seed slider.

**Cross-cutting bug — dead `opacity` slider:** config lists `opacity` but the impl never blends with the original (no `applyOpacityBlend` call): `threshold` (L213), `chromaticAberration` (L1867), `edgeDetection` (L2619), `cellular` (L871). The slider moves, nothing happens.

---

## GLITCH FAMILY

### unifiedGlitch — REAL (mixed)

- **Location:** config L6333; impl `createUnifiedGlitchEffect` L3008; helpers L3057–3347 (`applyVhsEffect` L3150).
- **Algorithm:** 7 presets. RGB Split (directional channel shift), Chromatic (**true radial CA** — offset grows with distance from center, L3089–3126), Scanlines (band darken), VHS, Corrupt, Databend (sine-wave row warp — mislabeled; real databend ≠ wave), Pixel Sort (threshold-interval, sorts segments _above_ threshold). Presets 0/1/2/5/6 deterministic.
- **Seeding:** VHS (L3150) and Corrupt (L3192) use unseeded `Math.random()` → preview≠export. VHS color-bleed only touches the red channel (L3179), so "chroma bleed" is really a red smear.
- **Granularity:** rich — preset, intensity, amount(1–50), direction(0/1/2), blockSize, randomness, opacity. Good.
- **Verdict / top fix:** Strong overall and ironically its CA preset is the _correct_ radial one. Top fix: route VHS/Corrupt RNG through `mulberry32(seed)` and add a Seed control; make VHS bleed the chroma not just red.

### rgbShift — REAL (simple)

- **Location:** config L7682; impl `createRgbShiftEffect` L2268.
- **Algorithm:** per-channel horizontal sample offset (R/G/B), edge-clamped, integer-rounded. Correct, deterministic.
- **Granularity:** rOffset/gOffset/bOffset (−20..20, X only). Missing vertical offset; integer-only (no sub-pixel).
- **Verdict / top fix:** Fine. Add Y offset + bilinear sampling for sub-pixel shifts.

### chromaticAberration — APPROX

- **Location:** config L7383; impl `createChromaticAberrationEffect` L1867.
- **Algorithm:** **uniform directional** shift (R by `+amount·(cosθ,sinθ)`, B opposite, G fixed) with bilinear sampling. NOT radial lateral CA — fringing does **not** grow from the optical center, so it reads as a flat double-image, not lens CA. Deterministic, good sub-pixel sampling.
- **Granularity:** amount(0–20), angle(0–360), **opacity (DEAD — never applied)**.
- **Verdict / top fix:** Replace the uniform offset with the radial model already written for `unifiedGlitch` preset 1 (`applyChromaticAberration`, L3089) and wire `opacity`. Add an edge-mask option so flats stay clean.

### chromaticGlitch — APPROX

- **Location:** config L8261; impl `createChromaticGlitchEffect` L9346.
- **Algorithm:** alternating horizontal bands; per-band random R/G/B offsets + 10% random full-noise pixels. Banding is structured; channel shift is real.
- **Seeding:** unseeded `Math.random()` for offsets and noise → preview≠export, re-rolls every frame. `effectiveAmount = amount || 8` forces 8 when amount=0 (can't disable).
- **Granularity:** amount, frequency. No seed, no vertical, no per-band jitter control.
- **Verdict / top fix:** Seed it; drop the `|| 8` override.

### glitchArt — REAL

- **Location:** config L7719; impl `createGlitchArtEffect` L2313.
- **Algorithm:** block-row displacement + per-block RGB channel shift. Correct; a prior tempRow indexing bug is fixed (noted in-code).
- **Seeding:** ✅ seeded via `mulberry32(settings.seed ?? 1)` — deterministic, preview=export. But config never exposes `seed`, so it is permanently 1 (no pattern variety).
- **Granularity:** blockiness, colorShift. Add a Seed/regenerate control and block-glitch probability.
- **Verdict / top fix:** Best-behaved glitch here. Just surface the seed.

### databending — APPROX

- **Location:** config L8447; impl `createDatabendingEffect` L10102.
- **Algorithm:** block grid; per-block one of byteshift / channelswap / compression / interlace. Structured, multi-mode (better than noise). `byteshift` reads into the next pixel's bytes (plausible "misread"). `compression` quantizes only the red channel then copies to G/B → collapses that block to grayscale (likely unintended). Real databending corrupts encoded bytes; this is a pixel-space stand-in.
- **Seeding:** unseeded `Math.random()` (block pick + type pick) → preview≠export.
- **Granularity:** amount, distortion. No seed, no per-mode toggles.
- **Verdict / top fix:** Seed it; fix `compression` to quantize per-channel.

### pixelSort — REAL

- **Location:** config L7658; impl `createPixelSortEffect` L2146.
- **Algorithm:** genuine Kim-Asendorf threshold-interval sort. Walks each row/col, opens a segment when luma < threshold, sorts that contiguous run by Rec.601 luma ascending, writes back; handles the run reaching the edge. Deterministic.
- **Granularity:** threshold(0–1), axis(X/Y). **Config description is inverted** — it says "pixels _above_ this brightness will be sorted" but the code sorts pixels _below_ threshold. Missing: sort key (only luma; no hue/saturation), sort order (ascending only), invert (sort bright vs dark).
- **Verdict / top fix:** Correct algorithm. Fix the description; add key/order/invert controls.

---

## EDGE / THRESHOLD / 3D

### edgeDetection — REAL

- **Location:** config L7788; impl `createEdgeDetectionEffect` L2619.
- **Algorithm:** true 3×3 **Sobel** (standard Gx/Gy kernels), magnitude `√(gx²+gy²)`, hard binary threshold, optional invert. Grayscale prep uses simple average (not luma-weighted — minor). Deterministic.
- **Granularity:** threshold(10–150), invert, **opacity (DEAD)**. Missing: kernel choice (Prewitt/Canny), soft/magnitude output (currently hard 0/255 only), edge color.
- **Verdict / top fix:** Solid Sobel. Wire opacity; add a soft-magnitude output mode.

### threshold — REAL

- **Location:** config L6039; impl `createThresholdFallback` L213.
- **Algorithm:** Rec.601 luma vs single global cutoff → pure B/W. Correct, deterministic.
- **Granularity:** value(0–1), **opacity (DEAD — fallback ignores it)**. Missing: per-channel threshold, adaptive/local (Otsu/Bradley), soft edge.
- **Verdict / top fix:** Wire opacity; offer adaptive/local thresholding.

### anaglyph — REAL

- **Location:** config L8138; impl `createAnaglyphEffect` L2819.
- **Algorithm:** red = luminance of `x−shift` (left eye), green+blue = `x+shift` (right eye) — standard red/cyan anaglyph synthesized from a single 2D image via horizontal disparity. Correct for what it is. Deterministic.
- **Granularity:** shift only. Missing: depth-based displacement (uses uniform shift, no depth map), color scheme (red-cyan only), convergence.
- **Verdict / top fix:** Good. Add color-scheme presets; optionally drive shift by a luminance-as-depth map.

---

## GENERATIVE / PATTERN

### fractalNoise — BROKEN ⚠ (worst in group)

- **Location:** config L7998; impl `createFractalNoiseEffect` L8916.
- **Algorithm:** NOT fractal. It is `lerp(pixel, Math.random()·255, opacity)` — flat white gray-noise overlay. No octaves, no value/Perlin noise, no fBm. The in-code comment admits "scale not used in simple random noise."
- **Seeding:** unseeded `Math.random()` → preview≠export, full reshuffle every frame.
- **Granularity:** config exposes scale + opacity + blendMode(0–5); **`scale` and `blendMode` are both DEAD** (impl ignores them). Only opacity works.
- **Verdict / top fix:** Replace with real fBm — the project already has a correct `smoothNoise`+`fbm` (octave value noise) inside `createFrostedGlassEffect` (L5386–5422); lift it, seed it, and wire `scale`/`blendMode`.

### voronoi — REAL (algorithm) / severe perf+seed

- **Location:** config L8034; impl `createVoronoiEffect` L9046.
- **Algorithm:** N random seed points, each pixel assigned to nearest (Euclidean) seed, colored by that seed's source pixel; optional boundary lines. Correct Voronoi.
- **Seeding:** unseeded `Math.random()` point placement → preview≠export. **Perf:** brute-force O(W·H·N); config allows `numPoints` up to **1000** → ~10⁹ distance tests on a 1MP image (UI hang).
- **Granularity:** numPoints(3–1000), showLines. Missing: seed, distance metric (Manhattan/Chebyshev), cell-average vs single-sample color.
- **Verdict / top fix:** Seed it; cap numPoints or use a grid/jump-flood for nearest-seed.

### cellular — REAL

- **Location:** config L7517; impl `createCellularAutomataEffect` L871.
- **Algorithm:** seeds a grid from cell-average brightness vs threshold, runs **Conway's Game of Life** (B3/S23) for N iterations with toroidal wrap, renders live cells black on white. Correct, deterministic.
- **Granularity:** threshold, iterations(1–10), cellSize(1–8), **opacity (DEAD)**. Output is binary B/W (no color preservation).
- **Verdict / top fix:** Wire opacity; optional color-retain mode (tint by original).

### topographicContours — REAL

- **Location:** config L8818; impl `createTopographicContoursEffect` L12499.
- **Algorithm:** quantizes luma into N levels; draws black where the quantized level differs from the right/below neighbor (true iso-contour boundary); tints elevation elsewhere. Reads source, writes temp (no feedback). Deterministic.
- **Granularity:** contourLevels(5–20). Missing: line color/weight, tint toggle.
- **Verdict / top fix:** Good. Add line color + thickness.

### weavePattern — APPROX

- **Location:** config L8825; impl `createWeavePatternEffect` L12559.
- **Algorithm:** procedural warp/weft grid (cell position → highlight/shadow/edge-darkening/thread lines) multiplied onto desaturated image color. Genuinely modulates image content. Deterministic except grain.
- **Seeding:** fabric grain via unseeded `Math.random()`.
- **Granularity:** weaveSize only. Missing: seed, thread color, weave pattern type.
- **Verdict / top fix:** Seed the grain; expose thread tint.

### paperCutArt — REAL

- **Location:** config L8472; impl `createPaperCutArtEffect` L11423.
- **Algorithm:** posterize luma into N layers, map to a warm paper palette, detect layer boundaries (top-left neighborhood) to darken drop-shadow edges, add fiber noise. Preserves alpha. Content-driven.
- **Seeding:** fiber noise unseeded.
- **Granularity:** layers(3–8) only. Missing: seed, palette choice, shadow strength.
- **Verdict / top fix:** Seed the fiber; expose shadow + palette.

---

## SPECIAL FX (honest read — gimmick check)

### y2kChrome — APPROX (content-driven stylization)

- **Location:** config L6851; impl `createY2kChromeEffect` L5021.
- **Algorithm:** per-pixel luma + **local luminance gradient (estimated surface normal)** → holographic hue; specular from luma S-curve; an additive positional reflection-sine; midtone color retention; optional scanlines. The chrome/hue genuinely track image structure; only the reflection term is positional. Deterministic.
- **Granularity:** excellent — intensity, rainbow, highlights, reflection, scanlines, opacity (all wired).
- **Verdict:** Real content response, well parameterized; "chrome" is stylization not physics. Keep.

### brokenGlass — REAL (heavy)

- **Location:** config L6919; impl `createBrokenGlassEffect` L5160.
- **Algorithm:** Voronoi shard field radiating from an impact point (deterministic sin-hash RNG), per-pixel cell + crack intensity from F2−F1 edge distance, per-shard displacement scaled by distance-from-impact, CA on cracks, edge highlights/dark lines, per-shard refraction tint. Genuinely displaces the source image. Deterministic.
- **Granularity:** density(3–25), displacement, thickness, impactX/Y, chromatic, opacity. Rich.
- **Perf:** brute-force Voronoi O(W·H·shards), shards=density² (up to 625) — slow on large images.
- **Verdict / top fix:** Strong. Optimize the nearest-shard search.

### frostedGlass — REAL

- **Location:** config L6996; impl `createFrostedGlassEffect` L5358.
- **Algorithm:** **real fBm** (interpolated value noise, 3 octaves, L5386–5422) drives per-pixel displacement + blur; center-clarity radial falloff; tint. Deterministic (sin-hash noise). Genuinely warps the image.
- **Granularity:** frost, scale, clarity, claritySize, tint, opacity. Rich.
- **Verdict:** Solid. (Its fBm is the function `fractalNoise` should be reusing.)

### doubleExposure — APPROX

- **Location:** config L7316; impl `createDoubleExposureEffect` L10583.
- **Algorithm:** blends the image with an **offset copy of itself** (screen/multiply/overlay), opacity lerp, alpha-preserving. Correct blend math but it is a self-offset ghost, not a true double exposure of two images. Offset capped at 0.25·dimension. Deterministic.
- **Granularity:** offsetX/Y, opacity, blendMode(0/1/2). Missing: a real second-image input.
- **Verdict / top fix:** Allow a second uploaded image as the overlay (or a built-in texture set).

### liquidMetal — COSMETIC (gimmick)

- **Location:** config L8285; impl `createLiquidMetalEffect` L9403.
- **Algorithm:** fixed positional sin/cos ripple warp (`sin(y·.05+x·.02)` — independent of image), a `metalFactor = 1+sin(brightness·0.05)` per-channel tint, plus unseeded `Math.random()` shimmer. The "liquid metal" character is a static swirl + thin silver tint; it samples the displaced image but the look is positional, not a flow/reflection sim. `intensity || 0.3` can't disable.
- **Seeding:** shimmer unseeded.
- **Granularity:** intensity, flicker.
- **Verdict / top fix:** Flag as content-light. To earn the name, drive the warp from an image-derived flow field (luma gradient) and add an environment/fresnel reflection; seed the shimmer.

### neuralDream — COSMETIC (gimmick, mislabeled) ⚠

- **Location:** config L8375; impl `createNeuralDreamEffect` L9898.
- **Algorithm:** despite "neural style transfer" naming, it is a fixed positional `sin·cos` pattern at 3 frequencies (content-independent) used to rotate per-pixel hue + boost saturation. No network, no learned style, no DeepDream feature ascent. It reads pixel hue/intensity, so the _color_ responds, but the dream texture is a static math pattern, not image structure. Deterministic.
- **Granularity:** style, noise.
- **Verdict / top fix:** Biggest naming overreach in the group. Rename to "Psychedelic Hue Warp," or replace the positional pattern with an edge/structure-tensor-driven swirl so it actually follows the image.

### magneticField — APPROX

- **Location:** config L8423; impl `createMagneticFieldEffect` L10036.
- **Algorithm:** Sobel edges (content-dependent) gate "field lines"; where edge>0.1, color = radial-angle sine `sin(angle·10 + edge·20)` mapped blue↔red, non-edge areas darkened to 30%. Real edge response, but the "field" is cosmetic radial coloring — no field sources, no field-line integration. Deterministic.
- **Granularity:** strength, direction.
- **Verdict / top fix:** Content-dependent (not a gimmick) but the physics framing is decorative. Lower priority.

### circuitBoard — APPROX

- **Location:** config L8190; impl `createCircuitBoardEffect` L8934.
- **Algorithm:** Sobel edge map (content-dependent) recolored as green traces + distance-weighted neon glow over the original. Honest edge-following recolor; no PCB routing/pads/vias/Manhattan traces, so "circuit board" overstates it. Deterministic.
- **Granularity:** threshold, glow.
- **Verdict / top fix:** Works; rename to "Neon Traces" or add trace snapping for a truer PCB look.

### iridescentSheen — APPROX

- **Location:** config L9450 (no dispatch case shown for some sister FX; effect at L530).
- **Algorithm:** per-pixel luma → sine sheen brightness + luma-driven hue offset added through an HSL `hue2rgb` partial. Content-dependent (driven by luma) but ad-hoc; no view-angle/thin-film model. Deterministic.
- **Granularity:** hueShift, intensity, contrast.
- **Verdict:** Acceptable luma-driven oil-sheen tint. Keep; minor.

### crystalFacet — COSMETIC (gimmick)

- **Location:** impl `createCrystalFacetEffect` L9646.
- **Algorithm:** averages uniform **square** cells then adds a per-cell diagonal `(cx+cy)` gradient "highlight." It is a square mosaic with a fake sheen, not faceting — no irregular/Voronoi facets, no per-facet orientation, no refraction. Content-dependent only via the block average. Deterministic.
- **Granularity:** cellSize, shine.
- **Verdict / top fix:** Replace square cells with a Voronoi facet partition (reuse `brokenGlass` shard logic) and randomize facet light angle.

### temporalEcho — REAL algorithm, BROKEN controls ⚠

- **Location:** config L8309; impl `createTemporalEchoEffect` L9813.
- **Algorithm:** 5 directional ghost taps blended with `decay^n` opacity and growing diagonal offset — a genuine multi-tap directional echo/smear. Deterministic.
- **Controls (severe):** config exposes `echoes`(2–10), `decay`, `offset`(1–20). Impl hardcodes `numEchoes = 5` (echoes slider **DEAD**), computes offset from `settings.delay` — **a param the config never defines** (always falls back to 0.2), so the `offset` slider is **DEAD** too. 2 of 3 sliders are no-ops; one phantom param.
- **Verdict / top fix:** Rename `delay`→`offset`, read `settings.echoes` for the loop count, add a direction control. Highest-ROI fix in the group.

### holographicInterference — COSMETIC (gimmick)

- **Location:** config L8399; impl `createHolographicInterferenceEffect` L9965.
- **Algorithm:** positional sine interference grid (`sin(x·f)+sin(y·f)`) → rainbow hue, brightness only nudges hue/chroma, 60% blended over the image. The pattern is a fixed sine field independent of image structure (no thin-film interference, no surface normals). Deterministic.
- **Granularity:** frequency, phaseShift.
- **Verdict / top fix:** Content-light overlay. Drive the interference phase from a luma/gradient height field so bands wrap the subject.

### heatmap — REAL

- **Location:** config L8121; impl `createHeatmapEffect` L2856.
- **Algorithm:** Rec.601 luma → multi-stop gradient LUT with 4 palettes (Classic rainbow, Inferno, Grayscale, Viridis), correct piecewise lerp + clamping. A true false-color/thermal map. Deterministic, content-dependent.
- **Granularity:** gradientType only. Missing: intensity/opacity blend, invert, range remap.
- **Verdict / top fix:** Correct. Add opacity + invert + range controls.

### paperRelief — APPROX

- **Location:** impl `createPaperReliefEffect` L9695 (case L546).
- **Algorithm:** emboss — `relief = pixel + (Δleft+Δtop)·depth`, grayscale out, plus texture noise. Real gradient-based relief, but the gradient uses only the **red channel** (`temp[index]`), not luma. Content-dependent.
- **Seeding:** texture noise unseeded.
- **Granularity:** depth, texture. Missing: light direction/azimuth, seed.
- **Verdict / top fix:** Use luma for the gradient; seed the texture; add a light-angle control.

---

## Top issues (ranked)

**3 worst**

1. **fractalNoise — BROKEN.** Not fractal (flat `Math.random` gray noise), `scale` + `blendMode` controls dead, unseeded (preview≠export). Mislabel + 2 dead sliders + RNG bug in one effect.
2. **temporalEcho — controls broken.** `echoes` hardcoded to 5 and `offset` reads a phantom `settings.delay` → 2 of 3 sliders are no-ops.
3. **neuralDream — content-light gimmick** masquerading as neural style transfer (static positional sin/cos pattern). Worst naming overreach. (Runners-up: `voronoi` unseeded + O(W·H·1000) hang; `liquidMetal`/`holographicInterference`/`crystalFacet` positional gimmicks.)

**3 best fixes (highest leverage)**

1. **Seed every stochastic effect** with `mulberry32(settings.seed)` and add a Seed slider — one pattern fixes preview≠export across unifiedGlitch(VHS/Corrupt), chromaticGlitch, voronoi, databending, liquidMetal, paperRelief, paperCutArt, weavePattern, fractalNoise.
2. **Wire the dead controls:** apply `opacity` in threshold/chromaticAberration/edgeDetection/cellular via `applyOpacityBlend`; fix temporalEcho (`delay`→`offset`, read `echoes`); fix fractalNoise `scale`/`blendMode`; fix pixelSort's inverted description and add sort key/order.
3. **Reuse the correct code already in the file:** make standalone `chromaticAberration` radial by lifting `unifiedGlitch`'s `applyChromaticAberration` (L3089); make `fractalNoise` real by lifting `frostedGlass`'s `fbm` (L5408); give `crystalFacet` real facets via `brokenGlass`'s Voronoi shard logic.

**Content-independent "special FX" gimmicks to flag for Paul:** neuralDream, holographicInterference, liquidMetal, crystalFacet (and fractalNoise, fully random). Genuinely content-driven (keep): y2kChrome, brokenGlass, frostedGlass, magneticField, circuitBoard, iridescentSheen, heatmap, temporalEcho.
