# R7 — Novel High-Value Effects for HAX

Proposals for **new** CPU-JS effects to add to the HAX image editor. Each is grounded in a
named algorithm, fits the existing engine, and is implementable on 8-bit RGBA with no depth
maps or ML (cheap heuristics noted where used).

## Engine fit (how every proposal plugs in)

All effects follow the established factory pattern in `src/lib/effects.ts`:

```ts
const createXEffect =
  (settings: Record<string, number>): KonvaFilterFunction =>
  (imageData: KonvaImageData) => {
    /* mutate data in place */
  };
```

Registration is three edits: `effectsConfig[id] = { label, category, settings:[…] }`, push the
id into `effectCategories` (`src/lib/effects/categories.ts`), and add a `case` to the dispatch
switch returning `[createXEffect(settings), {}]`.

**Primitives already in the repo I lean on** (so these stay cheap and consistent):

- `src/lib/effects/color-space.ts`: `SRGB_TO_LINEAR` (byte→linear LUT), `linearToSrgbByte`,
  `srgbByteToLinear`, `makeByteLUT(fn)`, `makeExposureLUT(stops)`, `clampByteRound`,
  `mulberry32(seed)` (deterministic PRNG so preview == export).
- `src/lib/performance`: `separableGaussianBlur`, `stackBlur`, `gaussianBlurLinear`,
  `getBufferPool` (reuse scratch buffers, no GC churn).
