# HAX Effects Audit — Group 2: Color / Tone / Print

Repo: `/Users/paul/Desktop/Active Projects/Cursor Projects/imager2`
Engine: `src/lib/effects.ts` (~12,800 lines). Helpers: `src/lib/effects/color-space.ts`, `src/lib/randomizer/palette.ts`.
Scope: read-only audit. No source modified.

## Cross-cutting context

- **Luma weights are BT.601 (0.299/0.587/0.114) in gamma (sRGB) space almost everywhere** in this group (`getLuminance` line 123). That is the de-facto convention of the codebase and is acceptable for _stylistic_ tone mapping, but it is **not** photometric. The infra for correct linear-light Rec.709 luma exists and is unused by this group: `SRGB_TO_LINEAR` LUT + `linearToSrgbByte` (color-space.ts). Only exposure/temperature/bloom were converted to linear; the color-grade effects were not.
- **`Konva.Filters.Grayscale` uses `0.34·r + 0.5·g + 0.16·b`** (verified in `node_modules/konva/lib/filters/Grayscale.js`) — ad-hoc weights that match neither BT.601 nor Rec.709, and **inconsistent with every hand-written effect in the file**. Green is under-weighted, blue over-weighted vs both standards.
- **OKLab→sRGB is already available** (`oklch2rgb`, palette.ts line 21) but no color-ramp effect uses it. Every gradient/duotone interpolation is done in **naive sRGB**, the classic cause of muddy/desaturated midtones.
- `clampByte` (line 113) now rounds-half-up (good; the old truncating `|0` bias was fixed). `lerp` (137), `applyOpacityBlend` (142).

---

## 1. grayscale

- **Location:** dispatch line 437 → `Konva.Filters.Grayscale` (library built-in). Config line 5715 (label only, no settings).
- **Classification: APPROX** (works, but wrong/ad-hoc weights).
- **Math:** `0.34·r + 0.5·g + 0.16·b`, gamma-space, no clamp issues. Weights are non-standard (not 0.299/0.587/0.114, not 0.2126/0.7152/0.0722). Result is perceptibly off vs every other grayscale path in the app (e.g. `computeGrayscale` at 10326 uses BT.601). Greens render darker, blues lighter than they should.
- **Granularity:** none (no settings). No intensity/opacity.
- **Verdict + fix:** Replace the Konva built-in with a one-line BT.601 (or linear Rec.709) custom filter so grayscale matches the rest of the app and is photometrically defensible. **Highest-value fix: swap `Konva.Filters.Grayscale` for a custom luma filter using the file's own weights.**

## 2. blackAndWhite

- **Location:** config 5719, impl `createBlackAndWhiteEffect` line 1414. Dispatch 440.
- **Classification: REAL** (simple but grounded).
- **Math:** BT.601 luma (gamma space) → brightness add → contrast about a **128 gamma pivot** (not a linear/perceptual mid) → clamp. Standard stylistic B&W. Contrast pivot at 128 is slightly off perceptually but conventional.
- **Granularity:** `contrast` 0.5–2 (def 1.2), `brightness` −0.3–0.3 (def 0). Sensible.
- **Missing pro controls:** no **channel mixer** (per-R/G/B weighting, the standard pro B&W control for skies/skin), no tone/tint, no grain.
- **Verdict + fix:** Solid. Best add = a 3-slider channel mixer so users can darken skies / lighten skin like Lightroom B&W.

## 3. sepia

- **Location:** dispatch 443 → `Konva.Filters.Sepia`. Config 5727 (label only).
- **Classification: REAL** (canonical sepia matrix 0.393/0.769/0.189 …, verified in Konva source).
- **Math:** The well-known "Microsoft" sepia matrix, gamma space, `Math.min(255)` clip. Correct and recognizable.
- **Granularity:** none — no intensity/opacity. All-or-nothing.
- **Verdict + fix:** Fine but rigid. `unifiedMono` tone=1 is the controllable sepia path and should be preferred in UI. Best add here = an intensity/opacity slider (blend with original).

