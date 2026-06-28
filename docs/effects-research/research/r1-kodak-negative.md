# R1 — Kodak Color Negative (C-41) Film Emulation Spec

Research for the imager2 / HAX film-emulation engine. Goal: documented, implementable per-stock recipes.
Engine contract assumed: 8-bit sRGB in/out, cheap sRGB↔linear (256-LUT + `linearToSrgbByte`), 3×3 color matrices, per-channel 1D tone curves, global + per-hue saturation, seeded grain, optional halation.

**Confidence tags used below:** `[MEASURED]` = read from a Kodak datasheet or a third-party digitization of the Kodak curves. `[ESTIMATED]` = reverse-engineered look recipe (calibrated to the measured traits; not a datasheet figure).

---

## 0. Critical framing (read first)

Kodak datasheets publish the **negative** characteristic curve (density D vs log10 exposure), spectral dye density, spectral sensitivity, MTF, and Print Grain Index. They do **not** publish RGB tone curves for a positive image.

A film-emulation _effect_ applied to an already-positive digital photo is a **print-through / scan look** (scene → negative → print/scan), not a literal negative density curve. So:

- The MEASURED facts below (ISO, contrast/gamma slopes, grain, density aims, dye behavior) are the **anchors**.
- The tone-curve control points and matrices in each "Recipe" block are `[ESTIMATED]` reverse-engineering tuned to reproduce the documented look. They are honest interpolations, not fabricated datasheet numbers.

**Two universal C-41 truths (MEASURED, apply to all six):**

1. Per-layer straight-line density gamma is low, ≈ **0.50–0.65** (C-41 is a low-contrast capture medium; contrast is added at the print/scan stage). The blue layer is consistently the **steepest**, red the **shallowest** — confirmed by the ColorPerfect digitization (see Portra 400/160 below). Net effect in a positive look: cleaner blue separation, slightly warmer highlight roll-off.
2. Highlight latitude >> shadow latitude. Negatives tolerate heavy overexposure (gentle, very long shoulder) and clip shadows sooner (toe). In positive-look terms this becomes the signature **soft highlight roll-off + lifted, low-contrast shadows** — strongest in Portra, weakest in Ektar.

**Grain note:** Modern Kodak reports **Print Grain Index (PGI)**, which _replaces_ diffuse RMS granularity and is **not convertible** to an RMS number (datasheet states this explicitly). PGI 25 = visual threshold; +4 units = 1 just-noticeable-difference; standard 14-inch viewing distance. So RMS granularity numbers are **not available** for these current stocks — I use PGI for the relative grain ordering (MEASURED) and pick absolute engine amounts by ear (ESTIMATED).

---

## 1. KODAK PROFESSIONAL PORTRA 400 — _priority stock_

### Identity

- Type: C-41 color negative. ISO 400 (true ISO 400). Datasheet E-4050 (Feb 2016, Kodak Alaris). [MEASURED]
- Tech: Kodak VISION-derived, Micro-Structure Optimized T-GRAIN, antenna dye sensitization (cyan+magenta layers), DIR couplers. [MEASURED]
- The look (plain words): the default "natural film" stock. Flattering, slightly-warm-but-balanced skin tones; low contrast; _enormous_ overexposure latitude; muted-yet-pleasing saturation; soft creamy highlights; gentle teal-leaning shadows. The stock people reach for when they want film that doesn't shout.

### Documented color science

- **Per-channel straight-line gamma** (ColorPerfect digitization of the Kodak E-4050 curves — third-party MEASURED): ColorPerfect γ R=1.834, G=1.804, B=1.567. ColorPerfect γ = 1/slope, so **density slopes ≈ R 0.545, G 0.554, B 0.638**. Blue layer is ~17% steeper than red. [MEASURED]
- **Red-channel Status M density aims** (negative): gray card 0.77–0.87; light-skin forehead 1.08–1.18; dark-skin forehead 0.93–1.03. Low spread = low contrast. [MEASURED]
- Famous trait: _skin-tone rendering & latitude_. Spectral sensitivity + image-modifier chemistry tuned so reds/oranges (skin) stay warm without over-saturating; long shoulder = highlights resist clipping ("expose for the shadows, Portra holds the highlights"). [MEASURED — datasheet marketing + curve shape]
- Grain (PGI, 135 / 24×36mm): 4×6 = **37**, 8×10 = 59, 16×20 = 89. (120: 25/37/59.) Finest 400-speed color neg made. [MEASURED]

