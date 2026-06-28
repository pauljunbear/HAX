# HAX Effects Audit — Group 1: Adjust / Tone

Repo: `/Users/paul/Desktop/Active Projects/Cursor Projects/imager2`
Engine: `src/lib/effects.ts` (12,756 lines). Dispatch `switch` at line 382 (`applyEffect`).
Quality helpers: `src/lib/effects/color-space.ts`.
Konva built-ins read from `node_modules/konva/lib/filters/{Brighten,Contrast,HSL,Invert}.js`.

All per-pixel math runs on 8-bit gamma-encoded bytes unless noted. `clampByte` (line 113) and
`clampByteRound` (color-space.ts:21) both round-half-up — the historical `| 0` downward bias is fixed.
None of these effects use randomness, so preview == export (determinism is a non-issue here).

---

## Summary table

| Effect           | Impl (fn / line)                             | Backend | Class    | Color space | Worst issue                                           |
| ---------------- | -------------------------------------------- | ------- | -------- | ----------- | ----------------------------------------------------- |
| brightness       | `Konva.Filters.Brighten` (dispatch 382)      | Konva   | APPROX   | gamma       | additive offset, not a perceptual/multiplicative lift |
| contrast         | `Konva.Filters.Contrast` (dispatch 388)      | Konva   | REAL     | gamma       | pivot locked to 128, no midpoint control              |
| saturation       | `Konva.Filters.HSL` (dispatch 394)           | Konva   | REAL     | gamma       | −100 can't reach grayscale; description is false      |
| hue              | `Konva.Filters.HSL` (dispatch 403)           | Konva   | REAL     | gamma       | none significant                                      |
| colorTemperature | `createColorTemperatureEffect` (2935)        | custom  | REAL     | **linear**  | heuristic warm/cool, not colorimetric                 |
| dehaze           | `createDehazeEffect` (10376)                 | custom  | APPROX   | gamma       | no haze/transmission model; global tone+sat push      |
| relight          | `createRelightEffect` (10552)                | custom  | COSMETIC | gamma       | no normals/lighting; positional ramp only             |
| toneCurve        | `createToneCurveEffect` (10412)              | custom  | REAL     | gamma       | single `amount`, per-channel (sat shift)              |
| threshold        | `createThresholdFallback` (213)              | custom  | REAL     | gamma       | **opacity slider defined but never wired**            |
| posterize        | `createPosterizeFallback` (182)              | custom  | REAL     | gamma       | by-design banding (no dither)                         |
| invert           | `Konva.Filters.Invert` (dispatch 449)        | Konva   | REAL     | gamma       | none                                                  |
| levels           | —                                            | —       | ABSENT   | —           | claimed in CLAUDE.md, not implemented                 |
| exposure         | inside `createUnifiedFilmEffect` (4664/4680) | custom  | REAL     | **linear**  | not a standalone Adjust effect                        |
| gamma            | —                                            | —       | ABSENT   | —           | claimed in CLAUDE.md, not implemented                 |

---

## brightness — APPROX

- **Location:** dispatch line 382 → `Konva.Filters.Brighten`. Slider `value` −100..100, step 0.5, default 0; mapped `value/100` → Konva `brightness` −1..1.
- **Math:** `Brighten` does `data[i] += brightness*255` per channel (additive offset on gamma bytes). At +100 it adds 255 (everything clips white); at −100 it subtracts 255 (everything crushes black).
- **Why APPROX, not REAL:** an additive offset is a _black-level lift_, not a brightness control. A photographic "brightness" is multiplicative (a gain) or a gamma/midtone push — those preserve highlight/shadow detail and move midtones smoothly. The additive form clips highlights to flat white and lifts shadows to flat gray very fast, with no midtone roll-off. It is a recognized operation, just the wrong one for the label.
- **Color space:** gamma. Operating in gamma makes the additive shift especially non-uniform perceptually.
- **Granularity:** one slider. Missing: a true exposure/gain mode, a gamma/midtone option, shadow/highlight split.
- **Verdict:** APPROX. **Highest-value fix:** replace additive lift with a midtone-preserving curve — either a multiply in linear light (`SRGB_TO_LINEAR` → ×gain → `linearToSrgbByte`) or a gamma push; reserve the additive offset for a separate "Black Point/Lift" control.

## contrast — REAL (gamma, crude)

