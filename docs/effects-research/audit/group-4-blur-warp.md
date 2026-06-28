# HAX Effects Audit — Group 4: Blur & Warp

Repo: `/Users/paul/Desktop/Active Projects/Cursor Projects/imager2`
Files: `src/lib/effects.ts`, `src/lib/performance/OptimizedBlur.ts`, `src/lib/effects/smartSharpenEffect.ts`, `src/lib/effects/color-space.ts`, `src/lib/effects/index.ts`
Method: read source only, no edits.

---

## Shared infrastructure (the engines these effects call)

### Blur helpers — `src/lib/performance/OptimizedBlur.ts`

- **`separableGaussianBlur` (L63)** — genuinely SEPARABLE (H pass → temp → V pass), correct Gaussian kernel (`sigma = radius/3`, normalized, cached ≤50). Edges clamp-extended. Runs on **gamma bytes, not linear light**. Good but not energy-correct.
- **`fastBoxBlur` (L163)** — running-sum O(1)/px box blur. The classic "skip shed/add at the edge" brightness-bias bug is documented as fixed (always sheds/adds clamped samples). Correct now.
- **`stackBlur` (L282)** — for r≤3 falls back to true Gaussian; for r>3 runs **3 box passes** with box radius derived from the _same_ target sigma via Kovesi `w=sqrt(12σ²/n+1)`. This is a correct 3-pass-box ≈ Gaussian approximation. This is the workhorse behind nearly every blur-based effect.
- **`separableGaussianBlurF32` (L314)** + **`gaussianBlurLinear` (L386)** — full-precision linear-light separable Gaussian (decode→blur→encode). This is the _energy-correct_ path. **It is only used by one effect (`neonGlowEdges`).** None of the user-facing Blur/Bokeh/Depth/Tilt effects use it.