### Recipe (implement in this order)

**Color space:** do matrix + saturation in **LINEAR**; do the tone curves in **sRGB-gamma 0–1** (control points authored in display space for intuitiveness).

1. **White-balance gain (linear):** R×1.03, G×1.00, B×0.98 (very subtle warm). [ESTIMATED]
2. **Per-channel tone curves** (sRGB 0–1 control points; monotone cubic between points). Lifted blacks + soft highlight shoulder; channels diverge to make warm highlights / cool shadows: [ESTIMATED]
   - R: (0,0.045) (0.25,0.26) (0.50,0.52) (0.75,0.78) (1.0,0.965)
   - G: (0,0.040) (0.25,0.25) (0.50,0.50) (0.75,0.76) (1.0,0.950)
   - B: (0,0.060) (0.25,0.25) (0.50,0.49) (0.75,0.74) (1.0,0.930)
   - Reading: blue black lifted most (0.060) → cool/teal shadows; blue highlight pulled most (0.930 vs red 0.965) → warm highlights. Midtone slope ≈1.04 = mild contrast. This split-tone IS the Portra signature.
3. **Saturation:** global ≈ **0.93**. Per-hue: reds/oranges (skin) pull to ~0.88 (hold skin from going hot); greens/foliage ~0.95 with a slight yellow warmth; blues ~0.95. [ESTIMATED]
4. **Grain:** fine, **luminance-dominant** (≈85% luma / 15% chroma). Engine amount ≈ **0.30** on a 0–1 scale (anchored to PGI 37). Seeded. Optional: blue-channel grain ×1.2 (real chroma-grain ordering). [amount ESTIMATED, ordering MEASURED]
5. **Halation:** low-moderate. Red/orange bloom on bright highlights bordering dark areas; radius ~6–10px @ 24MP, opacity ~0.12. [ESTIMATED]

---

## 2. KODAK PROFESSIONAL PORTRA 160

### Identity

- C-41, ISO 160. Datasheet E-4051 (Feb 2016). [MEASURED]
- Look: the cleanest, finest Portra. Same natural skin science as 400 but slightly higher micro-contrast, a touch more saturation, lower grain. Studio/portrait/commercial default.

### Documented color science

- ColorPerfect γ R=1.916, G=1.829, B=1.665 → **density slopes ≈ R 0.522, G 0.547, B 0.601**. Same blue-steepest ordering; overall very slightly lower slope than 400 in this digitization. [MEASURED]
- Red Status M aims: gray card 0.79–0.89; light forehead 1.10–1.20; dark 0.95–1.05. [MEASURED]
- Grain (PGI, 135): 4×6 = **28**, 8×10 = 50, 16×20 = 79 (noticeably finer than 400). [MEASURED]

### Recipe

- Start from the Portra 400 recipe with these deltas: [ESTIMATED]
  - Black lift reduced: R/G black ≈0.035, B black ≈0.050 (cleaner shadows).
  - Highlights slightly higher (R 1.0→0.97, B 1.0→0.94).
  - Saturation global ≈ **0.96** (slightly more than 400). Skin hold ~0.90.
  - Grain amount ≈ **0.18** (PGI 28). Luminance-dominant.
  - Halation low (opacity ~0.08).

---

## 3. KODAK PROFESSIONAL PORTRA 800

### Identity

- C-41, ISO 800 (pushable to 1600/3200 per datasheet). Datasheet E-4040 (Feb 2016). [MEASURED]
- Look: the low-light Portra. "Best-in-class underexposure latitude" — deep shadow detail; slightly warmer and a bit more contrast/saturation than 400; visible but well-controlled grain. Concerts, indoors, long lenses.

### Documented color science

