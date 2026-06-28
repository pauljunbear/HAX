# R5 — Black-and-White Film Emulation: Documented Stock Characteristics

Research for accurate B&W film-emulation effects in the imager2 / HAX web image editor.
Date: 2026-06-28. Engine target: 8-bit sRGB bytes, cheap LINEAR via `SRGB_TO_LINEAR` LUT, per-channel tone curves, seeded luminance grain.

**Confidence tags used throughout:**

- **[M] MEASURED** — taken directly from a manufacturer datasheet (Kodak / Ilford / Fujifilm).
- **[E] ESTIMATED** — derived/interpreted from documented spectral-sensitivity curve _shapes_, characteristic-curve _shapes_, or community channel-mixer practice. Not a fabricated datasheet number.
- The datasheets publish spectral-sensitivity and D-logE curves **as plots (images)**, not as numeric tables. Exact RGB weights and exact tone-curve control points therefore cannot be read off as numbers — they are **[E]**, anchored to the documented curve shapes and to the manufacturer's own written notes where they exist.

---

## 0. The big picture (why luma ≠ film)

A panchromatic B&W film converts a colored scene to gray through its **spectral sensitivity curve** — how silver-halide responds to each wavelength. This is **not** Rec.709 luma (0.2126R / 0.7152G / 0.0722B). Two documented departures matter:

1. **Film is far more blue-sensitive than the human eye.** Silver halide is intrinsically blue/UV sensitive; sensitizing dyes add green and red. Classic films keep a strong blue response, so **unfiltered blue skies render pale/white** and **caucasian skin (red/orange) renders relatively light**. Rec.709's 0.07 blue weight would render skies far too dark vs. real film. Real-film blue weight is more like **0.30–0.40**.
2. **Each stock weights R/G/B differently.** Classic cubic films (Tri-X, HP5, FP4) are red-extended and blue-heavy. Modern tabular films (T-Max, Delta, Acros) were deliberately tuned flatter / closer to the eye. Kodak states this explicitly for T-Max (quoted below).

**Documented anchor (Kodak T-Max 400, F-4043, verbatim):**

> "The blue sensitivity of KODAK PROFESSIONAL T-MAX Films is slightly less than that of other Kodak panchromatic black-and-white films. This enables the response of this film to be closer to the response of the human eye. Therefore, blues may be recorded as slightly darker tones with this film — a more natural rendition." **[M]**

This is the only manufacturer that quantifies-in-words the channel difference; everyone else publishes only the curve plot.

---

## 1. Channel-mixing — per-stock RGB→gray weights

### 1a. The community channel-mixer table (the de-facto reference)

The most widely used B&W-film channel-mixer numbers (DaVinci / Photoshop monochrome-mixer presets). Origin: prime-junta blog → Markus Hartel → reposted on Lowepost. **Unmeasured, eye-tuned, but internally consistent** and the practical baseline the whole color-grading world uses. **[E]** All rows sum to ~1.0.

| Film                      | R    | G    | B    |
| ------------------------- | ---- | ---- | ---- |
| Kodak Tri-X 400           | 0.25 | 0.35 | 0.40 |
| Kodak T-Max 100           | 0.24 | 0.37 | 0.39 |
| Kodak T-Max 400           | 0.27 | 0.36 | 0.37 |
| Ilford HP5                | 0.23 | 0.37 | 0.40 |
| Ilford FP4                | 0.28 | 0.41 | 0.31 |
| Ilford Delta 100          | 0.21 | 0.42 | 0.37 |
| Ilford Delta 400          | 0.22 | 0.42 | 0.36 |
| Ilford Delta 3200         | 0.31 | 0.36 | 0.33 |
| Ilford Pan F              | 0.33 | 0.36 | 0.31 |
| Ilford SFX (extended red) | 0.36 | 0.31 | 0.33 |
| (Generic desaturate)      | 0.24 | 0.68 | 0.08 |

Note the _character_ this encodes: Tri-X / HP5 are blue-heavy (pale skies); FP4 is more red+green / less blue (darker skies); Delta 3200 is the flattest/most-even (highest red of the modern set); SFX is red-extended (near-IR look).

### 1b. Recommended weights for the engine (datasheet-reconciled)