- **Location:** dispatch 388 → `Konva.Filters.Contrast`. Slider −100..100, passed straight to Konva `contrast`.
- **Math:** `adjust = ((c+100)/100)^2`; per channel `(b/255 − 0.5)*adjust + 0.5`, then ×255, clamp. Pivots around 0.5 (byte 128) — the conceptually correct neutral pivot. At c=+100, adjust=4 (steep); at c=−100, adjust=0, so the whole image collapses to flat 128 gray.
- **Color space:** gamma bytes. A pivot of 128 in gamma ≈ perceptual mid, so this is acceptable; a "correct" contrast in linear light would pivot near 0.18, which most editors do _not_ do. Konva's approach is the industry-common simple form.
- **Granularity:** one slider. Missing: adjustable pivot/midpoint, per-channel contrast, an S-curve "soft" mode (the sigmoid in `toneCurve` is actually the nicer contrast and isn't reachable from this control).
- **Verdict:** REAL. **Highest-value fix:** expose a midpoint/pivot setting (and consider routing "soft" contrast through the existing `toneCurve01` sigmoid for highlight/shadow roll-off instead of the hard parabola).

## saturation — REAL (algorithm) with a range/label bug

- **Location:** dispatch 394 → `Konva.Filters.HSL`. Slider −100..100 → `value/100` → HSL `saturation`.
- **Math:** HSL builds `s = 2^saturation` and applies the **YIQ luma-preserving chroma matrix** (HSL.js). This is a proper saturation: at `value=0`, s=1 → identity row `[1,0,0]`; as s→0 each row → BT.601 luma weights → true grayscale. Far better than a crude lerp-to-gray. Luminance is preserved by construction.
- **The bug:** the slider maps −100 → `saturation=-1` → `s = 2^-1 = 0.5`, i.e. only **half** chroma. Full grayscale requires `s=0` (saturation → −∞), unreachable. The inline comment claims "−100 => ~0x" and the UI description says **"−100 removes all color"** — both false. Users cannot desaturate to B&W with this control. (The comment is right that the prior `/10` mapping over-saturated to 1024× at +100; the fix corrected the top end but left the bottom end mislabeled.)
- **Color space:** gamma (standard for this matrix).
- **Granularity:** one slider. Missing: true full-desaturation at −100, a vibrance (saturation-weighted) mode, per-channel/HSL-band saturation.
- **Verdict:** REAL but the range is wrong for its own label. **Highest-value fix:** remap so −100 = full grayscale — e.g. for negative values lerp toward luma directly (`out = lerp(gray, color, 1+value/100)`) or drive `s` to 0; then make the description true.

## hue — REAL

- **Location:** dispatch 403 → `Konva.Filters.HSL` with `hue` degrees (0..360), `saturation` defaulting to 0 → s=1.
- **Math:** the YIQ hue-rotation matrix (cos/sin of hue angle) — the canonical luminance-preserving hue rotation. This is a genuine rotation, not a channel swap.
- **Color space:** gamma. Standard; a linear-light rotation would shift saturated hues slightly differently but gamma is the convention.
- **Granularity:** one slider (0..360). Fine for a global hue. Missing only niche controls (per-band hue shift = selectiveColor territory, which exists separately).
- **Verdict:** REAL. No high-value fix needed; lowest priority in the group.

## colorTemperature — REAL (best-implemented in the group)

- **Location:** `createColorTemperatureEffect` (2935); dispatch 507.
- **Math:** decodes to linear via `SRGB_TO_LINEAR`, applies per-channel gains
  `gainR=(1+t)(1+tn)`, `gainG=(1−tn)`, `gainB=(1−t)(1+tn)` (t=temp/200, tn=tint/200), then **renormalizes per-pixel to preserve Rec.709 luminance** (`k = yIn/yOut`), re-encodes via `linearToSrgbByte`. Correctly notes the old gamma-byte multiply brightened on warm / darkened on cool.
- **Color space:** **linear light** — correct for a white-balance gain, and luminance-preserving. This is the model the rest of the group should aspire to.
- **Caveats:** the warm/cool gains are an ad-hoc R-up/B-down heuristic, not a Planckian-locus / Bradford chromatic-adaptation transform, so it's perceptually plausible but not colorimetrically a true Kelvin shift. Per-pixel luminance renormalization can subtly twist hue/saturation in already-saturated regions (a constant scene-referred gain would be cleaner), but the trade keeps brightness stable.
- **Granularity:** temperature + tint, both −100..100. Good. Missing: a Kelvin readout, a "preserve luminance" toggle, optional gray-point picker.
- **Verdict:** REAL. **Highest-value fix (optional):** swap the heuristic gains for a Bradford-based Kelvin model if true temperature accuracy is wanted; otherwise leave as is.

## dehaze — APPROX

- **Location:** `createDehazeEffect` (10376); dispatch 639.
- **Math:** per pixel computes BT.601 luma `l`, pushes it through the sigmoid `toneCurve01(l, k=1+amount*6)` (a strong global contrast), scales RGB by `ratio=l2/l` to keep chroma proportions, then bumps saturation `sat=1+amount*0.5` around the new gray, and finally subtracts a flat `darken=amount*10` from every channel.
- **Why APPROX:** real dehaze (He et al. dark-channel prior) _estimates a spatially varying transmission map and the atmospheric airlight_, then inverts the haze model `J = (I − A)/t + A`. This implementation has no dark-channel, no transmission estimate, no airlight — it is a global contrast + saturation + black-point drop. It "clears" flat low-contrast images but cannot localize to actual haze, and the flat `−amount*10` is a crude uniform black-point shift.
- **Color space:** gamma; luma-driven ratio scaling is reasonable but a linear-light contrast would behave better.
- **Granularity:** one `amount` slider. Missing: separate haze/contrast/saturation/black-point, and any spatial estimate.
- **Verdict:** APPROX. **Highest-value fix:** implement a real (even cheap, downsampled) dark-channel-prior transmission estimate, or — if staying global — at minimum honestly relabel and split contrast vs. saturation vs. black-point into separate controls.

## relight — COSMETIC

- **Location:** `createRelightEffect` (10552); dispatch 643.
- **Math:** for each pixel computes normalized screen position `(nx,ny)` in −1..1, `dot = nx*cos(angle)+ny*sin(angle)`, `light = ambient + dot*strength*0.35`, `mult = 1+light`, multiplies RGB.
- **Why COSMETIC:** this is a **linear brightness gradient across the frame** in the direction of `angle` — it has _zero_ dependence on image content. Real relighting needs surface normals (estimable here from the luminance gradient via Sobel) and an N·L term so lighting follows form. As written it cannot light a face, an edge, or any structure; it just tilts a brightness wedge over the picture (closer to a directional vignette than relight).
- **Bug/labeling:** `ambient` is added into `mult` unconditionally (`mult = 1 + ambient + …`), so at default ambient=0.2 the entire image is gained ×1.2 — `ambient` acts as a global brightness, not the "base light level in shadow areas" the description promises.
- **Color space:** gamma; a lighting multiply ideally happens in linear light.
- **Granularity:** angle/strength/ambient. Missing everything that makes it lighting: a normal/depth estimate, falloff, specular, color of light.
- **Verdict:** COSMETIC (barely does the named thing). **Highest-value fix:** estimate per-pixel normals from the luminance gradient (Sobel → `N=normalize(−dx,−dy,k)`), compute `N·L`, multiply in linear light, and make `ambient` a true additive floor. If that's out of scope, rename to "Directional Gradient" so it isn't sold as relighting.

## toneCurve — REAL (single-knob)

- **Location:** `createToneCurveEffect` (10412); dispatch 635. Helper `toneCurve01` (10364), `sigmoid` (10362).
- **Math:** `k = exp(amount*1.8)` (amount −1..1), per channel `toneCurve01(c/255, k)*255`, where `toneCurve01` is a normalized logistic S-curve centered at 0.5. amount>0 steepens (adds contrast / S-curve), amount<0 flattens (de-contrast). A genuine sigmoid tone curve.
- **Notes:** applied **per channel independently**, so it increases saturation as a side effect (channel-independent contrast pulls colors apart) — fine for a "filmic contrast" look but not luminance-only. At `amount=0`, k=1 → a faint residual S (not a true identity), and the default is 0.25 so it always curves.
- **Color space:** gamma.
- **Granularity:** a single `amount`. The name "Tone Curve" implies editable control points / per-channel RGB curves; this is one global contrast knob. Missing: real curve points, per-channel curves, luminance-only mode.
- **Verdict:** REAL (it is a true sigmoid curve), but under-powered for its name. **Highest-value fix:** add multi-point control (at least shadows/mids/highlights anchors), or a luminance-preserving option; at minimum rename to "S-Curve Contrast" if it stays single-knob.

## threshold — REAL, with a dead control

- **Location:** `createThresholdFallback` (213); dispatch 426.
- **Math:** BT.601 luma `(0.299R+0.587G+0.114B)/255`, binary `>= level ? 255 : 0`. Correct, standard threshold. Hard binary with no anti-aliasing/dithering — expected and correct for a threshold.
- **The bug:** the config (lines 6052–6060) defines an **`opacity` slider**, but dispatch passes only `value` to `createThresholdFallback(value)` — `opacity` is never read. The slider is a no-op (dead UI). (Contrast with posterize, where opacity _is_ threaded through.)
- **Color space:** gamma luma — fine for threshold.
- **Granularity:** level + (dead) opacity. Missing: a soft/anti-aliased threshold width, per-channel threshold.
- **Verdict:** REAL effect, BROKEN sub-feature. **Highest-value fix:** wire `opacity` (blend result with original, as posterize does) or remove the slider so it isn't a lie.

## posterize — REAL

- **Location:** `createPosterizeFallback` (182); dispatch 431.
- **Math:** `step = 255/(levels−1)`, per channel `round(round(c/step)*step)`. Quantizes to `levels` evenly spaced steps (levels=4 → {0,85,170,255}). Standard posterization; opacity is correctly blended via `applyOpacityBlend`.
- **Color space:** gamma — this is the conventional/expected space for posterize (matches Photoshop); banding is the intended aesthetic, so the lack of dithering is correct here.
- **Notes:** the double `Math.round` is harmless redundancy (Uint8ClampedArray already rounds on store).
- **Granularity:** levels 2..32 + opacity. Good. Missing only: per-channel level counts (minor).
- **Verdict:** REAL. No high-value fix needed.

## invert — REAL

- **Location:** dispatch 449 → `Konva.Filters.Invert`. `255 − c` per channel; alpha untouched.
- **Color space:** gamma — the conventional photographic-negative behavior (a "true" linear invert is rarely wanted).
- **Verdict:** REAL. No fix needed. No settings (none needed).

## levels / gamma / standalone exposure — ABSENT

- The CLAUDE.md effect table lists **Adjust: brightness, contrast, saturation, exposure, gamma** — but there is **no `levels`, no `gamma`, and no standalone `exposure` effect** in `effectsConfig` (verified: no `case 'exposure'|'gamma'|'levels'|'vibrance'` and no top-level config keys).
- A correct, linear-light **exposure-in-stops** implementation _does_ exist — `makeExposureLUT` (color-space.ts:57) — but it is only used **inside `createUnifiedFilmEffect`** (line 4680) as a sub-setting, not surfaced as an Adjust control. This is the one tonal op in the codebase done the right way (linear light, +1 stop maps mid-gray 128→~176 instead of clipping).
- **Highest-value fix:** promote `makeExposureLUT` into a standalone "Exposure (stops)" Adjust effect, and add `gamma` (a `pow(c/255, 1/g)` LUT via `makeByteLUT`) and `levels` (black/white/gamma input + output range). These are the missing professional primitives and the helpers to build them already exist.

---

## Cross-cutting issues

1. **Gamma-space tonal math.** Everything except `colorTemperature` (and the buried exposure) operates on gamma bytes. The infrastructure for cheap linear-light work (`SRGB_TO_LINEAR` LUT, `linearToSrgbByte`, `makeByteLUT`, `makeExposureLUT`) is present and proven in `colorTemperature`/`unifiedFilm` but unused by brightness/contrast/relight/dehaze/toneCurve.
2. **8-bit, no dithering, in-place.** Chained Adjust ops compound banding; rounding is now correct (no downward bias) but there is no high-bit-depth working buffer. Acceptable for a CPU editor but worth noting for stacked tonal edits.
3. **Label/contract mismatches.** saturation ("−100 removes all color" — false), relight ("ambient = base light in shadows" — actually a global gain), threshold (opacity slider does nothing). These silently mislead users.
4. **Doc drift.** CLAUDE.md advertises exposure/gamma Adjust effects that don't exist as such.