- Red Status M aims @ EI 800: gray card 0.75–0.95; light forehead 0.95–1.25; dark 0.75–1.10. (Push 1/Push 2 columns shift everything up ~0.2/0.4.) Wider spread than 160/400 = a touch more contrast. [MEASURED]
- Grain (PGI, 120-size): 4×6 = **36**, 8×10 = 48, 16×20 = 70. (135 table not captured in extraction; 135 grain is coarser than the 120 figures and clearly coarser than Portra 400.) [MEASURED for 120]
- "Sensitive to environmental radiation" (high-speed) — irrelevant to emulation but confirms high-speed emulsion. [MEASURED]

### Recipe

- From Portra 400 with these deltas: [ESTIMATED]
  - More shadow lift / shadow detail bias: R/G black ≈0.065, B black ≈0.075 (open shadows, cool-warm preserved).
  - Slightly warmer overall: WB R×1.05, B×0.96.
  - Saturation global ≈ **0.95**, reds held ~0.90.
  - Slightly higher midtone contrast (0.25→0.75 slope ~1.08).
  - Grain amount ≈ **0.45**, luminance-dominant with blue grain ×1.3 (high-speed chroma grain is more visible).
  - Halation moderate-high (opacity ~0.18) — fast film + bright point sources bloom red.

---

## 4. KODAK PROFESSIONAL EKTAR 100

### Identity

- C-41, ISO 100. "World's finest grain color negative film." Datasheet E-4046 (Feb 2016). [MEASURED]
- Tech: Micro-Structure T-GRAIN + Advanced Cubic emulsions, DIR couplers. [MEASURED]
- Look: the saturated, vivid, ultra-clean stock — closest color-neg analog to slide film. High saturation (esp. blues/greens), higher contrast, punchy, near-grainless. Landscape/travel/product. _Not_ a skin stock — can render skin ruddy.

### Documented color science

- Higher contrast than Portra (steeper curves; Kodak positions it as "high saturation, ultra-vivid color"). No third-party per-channel γ found, but curve family is visibly steeper than Portra. [MEASURED qualitative]
- Red Status M aims: gray card 0.77–0.87; light forehead 1.08–1.18; dark 0.93–1.03 (same red aims as Portra 400 — the extra "pop" comes from per-channel dye/contrast differences and saturation, not red density). [MEASURED]
- Grain (PGI, 135): 4×6 = **<25** (below visual threshold), 8×10 = 38, 16×20 = 66. Finest of all six. [MEASURED]

### Recipe

- **WB (linear):** near-neutral, faintly cool: R×1.00, G×1.00, B×1.02. [ESTIMATED]
- **Tone curves** (sRGB 0–1) — steeper S, minimal black lift, strong highlight contrast: [ESTIMATED]
  - R: (0,0.02) (0.25,0.23) (0.50,0.50) (0.75,0.80) (1.0,0.99)
  - G: (0,0.02) (0.25,0.235) (0.50,0.50) (0.75,0.80) (1.0,0.99)
  - B: (0,0.03) (0.25,0.235) (0.50,0.50) (0.75,0.79) (1.0,0.98)
  - (0.25→0.75 slope ≈1.14 = visibly more contrast than Portra; minimal split-tone.)
- **Saturation:** global ≈ **1.20**. Per-hue: blues ×1.30, greens ×1.25, reds ×1.10 (watch skin), yellows ×1.10. [ESTIMATED]
- **Grain:** very fine, luminance-only, amount ≈ **0.12** (PGI <25). [amount ESTIMATED]
- **Halation:** low (opacity ~0.06) — clean stock, but bright reds still bloom slightly.

---

## 5. KODAK GOLD 200

### Identity

- C-41, ISO 200, consumer stock. Datasheet E-7022 (June 2023, current). [MEASURED]
- Look: warm, nostalgic, sunny "golden hour in a box." Higher saturation & contrast than Portra; warm/yellow cast; rich reds and yellows; slightly muted, slightly green-yellow midtones. The classic everyday-snapshot film aesthetic.

### Documented color science