Single recommended set per stock. Where I deviate from the community table it is to honor a **documented** spectral fact; deviations noted. **All exact splits are [E]; the relative character is documented/derived.** Apply **in linear light** (see §4), renormalize so ΣW = 1.

| Stock          | R    | G    | B    | Basis                                                                                                                                                                              |
| -------------- | ---- | ---- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tri-X 400**  | 0.25 | 0.35 | 0.40 | Community table. Red-extended + blue-heavy → classic pale skies, light glowy skin. **[E]**                                                                                         |
| **HP5+ 400**   | 0.23 | 0.37 | 0.40 | Community table. Near-Tri-X; very slightly less red. Classic forgiving pan. **[E]**                                                                                                |
| **FP4 125**    | 0.28 | 0.41 | 0.31 | Community table. Less blue → skies a touch darker / more "drawn" than HP5. **[E]**                                                                                                 |
| **T-Max 100**  | 0.25 | 0.40 | 0.35 | Community 0.24/0.37/0.39, **nudged −blue / +green** per Kodak's documented "reduced blue, eye-like" note. **[E]**                                                                  |
| **T-Max 400**  | 0.27 | 0.41 | 0.32 | Community 0.27/0.36/0.37, **nudged −blue / +green** per same Kodak note. Darker, more natural skies. **[E]**                                                                       |
| **Delta 3200** | 0.31 | 0.36 | 0.33 | Community table. Flattest / most-even response of the set (highest red). **[E]**                                                                                                   |
| **Acros 100**  | 0.25 | 0.40 | 0.35 | **Not in community table.** Estimated from datasheet: even/neutral pan with an earlier red cutoff (~650 nm) and famously natural skin → slightly green-weighted, eye-like. **[E]** |

**Conflict-resolution note:** the community table gives T-Max a _high_ blue weight (0.37–0.39), which contradicts Kodak's own written statement that T-Max blue is _reduced_ for eye-like rendition. I trust the manufacturer's prose over the eye-tuned table, so the recommended T-Max rows pull blue down and green up. Expose this as an optional toggle if you want to match the legacy presets exactly.

---

## 2. Contrast filters — the user control

Classic glass contrast filters work by attenuation: **"like colours are lightened, complementary colours are darkened."** Documented effects (35mmc, and the Wratten filter factors in every datasheet):