## 4. unifiedMono (grayscale / sepia / cyanotype / cool / warm)

- **Location:** config 5732, impl `createUnifiedMonoEffect` line 1449. Dispatch 446.
- **Classification: APPROX — borderline BROKEN for the neutral preset.**
- **Math problem (significant):** tone is applied as `out = gray · (h·t + s·(1−t))` where `t = gray/255`. For the **neutral "Gray" preset** (h=[1,1,1], s=[0,0,0]) this collapses to `out = gray·(gray/255) = gray²/255` — a quadratic darkening, **not an identity grayscale**. Mid-gray 128 → **64**. So the supposedly-neutral monochrome **crushes midtones** by roughly a full stop. Every other tone inherits the same structure: the formula **conflates tone-color with a brightness multiply**, so shadows (small `s`) are heavily darkened (e.g. Sepia shadow factor 0.3) → muddy, dark results.
- **Granularity:** `tone` 0–4, `intensity` %, `contrast` %, `brightness` %. Good surface area; the engine underneath is the problem.
- **Verdict + fix:** **Highest-value fix: rewrite the tone application so neutral = true grayscale (out = gray) and tints are added as a hue/chroma offset around the gray axis (ideally in OKLab) rather than a per-channel multiply.** This removes the midtone crush and the muddy shadows in one change.

## 5. duotone