- Red Status M aims notably **higher & wider** than Portra: gray card **0.85–1.05**; light forehead **1.15–1.45**; dark 0.90–1.30. Higher density + wider spread = more contrast and more saturation than Portra. [MEASURED — strongest objective signal of Gold's contrastier/warmer character]
- Marketed: "saturated colors → bright, colorful prints"; fine grain + high sharpness. [MEASURED]
- Grain (PGI, 135): 4×6 = **44**, 8×10 = 64. Coarser than all Portra/Ektar. [MEASURED]

### Recipe

- **WB (linear):** warm — R×1.06, G×1.00, B×0.93. [ESTIMATED]
- **Tone curves** (sRGB 0–1) — warm cast baked into channel divergence, medium contrast, moderate black lift: [ESTIMATED]
  - R: (0,0.050) (0.25,0.27) (0.50,0.54) (0.75,0.80) (1.0,0.98) ← red lifted across = warmth
  - G: (0,0.045) (0.25,0.25) (0.50,0.51) (0.75,0.77) (1.0,0.95)
  - B: (0,0.040) (0.25,0.22) (0.50,0.46) (0.75,0.70) (1.0,0.90) ← blue pulled across = yellow/golden cast
- **Saturation:** global ≈ **1.10**. Per-hue: reds ×1.15, yellows ×1.18, greens ×1.05, blues ×0.90 (muted skies). [ESTIMATED]
- **Grain:** medium, luminance-dominant (≈80/20), amount ≈ **0.35** (PGI 44). [amount ESTIMATED]
- **Halation:** low-moderate (opacity ~0.12), warm.

---

## 6. KODAK COLORPLUS 200

### Identity

- C-41, ISO 200, budget stock. **No official Kodak datasheet exists** (Kodak confirmed). Descends from 1980s Kodacolor VR-200 emulsion. [MEASURED that no datasheet exists; lineage MEASURED via reviews]
- Look: vintage, warm, budget-Gold. Strong warm cast, muted/slightly-off blues (esp. overcast), fairly strong contrast & saturation, visible grain, the most overtly "old film" character of the six.

### Documented color science

- **None published.** All numbers below are ESTIMATED from review consensus (analog.cafe, exaframe, lenslurker): warm tones, muted blues, strong-ish contrast/saturation, grainier than Gold, "vintage." T-grain emulsion lineage. [ESTIMATED]
- Grain: no PGI published; reviewers rate it grainier than Gold 200 → assume PGI ≈ 45–50 equivalent. [ESTIMATED]

### Recipe

- From the Gold 200 recipe with these deltas — push everything more "vintage": [ESTIMATED]
  - WB warmer: R×1.07, B×0.90.
  - Blue muted harder: B curve top 1.0→0.88, blues saturation ×0.80.
  - Slightly more contrast (0.25→0.75 slope ~1.10) and a hair more black lift (R/G black ≈0.055).
  - Saturation global ≈ **1.08**, reds ×1.15, yellows ×1.15.
  - Grain amount ≈ **0.45**, luminance-dominant.
  - Halation low-moderate (~0.12).
- **Whole stock = lowest confidence.** Ship as "ColorPlus (approx., no datasheet)".

---

## 7. Quick-reference tables

### Measured anchors

| Stock         | ISO | Contrast cue (red Status M gray→fore spread) | Per-layer γ (slope) | PGI 135 @4×6 | Grain order |
| ------------- | --- | -------------------------------------------- | ------------------- | ------------ | ----------- |
| Portra 160    | 160 | 0.79–0.89 → 1.10–1.20                        | R.522 G.547 B.601   | 28           | finest-2    |
| Portra 400    | 400 | 0.77–0.87 → 1.08–1.18                        | R.545 G.554 B.638   | 37           | medium      |
| Portra 800    | 800 | 0.75–0.95 → 0.95–1.25                        | —                   | (120: 36)    | coarse      |
| Ektar 100     | 100 | 0.77–0.87 → 1.08–1.18                        | steeper (qual.)     | <25          | finest      |
| Gold 200      | 200 | 0.85–1.05 → 1.15–1.45                        | —                   | 44           | coarse      |
| ColorPlus 200 | 200 | none                                         | none                | ~45–50 est   | coarsest    |

### Engine knob summary (ESTIMATED look params)

| Stock         | WB R/G/B       | Black lift (R/G/B) | Global sat | Grain amt | Halation |
| ------------- | -------------- | ------------------ | ---------- | --------- | -------- |
| Portra 160    | 1.03/1.00/0.98 | .035/.035/.050     | 0.96       | 0.18      | 0.08     |
| Portra 400    | 1.03/1.00/0.98 | .045/.040/.060     | 0.93       | 0.30      | 0.12     |
| Portra 800    | 1.05/1.00/0.96 | .065/.065/.075     | 0.95       | 0.45      | 0.18     |
| Ektar 100     | 1.00/1.00/1.02 | .020/.020/.030     | 1.20       | 0.12      | 0.06     |
| Gold 200      | 1.06/1.00/0.93 | .050/.045/.040     | 1.10       | 0.35      | 0.12     |
| ColorPlus 200 | 1.07/1.00/0.90 | .055/.050/.040     | 1.08       | 0.45      | 0.12     |

**Single most important trait per stock to nail:** Portra 160/400 → warm-highlight / cool-shadow split-tone at LOW contrast (the blue curve diverging from red is the whole game). Portra 800 → open low-contrast shadows + visible grain. Ektar → high saturation (blues/greens) + steeper contrast + near-zero grain. Gold → yellow/warm cast + higher contrast than Portra. ColorPlus → exaggerated warm + muted blue vintage.

---

## 8. Free / shippable LUTs (state license before shipping)

- **RawTherapee Film Simulation Collection** (HaldCLUT PNGs; assembled by Pat David). Includes Kodak Ektar 100, Portra 160 NC/VC, Portra 400 NC/UC/VC, Portra 800, and many Gold-era stocks. Mirror: `github.com/cedeber/hald-clut` declares **GPL-3.0**. ⚠️ Provenance is _mixed_ — the original collection was assembled from multiple sources and its redistribution license was never cleanly stated on RawPedia (RawPedia is currently down/suspended). Treat GPL-3.0 as the operative claim from the mirror, but GPL copyleft + murky upstream provenance makes this **awkward to bundle in a closed product**. Good for internal calibration/reference, risky to ship as-is.
- **PictureFX v2** (Marc Roovers, digicrea.be) — also in that repo; historically "free for personal and commercial use," CLUT-format. Fewer exact-named Kodak stocks. Verify current terms before shipping.
- **Pat David's blog content** (patdavid.net / pixls.us) = **CC-BY-SA 4.0** — fine to reference/derive-with-attribution (share-alike applies to derivatives).
- **sguyader/Pat David RawTherapee profiles** = **CC0-1.0** — but these are `.pp3` profiles (RawTherapee-only edit recipes), not portable LUTs.
- **ColorPerfect `.negpos` characterizations** — per-channel γ triplets (used above), free to read on their site, but the plug-in is commercial ($67); the γ numbers themselves are facts, not copyrightable.

**Recommendation:** ship our **own parametric recipes** (Sections 1–6) as the primary path — clean IP, fully controllable, and the deliverable the engine actually wants. Use the RT/PictureFX HaldCLUTs only as an internal A/B calibration reference, not as a bundled asset, unless GPL-3.0 + attribution is acceptable for the product.

---

## 9. Sources

- Portra 400 datasheet E-4050: https://business.kodakmoments.com/sites/default/files/files/products/e4050_portra_400.pdf
- Portra 160 datasheet E-4051: https://business.kodakmoments.com/sites/default/files/files/resources/e4051_Portra_160.pdf
- Portra 800 datasheet E-4040: https://business.kodakmoments.com/sites/default/files/files/products/e4040_portra_800.pdf
- Ektar 100 datasheet E-4046: https://business.kodakmoments.com/sites/default/files/files/resources/e4046_ektar_100.pdf
- Gold 200 datasheet E-7022 (2023): https://www.kodakprofessional.com/sites/default/files/wysiwyg/pro/resources/E7022%20Gold%20tech%20sheet.pdf
- ColorPerfect film-gamma method + Portra example/γ values: https://www.colorperfect.com/getting_film_gammas.html?lang=en
- Pat David, "Film Emulation in RawTherapee": https://patdavid.net/2015/03/film-emulation-in-rawtherapee/
- HaldCLUT collection (GPL-3.0 mirror): https://github.com/cedeber/hald-clut
- t3mujinpack (Darktable film presets, reference): https://github.com/t3mujinpack/t3mujinpack
- ColorPlus 200 character (no datasheet): https://www.analog.cafe/r/kodak-colorplus-200-film-review-fygr