- Luminance: Rec.709 `Y = 0.2126R + 0.7152G + 0.0722B` (compute on linear where it must be
  physically correct: blur/bloom/exposure; on byte where it's only a mask).

**Convention for "modes":** settings are `Record<string, number>` only, so discrete modes ship
as an integer-stepped slider (`min:0, max:N, step:1`) — exactly how `unifiedBlur`/`unifiedGlitch`
already encode their preset selectors. No new type plumbing needed.

---

# PRO PHOTO-GRADE TOOLS

## 1. Clarity / Local Contrast (+ Texture, + midtone Dehaze)

**What:** Adds punch and "presence" by boosting _local_ contrast around mid-frequencies, masked
to midtones so highlights/shadows don't blow. The single most-requested pro slider that HAX
lacks (global `contrast` exists; local does not).
**Why distinctive:** This is the Lightroom Clarity/Texture/Dehaze trio. `sharpen` works at 1px;
this works at a chosen radius and is luminance-only + midtone-masked, so it sculpts form without
edge halos or color shift.

**Algorithm — unsharp mask on luminance with a midtone bell mask (Lightroom-style local contrast):**

1. Build luminance `L` from RGB (byte ok for the mask; linear for the blend).
2. Blur `L` with `separableGaussianBlur` at `radius` → `Lblur`. (Large radius = Clarity;
   small radius ≈ 2–4px = Texture.)
3. `detail = L − Lblur` (the local-contrast band).
4. Midtone mask `m = 1 − |2·(L/255) − 1|^p` (bell peaking at mid-gray; `p` from a "protect"
   slider). Optionally a separate highlight-rolloff so skies don't crunch.
5. `Lout = L + amount · detail · m`. Apply the per-pixel luma delta `(Lout−L)` back to R,G,B
   equally (preserves hue/sat). Dehaze = same op with a wide radius + a small black-point pull
   on the blurred base.

**Params:** `amount` (−1…+1, neg = soften), `radius` (1–200px → Texture↔Clarity↔Dehaze),
`midtoneProtect` (0–1, mask exponent), `highlightGuard` (0–1).
**Quality:** Do the add in linear (`SRGB_TO_LINEAR`→add→`linearToSrgbByte`) to avoid midtone
banding; luma-only blend prevents chroma halos; separable blur keeps it O(n·r). No seed needed.
**Effort: M · Priority: must-have.**

---

## 2. Color Balance — Lift / Gamma / Gain (3-way, ASC CDL)

**What:** Independent color + level control of shadows (Lift), midtones (Gamma), highlights
(Gain) — the colorist's three wheels. HAX has tone-curve and selectiveColor but no 3-way grade.
**Why distinctive:** This _is_ primary color grading. One effect unlocks teal-and-orange,
day-for-night, bleach looks, skin warmth — and it's the industry-portable ASC CDL math.

**Algorithm — ASC CDL SOP-S** (per channel, then global saturation):
`out = (slope · in + offset)^power`, applied in this order, then
`out = gray + sat·(out − gray)` with `gray = Rec.709 luma`. Mapping to wheels:
Slope = Gain (highlights), Offset = Lift (shadows), Power = Gamma (midtones).
Each of Lift/Gamma/Gain is a hue+amount pushed into per-channel R/G/B offsets/slopes/powers, so
the UI can expose either raw SOP triplets or friendly "shadow tint / amount" pairs.
Precompute three `makeByteLUT` curves (one per channel) → hot loop is three table reads.

**Params (12, grouped):** `shadowHue`+`shadowAmt`, `midHue`+`midAmt`, `highHue`+`highAmt`,
`liftLevel`, `gammaLevel`, `gainLevel` (luminance of each zone), `saturation` (0–2),
`balance` (shadow/highlight pivot). Ship a **Teal & Orange** preset (shadows→teal hue, highlights
→orange, with a skin-hue guard) so the popular look is one tap.
**Quality:** Power/gamma in linear or at least normalized 0–1 to keep midtone gradients smooth;
LUT-baked so no per-pixel `pow`; saturation uses true luma gray to avoid color clipping.
**Effort: M · Priority: must-have.**

---

## 3. Split Toning

**What:** Two-color tint — one hue into shadows, another into highlights, with a balance pivot.
The cinematic "warm highs / cool lows" in two sliders. Distinct from `duotone`/`gradientMap`,
which remap the _entire_ tonal range to a ramp; split-toning preserves the original color and
only biases the ends.
**Why distinctive:** Classic darkroom/Lightroom Split Toning + sepia-shadow / cyan-highlight
print looks. Tiny code, huge stylistic range, foundational for a "looks" library.

**Algorithm — luminance-weighted dual tint:** `t = L/255`. Shadow weight
`ws = (1−t)^k`, highlight weight `wh = t^k`, with a `balance` shifting the crossover. Blend
chosen `shadowColor` and `highlightColor` (HSL→RGB) over the pixel by `ws·sat`, `wh·sat`,
preserving luminance (tint chroma only, keep `L`).
**Params:** `shadowHue`, `shadowSat`, `highlightHue`, `highlightSat`, `balance` (−1…1),
`overlap` (k softness), `preserveLuma` (0/1).
**Quality:** Keep luma fixed → no exposure shift; soft power weights avoid a hard midtone seam
(banding). No seed. Pure LUT-friendly per channel.
**Effort: S · Priority: must-have.**

---

## 4. HSL Secondary Qualifier (select-a-color, shift it)

**What:** Pick a hue/sat/lum _range_ (e.g. "the reds," "the sky blue") and shift its hue,
saturation, and lightness — with a soft-edged qualifier so the selection feathers. Resolve's
HSL qualifier + Lightroom's HSL/Color panel in one. `selectiveColor` only does CMYK-style fixed
buckets; this is an arbitrary, feathered range.
**Why distinctive:** Targeted color surgery (recolor a shirt, deepen only the sky, desaturate
everything but skin) without masks. Huge perceived power for a designer.

**Algorithm — soft HSV qualifier mask + shift:** Convert pixel to HSV. Build a smooth membership
`m = smoothstep(hue window) · smoothstep(sat window) · smoothstep(val window)` (soft edges =
feather). Then `H += hueShift·m; S *= 1+satShift·m; V *= 1+lumShift·m`; back to RGB. Optional
"key view" mode renders `m` as grayscale to dial the selection.
**Params:** `centerHue`, `hueWidth`, `satRangeLo/Hi`, `feather`, then `hueShift`, `satShift`,
`lumShift`, plus `desatRest` (0–1, kill saturation outside the key — instant color-pop).
**Quality:** Smoothstep edges prevent posterized selection boundaries; do shifts in HSV but write
through clamped sRGB. No seed.
**Effort: M · Priority: must-have.**

---

## 5. Channel Mixer (+ Monochrome / B&W-filter mode)

**What:** Each output channel = weighted sum of input R/G/B (+ constant). The Photoshop Channel
Mixer. Mono mode collapses to a single weighted gray = emulating colored B&W contrast filters
(red filter → dramatic dark skies, etc.).
**Why distinctive:** Pro B&W conversion (vs HAX's flat `grayscale`) and creative channel swaps
(infrared-ish, cross-processed color) from one matrix. Nothing in HAX exposes the channel matrix.

**Algorithm — 3×3 (+offset) color matrix:** `R' = rr·R+rg·G+rb·B+ro`, etc. In mono mode use one
row applied to all three outputs. Weights typically constrained to sum ≈1 for neutral exposure
(optional auto-normalize toggle).
**Params:** mono toggle; color mode → 9 weights + 3 offsets (grouped per output channel); mono
mode → `redMix`, `greenMix`, `blueMix`, `constant`. Presets: Red filter, Orange, Infrared.
**Quality:** Apply on linear if used for exposure-accurate B&W; clamp on write. Trivially LUT-free
(it's a matrix). No seed.
**Effort: S · Priority: nice (must-have for serious B&W).**

---

## 6. Graduated ND / Sky Filter

**What:** A linear gradient mask along any angle that applies exposure + tint + contrast across
it — the "darken and warm the sky / brighten the foreground" filter from a glass grad ND.
**Why distinctive:** Landscape staple; lets a designer rescue a blown sky or add a colored sky
glow in seconds. HAX `vignette` is radial only; there's no directional graduated tool.

**Algorithm — directional gradient mask + local CDL:** For each pixel compute signed distance
along the gradient axis `d = (x·cosθ + y·sinθ − offset)/length`, clamp+smoothstep to mask `m`.
Apply within the masked region: exposure in stops (reuse `makeExposureLUT`), a tint, and a small
contrast/saturation push, blended by `m`. Support a second inverse grad for "two-stop reverse ND"
(brightest at horizon).
**Params:** `angle`, `position`, `softness` (transition width), `exposure` (stops),
`tintHue`+`tintAmt`, `contrast`, `invert`. Bonus: `shape` (linear / radial / reverse).
**Quality:** Exposure via the linear-light LUT (no clipping artifacts); smoothstep transition
avoids a visible mach band; works channel-uniform so no chroma shift unless tint requested.
**Effort: S–M · Priority: must-have.**

_Cheap upgrade ride-along:_ an **Exposure Vignette** (vignette computed as ± stops in linear,
with shape = ellipse/rounded-rect + optional warm/cool tint) is the same machinery and fixes the
fact that the current `vignette` only multiplies bytes (crushes shadows). Worth folding in.

---

## 7. Surface Blur / Edge-Aware Smooth (bilateral) — skin & sky

**What:** Smooths flat regions (skin, sky, walls) while keeping edges crisp. The "denoise /
soften skin without mush" tool. Distinct from every blur in HAX, which are all edge-blind.
**Why distinctive:** Enables retouching and clean-up that Gaussian blur can't; also the base for a
true _frequency-separation_ workflow (smooth the low band, keep the high band — see note).

**Algorithm — bilateral filter (range + spatial weights):** For each pixel, average neighbors
weighted by `spatialGauss(distance) · rangeGauss(|Icenter − Ineighbor|)`. Edges (big range
delta) get near-zero weight → preserved. For speed on CPU use a **separable bilateral
approximation** or a small radius (3–7px) with an early-out, and run on a downscaled buffer for
the live preview pass HAX already does.
**Params:** `radius` (spatial), `threshold` (range/edge sensitivity), `amount` (blend back),
`mode` (luma-only / full-color). **Frequency-separation toggle:** output `high = orig − smoothed`
boosted separately → smooth tone, keep pores.
**Quality:** Range term in luma to avoid color smearing; blend in linear for clean gradients;
deterministic (no seed). Heavy — gate behind the existing progressive/worker path.
**Effort: M · Priority: must-have.**

---

## 8. Bleach Bypass (silver retention)

**What:** The desaturated, high-contrast, metallic-shadow film look (_Saving Private Ryan_,
_Se7en_). One of the most recognizable cinematic grades and absent from HAX.
**Why distinctive:** A specific, beloved look that's trivial to do _right_ and hard to fake with
generic contrast/saturation. `unifiedVintage` has "cross process" but not bleach bypass.

**Algorithm — luma overlay composite:** Compute `gray = luma`. Output =
`Overlay(desaturate(image, s), grayLayer)` where the grayscale silver layer is blended back over
a partially-desaturated base, then add contrast. `Overlay(a,b) = a<0.5 ? 2ab : 1−2(1−a)(1−b)`.
This is exactly the silver-retention contrast/desaturation signature.
**Params:** `strength` (overlay opacity), `desaturation` (0–1), `contrast`, `warmth` (slight tint).
**Quality:** Overlay math in linear for filmic rolloff; preserve highlight detail with a soft
clip. No seed.
**Effort: S · Priority: nice.**

---

# OPTICAL / LENS

## 9. Pro-Mist / Black Mist Diffusion

**What:** The cinematic glass-diffusion-filter look: highlights bloom into soft halos, micro-
contrast drops, optional lifted "milky" blacks (Pro-Mist) vs preserved rich blacks (Black Mist).
**Why distinctive:** This is the most-bought lens filter of the last decade (Tiffen Black Pro-Mist).
HAX has `bloom`/`orton`/`halation`, but none with the _black-level control_ and grade-correct
linear scatter that separates "Pro-Mist" (washed blacks) from "Black Mist" (retained blacks) —
the exact distinction colorists care about (per ProMist-5K research framing).

**Algorithm — threshold bloom in linear + black-mix control:**

1. In linear light, extract highlights above `threshold` → `H`.
2. Multi-radius Gaussian of `H` (two or three `separableGaussianBlur` passes summed) = the halo,
   so the falloff looks optical not box-y.
3. Screen/add the halo back: `out = 1−(1−base)(1−glow·intensity)`.
4. **Black mix:** Pro-Mist adds a small uniform `bias` to shadows (milky lift); Black Mist skips
   it (`blackRetention` slider scales the lift toward 0). Slight warm tint optional.
   **Params:** `intensity`, `threshold`, `radius` (halo size), `blackRetention` (0=Pro-Mist milky →
   1=Black-Mist clean), `warmth`, `microContrast` (small clarity reduction).
   **Quality:** **Must** be linear (bloom is energy spreading — `SRGB_TO_LINEAR`/`linearToSrgbByte`),
   else halos go gray and dirty. Multi-radius sum kills banding. No seed.
   **Effort: M · Priority: must-have.**

---

## 10. Light Wrap (depth-free, self)

**What:** Bright background/sky areas "wrap" their light around adjacent darker subject edges —
the compositing trick that makes a subject feel lit by its environment.
**Why distinctive:** Normally needs an alpha matte; here a _self_ version uses luminance + edge
proximity as a cheap heuristic, giving an atmospheric edge-glow integration nothing in HAX does.

**Algorithm — blurred-bright-region screened along high-gradient edges:**

1. Extract bright regions `B` (luma > threshold), blur heavily (`stackBlur`).
2. Build an edge/transition mask `E` from the luminance gradient (Sobel magnitude) — wrap only
   lands where light meets dark, like a real key edge.
3. `out = base + B_blur · E · amount` (screen). Optionally pull the wrap color toward the local
   bright hue so it reads as colored spill.
   **Params:** `amount`, `threshold` (what counts as "light"), `spread` (blur radius), `edgeWidth`,
   `colorize` (0–1, neutral→hue-matched spill).
   **Quality:** Screen in linear; gradient mask feathered to avoid outline artifacts; deterministic.
   A genuine "integration/atmosphere" effect rather than a sticker.
   **Effort: M · Priority: nice.**

---

## 11. Anamorphic Bokeh + Blue Streak Flare

**What:** Defocus with **oval, horizontally-stretched (and cat-eye toward edges)** bokeh, plus the
signature horizontal blue lens streak across highlights. The "cinematic anamorphic" look.
**Why distinctive:** HAX `bokeh` is circular and isotropic. Anamorphic ovalisation + the blue
horizontal flare is the instantly-readable movie-lens signature, and the streak alone is a great
quick effect.

**Algorithm:** (a) **Oval bokeh:** disc/poly bokeh blur (sample a kernel) scaled ~2:1 horizontally;
toward frame edges, clip the kernel against a circle offset by radial position → cat-eye
(mechanical vignetting). Reuse the existing bokeh sampler with an anisotropic kernel + radial
clip. (b) **Streak flare:** threshold highlights, smear them horizontally with a long 1-D blur,
tint blue, screen back.
**Params:** `blur` (defocus radius), `ovality` (1–3), `catEye` (edge distortion), `streakAmount`,
`streakLength`, `streakHue` (default blue), `highlightThreshold`.
**Quality:** Bokeh + streak in linear so highlights "ball up" correctly; the 1-D streak is cheap
(separable). No seed. The defocus is the heavy part — gate it.
**Effort: L · Priority: nice.**

---

## 12. Lens Distortion + Vignetting Model (Brown–Conrady)

**What:** A real radial-distortion model — apply _or correct_ barrel/pincushion, plus a physically
shaped corner light falloff and optional lateral chromatic aberration. A proper lens _profile_,
both directions.
**Why distinctive:** HAX `fisheye` is a one-way artistic warp. This is the controllable
two-direction lens model (add a vintage bulge, or _de-fish_ a GoPro-ish source) photographers and
designers actually need — with the natural `cos⁴` vignette baked in.

**Algorithm — Brown–Conrady radial polynomial:** normalize coords to center, `r` = radius;
`r_distorted = r·(1 + k1·r² + k2·r⁴)`; resample source at the distorted position with bilinear
(HAX already has a bilinear sampler in `chromaticAberration`). Negative k = pincushion/correct,
positive = barrel. Vignette = `cos⁴(angle)` or `(1 − k·r²)` exposure falloff in linear. Lateral CA
= apply slightly different `k` per channel.
**Params:** `k1`, `k2` (distortion), `scale` (fit after warp), `vignette` (corner falloff),
`chromatic` (per-channel k spread), `direction` (apply/correct).
**Quality:** Bilinear (or bicubic) resample to avoid stair-steps; vignette in linear; edge-fill
mode (mirror/clamp). Deterministic.
**Effort: M · Priority: nice.**

---

## 13. Prism / Spectral Dispersion

**What:** Wavelength-dependent radial displacement that smears highlights into a _spectral_ rainbow
fringe (red→violet), like light through a prism — richer than a two-channel RGB shift.
**Why distinctive:** HAX `chromaticAberration`/`rgbShift` only offset R and B. True dispersion
multi-samples across the spectrum with monotonically increasing displacement, giving continuous
rainbow edges and prismatic highlight smears — a distinct, gorgeous effect.

**Algorithm — multi-tap spectral smear:** Sample N steps (e.g. 8–16) along a displacement vector
whose magnitude grows with `r` (radial) or is fixed (directional). Map each tap to a spectral
weight (a small fixed wavelength→RGB response table) and accumulate; normalize. Threshold to
highlights for a "prismatic glow," or apply full-frame for chromatic dispersion.
**Params:** `amount`, `samples` (quality), `mode` (radial/directional), `angle`, `spread`
(spectrum width), `highlightOnly` (threshold), `intensity`.
**Quality:** Accumulate in linear; the spectral table keeps colors plausible (not garish);
more samples = smoother (cost knob). Deterministic.
**Effort: M · Priority: nice.**

---

# SIGNAL / RETRO

## 14. NTSC Composite Signal Simulation (true YIQ)

**What:** Actually encodes the image as a composite NTSC signal and decodes it — producing genuine
dot-crawl, chroma/luma crosstalk, rainbow fringing on fine detail, and chroma bleed. Not an
overlay.
**Why distinctive:** HAX's VHS/glitch are stylistic overlays. This is the _signal-accurate_
artifact (per ntsc-rs / nesdev approach): it reacts to image content (sharp edges shimmer, reds
bleed) the way real analog gear does. Unmistakable and not replicable by stickers.

**Algorithm — RGB→YIQ → bandlimit → modulate/demodulate:**

1. RGB→YIQ (standard 3×3).
2. Low-pass each plane at NTSC ratios (Y ≈ 4.2 / I ≈ 1.5 / Q ≈ 0.5 MHz → as fractions of pixel
   width: I/Q get aggressive horizontal box/IIR blur, Y mild) — this is where chroma resolution
   dies and bleed appears.
3. Optionally modulate chroma onto a subcarrier per scanline and demodulate with a 1-line delay
   (or skip full modulation and emulate crosstalk by leaking high-freq Y into I/Q) → dot crawl &
   rainbow on edges.
4. YIQ→RGB; add a touch of ringing and noise (`mulberry32`).
   **Params:** `chromaBleed` (I/Q bandwidth), `dotCrawl`, `ringing`, `noise`, `lumaSharpness`,
   `tint`/`hueError` (the classic NTSC = "Never The Same Color" knob).
   **Quality:** Seeded noise for repeatable preview/export; horizontal-only filters = cheap and
   correct (NTSC is a 1-D scan); keep in 0–1 float internally.
   **Effort: L · Priority: nice (high distinctiveness).**

---

## 15. CRT Display Simulation

**What:** Renders the image as if shown on a CRT: RGB phosphor triads / aperture-grille stripes,
scanline beam profile, barrel curvature, corner vignette, and phosphor bloom.
**Why distinctive:** HAX `scanLines` is a 1-D darkening. A full CRT (à la CRT-Royale) composites
the subpixel mask + beam shape + glass curve + glow — the complete retro-monitor object, ideal for
game/retro art and a strong showcase effect.

**Algorithm — mask × beam × geometry × glow:**

1. **Geometry:** barrel-warp sample coords (reuse the Brown–Conrady sampler from #12).
2. **Aperture grille / shadow mask:** multiply by a per-subpixel RGB stripe/triad pattern keyed to
   x (and y for triads).
3. **Scanline beam:** vertical Gaussian beam profile per scanline (brightness peaks at line
   center), scaled by source luma so bright lines bloom wider.
4. **Glow:** add a blurred bright-pass (linear) for phosphor bloom; corner vignette.
   **Params:** `maskType` (aperture grille / slot / shadow mask — int slider), `maskStrength`,
   `scanlineDepth`, `curvature`, `bloom`, `brightness` (compensate for mask darkening), `pixelGrid`
   (emulated native res).
   **Quality:** Brighten to offset the ~40% the mask eats; bloom in linear; geometry bilinear.
   Deterministic.
   **Effort: L · Priority: nice.**

---

# COLOR / PERCEPTUAL

## 16. Palette Extraction + Recolor (OKLab)

**What:** Extracts the image's dominant N-color palette, then remaps every pixel to its nearest
palette color (perceptually, in OKLab) — auto duotone/tritone/poster recolor that's _derived from
the photo_, plus an editable palette for hard recolors.
**Why distinctive:** HAX `colorQuantization` quantizes in RGB (muddy); doing nearest-color in
OKLab gives perceptually faithful posterization and "designed palette" looks. Extraction means the
result feels intentional, not random. Great for moodboards/brand recolors.

**Algorithm — median-cut/k-means extract → OKLab nearest:**

1. Downsample, build a color histogram, run **median cut** (or a few k-means iterations) for K
   centroids.
2. Convert centroids + each pixel to **OKLab** (linear RGB → LMS via the published 3×3 → cube root
   → second 3×3) and assign nearest centroid by ΔE.
3. Output the centroid color (hard) or blend toward it by `strength` (soft posterize). Optional
   ordered dither between the two nearest centroids to kill banding.
   **Params:** `colors` (K, 2–16), `strength` (recolor amount), `dither` (0–1), `smoothing`
   (soft vs hard buckets), and a "palette source" toggle (auto vs a few preset palettes).
   **Quality:** OKLab nearest avoids the hue-shift CIELAB has; dithering removes posterization bands;
   deterministic. K-means seeded by `mulberry32`.
   **Effort: M · Priority: nice.**

---

## 17. Infrared / Aerochrome False-Color

**What:** Simulates color-infrared film: foliage glows white/magenta, skies go deep, skin turns
waxy — the surreal Kodak Aerochrome look.
**Why distinctive:** Striking, recognizable, and not derivable from existing tools. The heuristic
(green vegetation as an IR proxy) is cheap and content-aware without ML. (HAX has `thermalPalette`
/`heatmap` but no photographic IR.)

**Algorithm — channel swap + vegetation glow heuristic:** A near-IR proxy `nir ≈ 0.6·G + 0.3·R`
(healthy foliage is bright in IR ≈ bright green). Aerochrome maps IR→red: output
`R' = nir`, `G' = R`, `B' = G` (rotate channels). Boost saturation where `vegMask = (G−R)` is
high → vivid magenta/red foliage. Deepen blue skies (darken high-blue lows). Add slight halation
(reuse #9 machinery) for the dreamy IR bloom.
**Params:** `vegetationGlow`, `channelMix` (IR proxy weighting), `skyDarken`, `saturation`,
`halation`, `tint`.
**Quality:** Work in linear for the channel mix; vegetation mask soft-thresholded; optional seeded
grain. Deterministic.
**Effort: M · Priority: niche.**

---

# GENERATIVE / CONTENT-AWARE

## 18. Anisotropic Kuwahara (oriented painterly)

**What:** A painterly oil/watercolor abstraction that _flows along image structure_ — brushstrokes
follow edges and contours instead of square blocks.
**Why distinctive:** HAX `oilPainting` is the basic (square) Kuwahara → blocky. The anisotropic
variant (Kyprianidis–Kang–Döllner 2009) orients/scales each region by the local structure tensor,
producing genuine directional brushwork and clean edges — a clear quality tier above.

**Algorithm — structure-tensor-oriented Kuwahara:**

1. Compute the **structure tensor** (Sobel `gx,gy` → `[gx², gxgy; gxgy, gy²]`), smooth it; its
   eigenvectors give local orientation + anisotropy.
2. Split a (rotated, elongated) neighborhood into sectors; for each, compute mean + variance.
3. Output a variance-weighted blend of sector means (low-variance sectors dominate → flat regions
   smooth, edges stay sharp), with the neighborhood **oriented and stretched** along the tensor.
   **Params:** `radius`, `sectors` (4–8), `sharpness` (variance weighting `q`), `anisotropy`
   (stretch amount), `passes`.
   **Quality:** Tensor smoothing controls coherence; weighting exponent avoids hard sector seams;
   deterministic. Heavy — run on the worker/preview-downscale path.
   **Effort: M · Priority: nice.**

---

## 19. Dust & Scratches (seeded analog damage)

**What:** Procedural film-damage layer: vertical scratches, dust specks, hair, and gate-weave —
fully controllable and reproducible.
**Why distinctive:** `unifiedVintage` has a fixed "Scratched" preset; this is a granular,
seeded, dial-everything damage generator (set the seed → identical in preview and export, or
re-roll for a new frame), the right primitive for a believable old-film finish.
**Algorithm — `mulberry32`-seeded sparse marks:** From the seed, place K vertical scratches
(bright/dark 1-px lines with jitter and partial length), M dust blobs (small dark/light disks),
occasional hair (random short bezier-ish polylines), composited via screen (light damage) and
multiply (dark). Optional per-"frame" reseed for animation.
**Params:** `scratchDensity`, `dustDensity`, `hairAmount`, `age` (overall), `seed`, `darkVsLight`,
`size`.
**Quality:** Fully deterministic via seed (matches HAX's preview==export contract); composite in
linear; sub-pixel jitter avoids aliased lines.
**Effort: S–M · Priority: niche.**

---

# Quick-win bundle (cheapest high-value)

Split Toning (#3), Bleach Bypass (#8), Channel Mixer (#5), and the Exposure-Vignette ride-along
on #6 are each **S** effort, pure per-pixel/LUT math, no new infrastructure — a strong first PR
that immediately broadens the "looks" range. Clarity (#1), Color Balance (#2), and Pro-Mist (#9)
are the three **M** must-haves that make HAX feel pro.

# Notes on what I deliberately did NOT propose (already covered)

Generic film stocks (upgraded separately), `thermalPalette`/`heatmap` (thermal exists),
`topographicContours`, `holographicInterference`/`iridescentSheen` (foil/holo present),
`advancedDithering` retro palettes (Game-Boy/PICO-8 palette mapping largely overlaps — fold a
"hardware palette" preset into it rather than a new effect), and the existing radial
`vignette`/`bokeh`/`scanLines` (proposals #6/#11/#15 are the upgraded supersets).