**Key consequence:** the entire Blur category runs in **gamma space via `stackBlur`**. Fine for plain softening; wrong for bloom/highlight behaviour (bokeh highlights won't bloom correctly, bright spreads darken).

### Color-space helpers — `color-space.ts`

- `SRGB_TO_LINEAR` LUT, `linearToSrgbByte`, `clampByteRound` (round-half-up, fixes the `|0` down-bias), `mulberry32` (seeded PRNG). All correct and available — but **most stochastic warps ignore `mulberry32` and call `Math.random()`** (see below).

### Sampling helper — there is **none**

There is no shared bilinear/bicubic sampler anywhere. **Every geometric warp does `Math.round(...)` or `Math.floor(...)` on source coordinates → nearest-neighbor.** This is the single biggest quality problem in this group and is detailed per-effect.

---

## Per-effect findings

### 1. `unifiedBlur` — config L6604, impl L3975 (`createUnifiedBlurEffect`)

**Classification: REAL (mixed quality across 5 presets).**

Dispatches on `preset`: 0 Gaussian, 1 Bokeh, 2 Tilt-Shift, 3 Motion, 4 Radial.

- **Gaussian (L3991):** `stackBlur` → correct separable-ish 3-box Gaussian, gamma space. REAL.
- **Bokeh `applyBokehBlur` (L4015):** samples a hexagonal ring pattern, **only 6 angular samples per ring**, brightness-weighted (`weight = 1 + brightness*2`) to fake highlight bloom. Severe angular undersampling → **6-spoke / hexagram star artifacts**, not a smooth disc. No aperture/blade shape, no real CoC. APPROX with artifacts. O(radius·6)/px.
- **Tilt-Shift `applyTiltShiftBlur` (L4061):** blurs a copy at one radius, then **linear gradient mask** by `|y-focusY|` vs `focusSize`. A real horizontal-band gradient mask. REAL (single blur level only; no independent top/bottom falloff).
- **Motion `applyMotionBlur` (L4093):** **directional & angled** (`dx=cos(angle), dy=sin(angle)`, samples ±radius along the line, uniform box weight). REAL directional motion blur. NN sampling along the line (acceptable for a line integral).
- **Radial `applyRadialBlur` (L4132):** samples along the **radial direction** from focus point → this is a real **zoom/radial blur**. REAL. Note: config description calls it "Radial (spin)" but it is zoom, not spin.

**Granularity:** good — radius, focusX/Y, focusSize, angle (15° steps), opacity. Missing: bokeh blade count / cat-eye / disc shape; motion has no "fade/comet" weighting; no separate tilt top/bottom.
**Verdict / top fix:** solid all-rounder. Top fix: replace the 6-spoke bokeh with a real sampled disc kernel (or polygonal aperture w/ blade-count control) and bloom in linear light.

---

### 2. `blur` — config L5872, dispatch L408

**Classification: REAL.** Delegates to `Konva.Filters.Blur` (Konva's own stack-blur, gamma space), fallback `createBlurFallback` (L228) → `stackBlur`. Single `radius` 0–100. Correct, fast. No linear-light option. Fine.

---

### 3. `bokeh` (standalone) — config L5912, impl L10954 (`createBokehEffect`)

**Classification: APPROX.** This is **not** a disc/aperture bokeh. It is `stackBlur` + a luminance-threshold highlight bloom: blur whole image, `lerp(original, blurred, strength)`, then for pixels with `lum > threshold` add `blurred·boost·0.5`. Produces a dreamy glow, not shaped out-of-focus discs. No blade count, no cat-eye, no disc kernel, bloom done in gamma space.
**Granularity:** radius (0–30), threshold (0.4–0.98), strength, highlights. Reasonable controls but for the _wrong_ model.
**Verdict / top fix:** rename to "Dreamy/Bloom" or implement a true CoC disc kernel with highlight clipping recovered in linear light.

---

### 4. `depthBlur` — config L5954, impl L11007 (`createDepthBlurEffect`)

**Classification: APPROX.** Vertical focus plane: blur a copy once at `radius`, then per-row `blurFactor = clamp((|t-focusY|-range)/(0.5-range),0,1)` and `lerp(original, blurred, blurFactor)`. It's a single-level focus falloff (not a true variable-radius depth map), but the gradient is smooth and energy is fine. Honest "fake DOF by vertical band."
**Granularity:** focusY, range, radius. Missing: orientation (vertical only), real depth/CoC ramp (only one blur level interpolated).
**Verdict:** acceptable approximation; would benefit from a multi-level CoC stack (e.g. 3–4 blur levels selected by depth).

---

### 5. `tiltShiftMiniature` — config L8487, impl L11537 (`createTiltShiftMiniatureEffect`)

**Classification: BROKEN (controls disconnected).**

- Config exposes `focusY`, `focusHeight`, `blurStrength`, `saturation`.
- Implementation reads **`settings.focalLength` and `settings.aperture`** (L11541–11542) — **neither exists in the config**. So:
  - `focalRange = (focalLength ?? 50)*2` → always 100.
  - `blurStrength = 16/(aperture ?? 5.6)` → always ≈2.86 → `maxBlur = ceil ≈ 3`.
  - Focal band is **hardcoded to `height/2`** (`focusY` slider does nothing).
  - Saturation boost is **hardcoded 1.3** (the `saturation` slider does nothing).
- **All four sliders are dead.** The effect always renders the same fixed result.
  **Verdict / top fix:** wire the real setting ids (`focusY`, `focusHeight`, `blurStrength`, `saturation`) into the implementation — or delete it and route to `unifiedBlur` preset 2 (which actually works). This is the most clear-cut bug in the group.

---

### 6. `sharpen` — config L5886, dispatch L417

**Classification: COSMETIC / mislabeled.** Maps to `Konva.Filters.Enhance` with `enhance: value*0.5`. **Enhance is a per-channel contrast/saturation stretch, not a sharpen** (no high-pass, no unsharp mask, no edge detection). It increases global punch, not acutance. Additionally the config's **`opacity` slider is dead** (dispatch returns `[Enhance, {enhance}]`, opacity never applied).
**Granularity:** amount (0–10), opacity (dead). Missing everything real sharpen needs: radius, threshold, luminance-only, halo control.
**Verdict / top fix:** replace with a real unsharp mask (subtract `stackBlur` copy on luminance, with radius + amount + threshold), or point this id at the existing `smartSharpen` engine.

---

### 7. `smartSharpen` — impl `smartSharpenEffect.ts`; wired via `effects/index.ts` L153

**Classification: REAL (edge-aware unsharp mask).** Best-engineered sharpen in the app.

- Real **unsharp mask** (`unsharpMask` L149): `out = orig + amount·(orig − blurred)`, Gaussian blur per channel.
- **Edge-aware gating:** Sobel or Laplacian edge map normalized, gamma-shaped, thresholded; sharpening blended only where edges exceed threshold (`shouldSharpen`), so smooth areas/noise are spared. `preserveDetails` toggles graded vs binary blend.
- Optional **bilateral noise-reduction** pre-pass (`reduceNoise` L181) — real edge-preserving smoothing.
- Full pro controls: amount, radius, threshold, noiseReduction, edgeMode (sobel/laplacian/unsharp), preserveDetails, + 6 presets.
  **Math issues:**
  - Unsharp mask applied to **RGB channels independently** → can produce chroma/color halos; should sharpen **luminance only** and re-inject.
  - Blur is a **full 2D convolution** (`applyKernel`, non-separable) → O(n·k²); noise reduction is O(n·r²). Slow on large images. (The separable engine in OptimizedBlur is not reused here.)
  - Threshold math uses several magic multipliers (`*8`, `*9`, `*0.6`, `*2.0`) to separate modes — fragile but functional.
- **Not in the main `effectsConfig` switch** — only reachable via the `effects/index.ts` applyEffect map; no settings block was found in `effects.ts`, so it may have no slider UI in the Apple panel.
  **Verdict / top fix:** keep the algorithm; move to luminance-only sharpening and reuse the separable blur for speed; confirm it has a real UI/settings binding.

---

### 8. `unifiedWarp` — config L6507, impl L3612 (`createUnifiedWarpEffect`)

**Classification: APPROX overall (one BROKEN-for-quality trait shared by all sub-warps; one unseeded preset).**
8 presets, each a helper (L3670–3967). **All use `Math.round` on source coords → nearest-neighbor.**

- **Pixelate `applyPixelateWarp` (L3670):** block **area-average**. REAL (good).
- **Swirl (L3712):** angle-by-distance rotation, NN sample. APPROX, jaggy on curved features.
- **Kaleidoscope (L3747):** segment fold + reflect, NN. APPROX.
- **Fisheye (L3789):** `pow(dist,amount)/dist` radial remap, NN. APPROX. Center (dist→0) → NaN coords → pixel left untouched.
- **Spherize (L3823):** `sqrt(1-f²)` sphere factor, NN. APPROX.
- **Pinch/Bulge (L3858):** `pow(factor,1-amount)`, divides by `factor` → 0/0 NaN at exact center (pixel untouched). APPROX.
- **Wave (L3893):** sinusoidal x/y offset, NN. APPROX.
- **Shatter `applyShatterWarp` (L3920):** nearest-shard Voronoi displacement, NN. **Uses unseeded `Math.random()` for shard centers/offsets (L3933–3936)** → live preview ≠ export, and re-randomizes every re-render.
  **Granularity:** preset, amount, centerX/Y, segments, radius, frequency, opacity (opacity blend works, base = original tempData). Good breadth. Missing: NONE of the warps interpolate (quality), no per-warp anti-alias/supersample, wave has only one axis-coupled mode.
  **Verdict / top fix:** add a shared **bilinear sampler** and route every backward-mapped sub-warp through it; seed shatter with `mulberry32`.

---

### 9. `swirl` (standalone) — config L7823, impl L2664 (`createSwirlEffect`)

**Classification: APPROX.** Correct backward-map swirl (`angleOffset = strength·(1−dist/radius)`), pooled temp buffer, transparent out-of-bounds. **NN sampling (`Math.round`, L2694).** Jaggy spiral edges. Strength range −20..20 (good, supports CCW). centerX/Y, radius%, opacity.
**Verdict:** good math, needs bilinear.

---

### 10. `mosaic` — config L7946, impl L2717 (`createMosaicEffect`)

**Classification: REAL.** Tile **area-average** (reads original `data`, writes `outputData`, copies back). Includes alpha in the average. Correct, no aliasing concern (it's intentional blocking). Only one control: tileSize 2–50.
**Verdict:** fine; could add shape/grout options.

---

### 11. `kaleidoscope` (standalone) — config L8060, impl L2770 (`createKaleidoscopeEffect`)

**Classification: APPROX.** Clean angle-fold with reflection, pooled temp, transparent out-of-bounds. **NN sampling (`Math.round`, L2797).** segments 2–32, centerX/Y%. No interpolation → mirror seams alias.
**Verdict:** good structure, needs bilinear.

---

### 12. `kaleidoscopeFracture` — config L8342, impl L9849 (`createKaleidoscopeFractureEffect`)

**Classification: APPROX / COSMETIC.** Angle quantized to wedges + a `sin(distance)` "fractal" wobble + parity mirror; **NN via `Math.floor` (L9881).** The math is ad-hoc (`fractalOffset*0.01`, parity test on `(angle+π)/step`) and produces a stylized fracture rather than a clean kaleidoscope. Only segments + center; no control over the fracture/wobble amount.
**Verdict:** stylistic; floor-sampling + uncontrolled wobble make it the roughest of the mirror effects.

---

### 13. `fisheyeWarp` (standalone) — config L8242, impl L9292 (`createFisheyeWarpEffect`)

**Classification: APPROX.** Proper barrel/pincushion via `atan(normalizedDist·factor·2)/(factor·2)` with `strength −1..1`, divide-by-zero guards, coords clamped (no holes). Solid lens model. **But NN sampling (`Math.round`, L9329).** Single `strength` control only.
**Verdict:** best warp _model_ here; let down by NN sampling. Bilinear would make it genuinely usable.

---

### 14. `pixelate` (standalone) — config L5989, dispatch L420

**Classification: REAL.** Delegates to `Konva.Filters.Pixelate` (block average). pixelSize 1–128. Note the config's `opacity` slider is **dead** (dispatch passes only `pixelSize`). Otherwise correct, area-based.
**Verdict:** fine; wire opacity or drop it.

---

### 15. `dispersionShatter` — config L8553, impl L11694 (`createDispersionShatterEffect`)

**Classification: APPROX (+ unseeded).** Inverse-square repulsion field from N random points → per-pixel displacement, backward-mapped, coords clamped. **NN via `Math.floor` (L11731).** **Unseeded `Math.random()` for shatter points (L11709–11712)** → preview ≠ export, re-randomizes each render. Controls: dispersionAmount, shatterIntensity.
**Verdict / top fix:** seed with `mulberry32`; bilinear sample.

---

### 16. `pixelExplosion` — config L8216, impl L9216 (`createPixelExplosionEffect`)

**Classification: BROKEN (forward-mapping holes).**

- It is **forward-mapped**: iterates _source_ pixels and writes each to a scattered _target_ (`outputData[targetIndex] = tempData[srcIndex]`, L9280). Forward scatter **leaves holes / gaps** where no source maps and overwrites where many collide. `outputData` is pre-seeded with the original, so gaps show the un-exploded image through the scatter — a muddy, half-applied look rather than clean displacement.
- Seeding is **correct** (its own LCG, `seed` default → 12345), so it's deterministic.
- NN target via `Math.round`.
  **Granularity:** strength 5–100, numPoints 1–20 (no `seed` slider exposed in config though the impl supports it).
  **Verdict / top fix:** convert to **backward mapping** (for each output pixel, compute where it came from) to eliminate holes; then bilinear sample.

---

### 17. `geometric` — config L7442 (category Texture), impl L686 (`createGeometricAbstraction`)

**Classification: COSMETIC.** Not a warp — an abstraction filter: white canvas, per-cell area-average color, then draws one of 4 shapes (square/circle/triangle/diamond) chosen by `Math.floor((rand/(1-complexity))*4)%4`. **Unseeded `Math.random()` (L726)** → different result every render (preview ≠ export). `gridSize`, `complexity`. The `1-complexity` divisor can blow up as complexity→1 (rand/~0 → large) but `%4` saves it.
**Verdict:** stylistic generator; needs seeding for stable preview/export.

---

## Cross-cutting issues

1. **Nearest-neighbor everywhere (the "damage").** No bilinear/bicubic sampler exists. Affects swirl, kaleidoscope (x2 + fracture), fisheye (x2), spherize, pinch, wave, shatter, dispersionShatter, pixelExplosion. Produces stair-stepping/jaggies, worst on diagonals, curved features, and at high distortion amounts. This is what makes the warps look like they "damage" the image.
2. **Unseeded `Math.random()`** in: unifiedWarp→shatter, dispersionShatter, geometric (and out-of-scope: chromaticGlitch, liquidMetal). Live preview will not match export and re-randomizes on every re-render. `mulberry32` is already available and unused by these.
3. **Dead / disconnected controls:** `tiltShiftMiniature` (all 4 sliders), `sharpen` opacity, `pixelate` opacity.
4. **Gamma-space blur for bloom-type effects.** `gaussianBlurLinear` (energy-correct) exists but only `neonGlowEdges` uses it. Bokeh/Bloom-style highlight behaviour is therefore physically wrong.
5. **`sharpen` is not a sharpen** (Konva Enhance), and **`smartSharpen` sharpens RGB not luminance** (chroma halos) and is non-separable (slow).

## Counts

- **REAL: 5** — blur, unifiedBlur (overall), smartSharpen, pixelate, mosaic (plus motion/tilt/radial sub-presets are individually real)
- **APPROX: 8** — bokeh, depthBlur, unifiedWarp (overall), swirl, kaleidoscope, kaleidoscopeFracture, fisheyeWarp, dispersionShatter
- **COSMETIC: 2** — sharpen, geometric
- **BROKEN: 2** — tiltShiftMiniature (dead controls), pixelExplosion (forward-map holes)