- **Yellow (#8 / #12 / #15):** mild. Darkens blue sky a little → separates white clouds. The portrait/landscape default. ("a more flattering rendition")
- **Orange (#21):** stronger sky darkening, cuts haze, boosts contrast.
- **Red (#25 / #29):** dramatic near-black skies, maximal haze penetration, hard contrast. Darkens foliage & blue eyes; lightens skin/lips/brick.
- **Green (#58 / #11 yellow-green):** lightens & separates **foliage**; on portraits **darkens skin and lips, emphasizes freckles** (often unflattering). Good for landscapes with greenery.
- **Blue (#47):** accentuates haze/mist, **lightens** the sky, lightens blue eyes, darkens blonde/red hair. Graphic / atmospheric look.

### 2a. Implementable spec — multiplicative weight presets

Model each filter as a **per-channel multiplier on the stock's base RGB weights, then renormalize to ΣW=1** (renormalizing preserves overall midtone exposure — only the _balance_ shifts). This is cheap and composes with any stock. Multipliers are **[E]**, anchored to the documented Wratten daylight filter factors (e.g. Kodak Tri-X #25 red = ×8 ≈ 3 stops of blue attenuation; #8 yellow = ×2; #58 green = ×6 — all **[M]** from F-4017).

| Filter control          | ×R   | ×G   | ×B   | Documented effect                 |
| ----------------------- | ---- | ---- | ---- | --------------------------------- |
| **None (panchromatic)** | 1.00 | 1.00 | 1.00 | Stock's native rendering          |
| **Yellow (#8)**         | 1.25 | 1.10 | 0.55 | Mild sky/cloud separation         |
| **Yellow-Green (#11)**  | 0.95 | 1.40 | 0.55 | Sky down + foliage/skin balance   |
| **Orange (#21)**        | 1.60 | 1.00 | 0.25 | Strong sky darken, haze cut       |
| **Red (#25)**           | 2.40 | 0.55 | 0.08 | Dramatic black sky, hard contrast |
| **Green (#58)**         | 0.55 | 1.70 | 0.55 | Foliage up; skin/lips down        |
| **Blue (#47)**          | 0.40 | 0.70 | 2.10 | Haze/atmosphere, light sky        |

Pseudo: `w' = normalize([wR*mR, wG*mG, wB*mB])`. Optionally expose a 0–100% **strength** slider that lerps each multiplier toward 1.0 (`m_eff = 1 + strength*(m−1)`) so users get "light red" → "deep red" continuously — matching the documented "filters come in different intensities."

**Cross-check (35mmc digital example):** a yellow filter ≈ channel-mixer Red +58 / Green +32 / Blue 0 (relative) — i.e. red+green up, blue flat/down. Consistent with the table above. **[M]/[E]**

---

## 3. Characteristic curve & grain — per stock

RMS granularity is **diffuse rms × 1000**, read at net density 1.0, 48 µm aperture, 12× (Kodak/Fuji method). Lower = finer. Grain "structure": **cubic** (classic, clumpy, organic grit) vs **tabular / T-grain / Σ-grain** (flat crystals, tighter, smoother, sharper edges).

| Stock          | True/box ISO                          | RMS granularity                                                              | Grain structure          | Characteristic-curve character                                                                                                                                 |
| -------------- | ------------------------------------- | ---------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tri-X 400**  | 400                                   | **17** "fine" **[M]** (F-4017, HC-110 B)                                     | Cubic                    | Medium contrast, **decent toe**, long **gentle shoulder** → famously forgiving highlights; punchy mids. The gritty news/street benchmark.                      |
| **HP5+ 400**   | 400                                   | not published; ≈ **17–18 [E]** (analog.cafe: "slightly grittier than Tri-X") | Cubic                    | **Lower contrast than Tri-X**, long gentle toe → very forgiving / wide latitude; flat, easily-printed mids.                                                    |
| **FP4 125**    | 125                                   | not published; "exceptionally fine grain" **[M-text]**; ≈ **10–12 [E]**      | Cubic (fine)             | Medium-to-higher contrast, **long beautiful tonal scale**, fuller blacks than HP5. Classic medium-speed look.                                                  |
| **T-Max 100**  | 100                                   | **8 [M]** (F-4016, D-76); RP 63/200 lp·mm⁻¹                                  | Tabular T-grain          | **High acutance, long straight line, minimal shoulder** → crisp, can clip highlights if over-developed. Clean & modern.                                        |
| **T-Max 400**  | 400                                   | **10 [M]** (F-4043, D-76); RP 50/200 lp·mm⁻¹                                 | Tabular T-grain          | Like T-Max 100, a hair softer. Straight, sharp, fine. Documented reduced-blue → more natural skies.                                                            |
| **Acros 100**  | 100                                   | **7 [M]** (Fuji AF3-0258E, Microfine); RP 60/200 lp·mm⁻¹                     | Σ tabular (Super Fine-Σ) | **Finest grain here.** Smooth, rich gradation, excellent highlight retention, gentle shoulder; very neutral. Excellent reciprocity.                            |
| **Delta 3200** | **true ISO 1000/31 [M]**, box EI 3200 | not published; coarse                                                        | Core-shell tabular       | **Heavy, dominant grain**; soft/low inherent contrast at box but contrasty when pushed; **veiled, lifted shadows** (base fog + push). The "heavy grain" stock. |

**Tri-X vs T-Max contrast difference (the headline comparison):** Tri-X = classic cubic, _moderate_ contrast with a **rolled, gentle shoulder** that protects highlights and grain that reads as grit (RMS 17). T-Max = tabular, _higher acutance_, a **long straight line with little shoulder** (sharper, cleaner, but less highlight forgiveness) and ~½ the grain (RMS 8–10). So Tri-X = forgiving + textured; T-Max = sharp + clean + clinical.

---

## 4. Implementable recipe for the engine

### 4.1 Per-pixel pipeline (cheap, deterministic)

```
1. sRGB byte (R,G,B)  --SRGB_TO_LINEAR LUT-->  (Rl,Gl,Bl)     // 0..1 linear
2. apply contrast-filter multipliers to the stock weights, renormalize ΣW=1
3. gray_lin = wR*Rl + wG*Gl + wB*Bl                            // linear gray
4. gray_disp = LINEAR_TO_SRGB(gray_lin)                        // back to display 0..1
5. out = toneCurve(gray_disp)                                  // monotone-cubic thru control pts
6. out = out + grain(seed, x, y, out)                          // luminance-weighted noise
7. byte = clamp(round(out * 255), 0, 255)
```

**Space declarations (per spec):**

- **Channel mix → step 3 in LINEAR light** (physically correct: film sees light energy; gives the right interplay between channel weights and highlight rolloff).
- **Tone curve → control points are in DISPLAY / sRGB-gamma 0–1 space** (input `gray_disp`, output `out`). This is how D-logE "look" curves are conventionally authored and is the cheapest to evaluate. The toe/shoulder/contrast all live here.
- If you want a more physical highlight shoulder, alternatively apply the shoulder portion in linear before step 4 — optional, not required.

Evaluate the curve with a **monotone cubic** (Fritsch–Carlson) or Catmull-Rom through the control points, **prebaked into a 256-entry LUT per stock+filter** so step 5 is a single lookup.

### 4.2 Tone-curve control points (display-space, 0–1)

`(input, output)`, monotonic. **[E]** — shapes consistent with each datasheet's D-logE plot; exact points stylized for an 8-bit display LUT. Treat midtone slope as the "contrast grade."

```js
const TONE = {
  triX400: [
    [0, 0],
    [0.1, 0.055],
    [0.25, 0.2],
    [0.5, 0.52],
    [0.75, 0.8],
    [0.9, 0.93],
    [1, 1],
  ], // mild S, soft long shoulder
  hp5_400: [
    [0, 0.02],
    [0.12, 0.1],
    [0.3, 0.28],
    [0.5, 0.49],
    [0.72, 0.71],
    [0.9, 0.9],
    [1, 0.99],
  ], // low-contrast, lifted toe, forgiving
  fp4_125: [
    [0, 0],
    [0.12, 0.07],
    [0.28, 0.22],
    [0.5, 0.52],
    [0.74, 0.8],
    [0.92, 0.95],
    [1, 1],
  ], // medium-high, full blacks, long scale
  tmax100: [
    [0, 0],
    [0.1, 0.06],
    [0.3, 0.27],
    [0.5, 0.51],
    [0.7, 0.75],
    [0.88, 0.92],
    [1, 1],
  ], // straight line, little shoulder, crisp
  tmax400: [
    [0, 0],
    [0.1, 0.06],
    [0.3, 0.26],
    [0.5, 0.5],
    [0.7, 0.74],
    [0.9, 0.93],
    [1, 1],
  ], // straight, a hair softer than 100
  acros100: [
    [0, 0],
    [0.12, 0.06],
    [0.28, 0.22],
    [0.5, 0.52],
    [0.74, 0.81],
    [0.92, 0.96],
    [1, 1],
  ], // clean, deep blacks, graceful highlight shoulder
  delta3200: [
    [0, 0.05],
    [0.15, 0.15],
    [0.35, 0.33],
    [0.55, 0.53],
    [0.78, 0.74],
    [0.92, 0.9],
    [1, 0.98],
  ], // veiled/lifted shadows, soft, compressed highs
};
```

Optionally expose a global **Contrast** slider that pivots the curve around 0.5 (`out = 0.5 + (out-0.5)*k`) so the user can push grade up/down — mirrors the datasheets' development-time → contrast-index relationship.

### 4.3 Grain parameters

Model grain as **seeded value noise, low-pass filtered to a cell size, multiplied by a luminance envelope** (film grain peaks in the midtones, ~density 0.3–1.0; fades in deep blacks and bright highlights). Apply to the luminance channel only.

`amount` = std-dev of the noise in 8-bit code values at mid-gray. `size` = grain-cell scale (1.0 = baseline fine T-grain; render as blur radius / noise frequency at your reference scan resolution). **amount is anchored to MEASURED RMS where it exists; the amount↔RMS mapping and all sizes are [E] engine knobs — tune to your output resolution.**

| Stock      | amount (σ, code-values) | size (rel.) | Notes                                                     |
| ---------- | ----------------------- | ----------- | --------------------------------------------------------- |
| Acros 100  | 5                       | 1.0         | RMS 7 [M] — barely-there, tightest                        |
| T-Max 100  | 6                       | 1.0         | RMS 8 [M] — very fine T-grain                             |
| T-Max 400  | 7                       | 1.1         | RMS 10 [M] — fine T-grain                                 |
| FP4 125    | 8                       | 1.3         | RMS ~10–12 [E] — fine, slightly clumpier (cubic)          |
| Tri-X 400  | 12                      | 1.7         | RMS 17 [M] — signature clumpy grit, biggest classic clump |
| HP5+ 400   | 13                      | 1.6         | RMS ~18 [E] — a touch grittier than Tri-X                 |
| Delta 3200 | 26                      | 2.6         | coarse [E] — dominant, large, the heavy-grain look        |

Envelope suggestion: `env(L) = 1 - (2*L - 1)^2` (parabola, max at mid-gray, → 0 at 0 and 1), then `out += amount/255 * env(out) * noise`. Use a per-render `seed` so grain is stable across redraws but re-rollable.

---

## 5. Freely-licensed LUTs / curves

- **G'MIC** (gmic.eu) — open source under **CeCILL** (GPL-compatible). Ships **1100+ film-simulation CLUTs** including "Simulate Film → Black & White" presets, applicable as 3D CLUTs. Best freely-licensed turnkey option; license permits reuse with attribution/copyleft. **[M-license]**
- **Community channel-mixer table** (§1a) — freely circulated (prime-junta / Markus Hartel / Lowepost), but **no formal license and uncertain provenance** (eye-tuned, not measured). Safe to use as guidance/numbers; don't represent as manufacturer data.
- **Caveat:** there is **no manufacturer-authoritative free Tri-X/HP5/T-Max `.cube` LUT.** Most "Tri-X LUT" downloads are interpretive third-party products (often paid: DxO FilmPack, Dehancer, Nik Silver Efex). For an accurate emulation, the §4 recipe (datasheet curves + measured RMS + channel weights) is more defensible than any random downloaded LUT.

---

## 6. Sources (primary first)

**Manufacturer datasheets [M]:**

- Kodak Tri-X 320/400, F-4017 — https://www.freestylephoto.com/static/pdf/product_pdfs/kodak/Kodak_Tri-X.pdf (RMS 17; Wratten filter factors; spectral & characteristic curves)
- Kodak T-Max 100, F-4016 — https://business.kodakmoments.com/sites/default/files/files/resources/f4016_TMax_100.pdf (RMS 8; RP 63/200; filter factors)
- Kodak T-Max 400, F-4043 — https://business.kodakmoments.com/sites/default/files/files/products/f4043_tmax_400.pdf (RMS 10; RP 50/200; **documented reduced-blue note**)
- Kodak T-Max (legacy combined, F-32) — https://125px.com/docs/film/kodak/f32-TMAX.pdf
- Ilford HP5 Plus — https://www.digitaltruth.com/products/ilford_tech/hp5.pdf (spectral wedge, characteristic curve, filter guidance)
- Ilford FP4 Plus — https://www.digitaltruth.com/products/ilford_tech/fp4.pdf ("exceptionally fine grain")
- Ilford Delta 3200 — https://125px.com/docs/film/ilford/Delta_3200-200209.pdf (true ISO 1000/31; characteristic curves)
- Fujifilm Neopan 100 Acros II — https://asset.fujifilm.com/www/ca/files/2020-07/fb477bd9803b3c27ab592edcf9f3567c/AF3-0258E_PIB-NEOPAN-100-ACROSII-135-3_data-sheet.pdf (RMS 7; RP 60/200; Super Fine-Σ)
- Fujifilm Neopan 100 Acros (original) — https://asset.fujifilm.com/www/us/files/2020-04/299395cd078366c7a2956af612ca9fdb/NeopanAcros100.pdf

**Reference / interpretive [E]:**

- Channel-mixer film table — https://lowepost.com/forums/topic/421-bw-rgb-values-in-film-stocks/ (orig. prime-junta → markushartel.com/blog/learn-from-markus/channel-mixer-settings)
- Colour theory for B&W (filter effects, "like colours are lightened") — https://www.35mmc.com/31/05/2021/colour-theory-for-black-and-white-photography-part-1-digital-and-analogue-filters-by-sroyon/
- Tri-X RMS 17 / HP5 "slightly grittier" — https://www.analog.cafe/r/ilford-hp5-film-review-ntu0
- Acros II RMS 7 corroboration — https://bluemooncameracodex.com/technical-reviews/fujiacrosii
- G'MIC open-source film CLUTs — https://gmic.eu/color_presets/