- **Location:** config 5755, impl `createDuotoneEffect` line 1501. Dispatch 461.
- **Classification: APPROX** (real concept, naive color space).
- **Math:** BT.601 brightness (gamma) → `lerp(color1, color2, brightness)` **in sRGB**. Opacity blend with original (correctly buffered). Because the interpolation is sRGB, a saturated complementary pair (default blue 0x0000FF → yellow 0xFFFF00) passes through a **desaturated gray mud** in the midtones instead of a clean perceptual ramp.
- **Granularity:** `color1`, `color2`, `opacity`. **Missing:** midtone color (tritone), per-ink **curve/gamma** on the brightness mapping (Photoshop duotone's defining control), contrast/black-point.
- **Verdict + fix:** **Highest-value fix: interpolate the two inks in OKLab (`oklch2rgb` already exists) and add an optional midtone color (tritone).** This alone fixes the muddy midtones and is the single biggest perceptual upgrade in this group.

## 6. gradientMap

- **Location:** config 5787, impl `createGradientMapEffect` line 10430. Dispatch 629.
- **Classification: APPROX** (better than duotone, still sRGB).
- **Math:** BT.601 luma → piecewise lerp shadow→mid (u = t/midpoint) and mid→highlight, **in sRGB**. `strength` blends to original. Editable `midpoint` and 3 editable colors are a genuine plus.
- **Banding:** a 3-color ramp stretched over 256 luma levels with **no dithering** will band visibly on smooth gradients/skies.
- **Granularity:** `shadowColor`, `midColor`, `highlightColor`, `midpoint` 0.1–0.9, `strength` 0–1. **Missing:** arbitrary N stops with positions, OKLab interpolation, optional **dithering** to kill banding, blend modes.
- **Verdict + fix:** OKLab interpolation + a dither toggle. (Shares the duotone OKLab fix — do both together.)

## 7. cinematicLut

- **Location:** config 5847, impl `createCinematicLutEffect` line 10475. Dispatch 637.
- **Classification: APPROX — and mislabeled.**
- **Math:** **There is no LUT.** It is 4 hardcoded parametric presets (Teal/Orange default = shadows pushed teal, highlights pushed orange; Bleach = sigmoid contrast + desat; Film Fade = lifted blacks; Pastel) built from `toneCurve01` (sigmoid) + magic per-channel adds/desats, all in gamma space. The default split-tone is reasonable; constants are ad-hoc.
- **Bug — strength applied twice:** each preset already scales its move by `strength` internally (e.g. case 1 `desat = 0.65·strength`, default `+34·strength·highlight`) **and then** the loop does `lerp(orig, result, strength)` again → the effect is **quadratic in strength**, so the slider is mushy at low values.
- **Granularity:** `preset` 0–3, `strength`. **Missing:** real `.cube`/3D-LUT import (which the name promises), separate shadow/highlight tint balance, hue/sat per zone.
- **Verdict + fix:** Either ship a real LUT loader (honest to the name) or rename to "Cinematic Grade." **Cheapest correctness fix: remove the double `strength` application** so the slider is linear.

## 8. selectiveColor

- **Location:** config 7963, impl `createSelectiveColorEffect` line 10250. Dispatch 511.
- **Classification: APPROX — mislabeled, with two quality bugs.**
- **Math:** RGB→HSL, keep hues within `±range` of `targetHue` and boost their saturation; **desaturate everything else to gray**. This is a "pop-color / Sin City" isolation, **not** Photoshop "Selective Color" (which is per-color-family CMYK adjustment). Two issues:
  1. **Binary hue cutoff** (`hueDiff <= range`) → **hard, aliased edges** between kept and desaturated regions; no feathering.
  2. **Desaturation uses HSL lightness** `(max+min)/2` as the gray value, not perceptual luma → desaturated areas come out the **wrong brightness** (saturated blues turn too-light gray).
- **Granularity:** `hue`, `range`, `saturation` boost. **Missing:** feather/smoothness, target-luma/lightness control, hue-shift of the target, and the actual per-channel CMYK-style sliders the name implies.
- **Verdict + fix:** **Highest-value fix: feather the hue mask (smooth falloff over `range`) and desaturate using BT.601 luma instead of HSL lightness.** Both are small and remove the harsh edges + wrong grays.

## 9. colorQuantization

- **Location:** config 7745, impl `createColorQuantizationEffect` line 2391. Dispatch 497.
- **Classification: REAL** (correct Floyd–Steinberg) **but with a misleading control + gamma-space issue.**
- **Math:** Uniform per-channel quantization `round(v/step)·step`, `step = 256/numColors`. Optional **Floyd–Steinberg** dithering with correct 7/3/5/1 weights diffused into a `tempData` copy. Deterministic (no RNG) so preview==export.
- **Issues:**
  1. **"Number of Colors" is per-channel levels, not total colors.** `numColors=16` = 16 levels _per channel_ = up to **4096** colors, not 16. The label is wrong/misleading; there is **no real palette reduction** (no median-cut / k-means).
  2. Quantization + dithering happen in **gamma space**, so the levels are perceptually uneven and dither noise is mis-weighted in shadows.
  3. Error diffusion accumulates into a `Uint8ClampedArray`, so large errors **clamp at 0/255** before diffusing — minor diffusion degradation, acceptable.
- **Granularity:** `numColors` 2–64, `dithering` 0/1. **Missing:** true palette mode (median-cut), ordered-dither option, gamma-correct toggle.
- **Verdict + fix:** Relabel to "Levels per channel," or implement true median-cut palette so "N colors" means N colors. Dithering itself is correctly implemented.

## 10. heatmap

- **Location:** config 8121, impl `createHeatmapEffect` line 2856. Dispatch 525.
- **Classification: REAL** (for this group, the best-grounded).
- **Math:** BT.601 luma → gradient lookup. Four maps: Classic rainbow (jet-style), **Inferno** and **Viridis** (5-stop approximations of the genuine perceptually-uniform matplotlib maps — good values), Grayscale. Interpolation is sRGB, which is fine since these palettes are _defined_ in sRGB; 5 stops is a coarse but acceptable sampling.
- **Granularity:** `gradientType` 0–3 only. **Missing:** input range min/max (clamp/window the luma), invert, opacity blend, more stops for smoother Viridis.
- **Verdict + fix:** Functionally correct. Best add = a min/max range window + invert, so it works as a real data-viz remap rather than a fixed full-range map.

## 11. thermalPalette

- **Location:** impl `createThermalPaletteEffect` line 11378. Dispatch 543. **Listed in the Color category browser (line 11128).** **NO `effectsConfig` entry** (grep confirms only dispatch/category/impl references — no `thermalPalette:` config).
- **Classification: BROKEN.**
- **Two compounding failures:**
  1. **Orphaned config:** it shows up in the Color category but has **no config object → no label override and no settings sliders.** The user gets an effect with zero controls.
  2. **Hardcoded param clips the palette to its middle half:** the only parameter, `sensitivity`, has no slider so it stays at the default `0.5`. The mapping is `temp = brightness·sensitivity + (1−sensitivity)·0.5`, which at 0.5 gives `temp ∈ [0.25, 0.75]`. The cold band (`temp<0.25`, black→blue) and the hot band (`temp>0.75`, yellow→white) are **mathematically unreachable.** Black input → deep blue, white input → yellow; **no black, no deep blue, no white-hot, no contrast.** A washed-out blue→cyan→yellow remap.
  3. It also **duplicates `heatmap`** (both map luma→thermal colors).
- **Verdict + fix:** **Highest-value fix: either delete it (heatmap already covers thermal viz) or register a config with a `sensitivity` slider defaulting to ≥1.0 so the full black→white-hot range is reachable.** As shipped it is a controls-less, range-clipped duplicate.

## 12. holographicInterference

- **Location:** config 8399, impl `createHolographicInterferenceEffect` line 9965. Dispatch 571.
- **Classification: COSMETIC** (decorative; mislabeled "interference").
- **Math:** Brightness via **simple average `(r+g+b)/3`** (not luma). Two sine gratings in x and y → `interference`; `hue = (interference + brightness)·2π` → manual HSV-sector→RGB with `chroma = brightness·0.8`; blended with original at a **hardcoded 0.6**. This is a procedural rainbow-grating overlay — **no thin-film physics** (no wavelength, film thickness, Fresnel, or viewing angle). Aesthetic only.
- **Granularity:** `frequency` 1–20, `phaseShift` 0–1. **Missing:** opacity/blend amount (hardcoded 0.6), grating angle/anisotropy, saturation. Uses ad-hoc `(r+g+b)/3`.
- **Verdict + fix:** Fine as a decorative effect; the name oversells it. Best add = expose the blend (the hardcoded 0.6) as an opacity slider.

## 13. unifiedPrint (riso / newsprint / linocut / screenprint / letterpress)

- **Location:** config 6684, impl `createUnifiedPrintEffect` line 4184; sub-effects: `applyRisographEffect` 4298, `applyNewsprintEffect` 4395, `applyLinocutEffect` 4460, `applyScreenPrintEffect` 4529, `applyLetterpressEffect` 4570, `applyPaperGrain` 4639. Dispatch 662.
- **Classification: APPROX overall** (Newsprint is the most grounded; the rest are stylistic approximations).
- **Per preset:**
  - **Newsprint (REAL-ish):** proper CMYK separation (`c=1−r/255`, `k=min(c,m,y)`), per-channel **rotated AM screens at 15/75/0/45°** with a `sin·sin` dot threshold. A legitimate rotated-halftone approximation — the strongest part of this effect.
  - **Risograph (APPROX, buggy):** nearest spot color + a halftone threshold `((x%dot)/dot + (y%dot)/dot)/2` which is a **diagonal linear gradient, not a clustered dot** — reads as a gradient screen, not riso dots. Then registration + ink bleed.
  - **Linocut / Screenprint / Letterpress:** edge+threshold carving / nearest-palette posterize / emboss-by-luma. All reasonable stylistic approximations with magic constants.
- **Bug — unseeded randomness (preview ≠ export):** `applyRisographEffect` registration uses **`Math.random()`** (lines 4352–4353) and `applyPaperGrain` uses **`Math.random()`** (line 4646). The codebase ships `mulberry32` (color-space.ts) specifically so stochastic effects are deterministic and the live preview matches the export — these two were not converted, so **riso registration + paper grain flicker between the preview pass and the exported PNG.**
- **Granularity:** Rich and the best in this group — `preset`, `intensity`, `colorCount` (2–4), `dotSize`, `registration`, `paperTexture`, `inkBleed`, `opacity`. Properly buffered + opacity blend.
- **Verdict + fix:** Good control surface. **Highest-value fix: seed the randomness with `mulberry32` (registration + paper grain) so preview == export**; secondary, make the riso halftone a real clustered-dot/spot pattern instead of a diagonal gradient.

---

## Classification tally

| Effect                  | Class                                         |
| ----------------------- | --------------------------------------------- |
| grayscale               | APPROX (wrong/ad-hoc Konva weights)           |
| blackAndWhite           | REAL                                          |
| sepia                   | REAL (canonical matrix, no controls)          |
| unifiedMono             | APPROX (borderline BROKEN — midtone crush)    |
| duotone                 | APPROX (sRGB interp → muddy)                  |
| gradientMap             | APPROX (sRGB interp + banding)                |
| cinematicLut            | APPROX (not a LUT; double-strength bug)       |
| selectiveColor          | APPROX (hard mask + HSL-gray bug)             |
| colorQuantization       | REAL (FS correct; misleading "colors")        |
| heatmap                 | REAL                                          |
| thermalPalette          | **BROKEN** (orphan config + range clipped)    |
| holographicInterference | COSMETIC (decorative, mislabeled)             |
| unifiedPrint            | APPROX (newsprint REAL-ish; unseeded RNG bug) |

Counts: **REAL 3** (blackAndWhite, sepia, heatmap; colorQuantization REAL-with-caveat) · **APPROX 7** (grayscale, unifiedMono, duotone, gradientMap, cinematicLut, selectiveColor, unifiedPrint) · **COSMETIC 1** (holographicInterference) · **BROKEN 1** (thermalPalette). (colorQuantization counted under REAL.)

## Three worst problems

1. **thermalPalette is BROKEN** — orphaned (no config → no sliders) and its hardcoded `sensitivity=0.5` mathematically clips the palette to its middle half (no black, no white-hot). Also duplicates heatmap.
2. **unifiedMono crushes midtones** — the neutral "Gray" tone evaluates to `gray²/255` (128→64); the tone formula multiplies brightness by the tint, darkening/muddying all presets. The "monochrome" base isn't a faithful grayscale.
3. **All color ramps interpolate in sRGB** (duotone, gradientMap; plus selectiveColor's HSL-lightness gray and cinematicLut's gamma-space math) → muddy, desaturated midtones — despite OKLab (`oklch2rgb`) already being available in the repo.

## Three highest-value fixes

1. **OKLab-interpolate duotone + gradientMap** (and add a duotone midtone/tritone color). Uses the existing `oklch2rgb`; kills the muddy midtones across the two flagship color-grade effects in one change.
2. **Fix/decide thermalPalette** — register a `sensitivity` slider (default ≥1.0) so the full range is reachable, or delete it (heatmap covers thermal viz). Trivial cost, removes a visibly broken, controls-less effect.
3. **Rewrite unifiedMono tone application** so neutral = true grayscale and tints are added as a hue/chroma offset (ideally OKLab) instead of a brightness multiply — eliminates the midtone crush and muddy shadows for all five tones.

Bonus low-cost wins: seed `unifiedPrint` RNG with `mulberry32` (preview==export); remove `cinematicLut`'s double-`strength`; swap Konva grayscale for the file's own BT.601 weights; feather `selectiveColor`'s hue mask + use luma (not HSL lightness) for its desaturation.
