# R3 — Fujifilm Film Emulation Research (color science → implementable recipes)

Researched for an 8-bit sRGB web image editor. Engine primitives assumed:
`SRGB_TO_LINEAR` LUT + `linearToSrgbByte`, 3×3 color matrices (operate in **linear**),
per-channel 1D tone curves (control points 0–1), global + per-hue saturation,
seeded grain, optional halation.

**Confidence tagging convention**

- **[M]** MEASURED / documented — from a Fujifilm datasheet or Fuji's own published rating table.
- **[E]** ESTIMATED — a tuned starting number I derived from the documented _direction_ (curve shape, saturation/contrast rating, dye behavior, community consensus). The _sign and relative magnitude_ are grounded; the exact value is a calibratable seed.

**Big caveat on curves:** Fujifilm datasheets publish characteristic curves, spectral dye density, spectral sensitivity and MTF only as **plotted graphs (images)**, not as numeric tables. I could not extract numeric curve points from the PDFs. So every per-channel tone curve below is **[E]**, shaped to match the _documented_ contrast class (Velvia=High, Provia=Standard, Astia=Soft) and the documented hue/cast behavior. Treat them as calibrated seeds, not measured LUT values.

**Color-space convention used in every recipe**

- **Channel gains + 3×3 matrix + saturation/hue moves → apply in LINEAR light** (after `SRGB_TO_LINEAR`).
- **Per-channel tone curves → apply on the sRGB-gamma-encoded 0–1 value** (i.e. after re-encoding, or equivalently on the byte/255). Film density curves map cleanly onto gamma-encoded values, and this keeps S-curves from crushing linear midtones unnaturally. Each recipe states pipeline order explicitly.
- Reversal (slide) stocks are **POSITIVE** → the look IS the curve (steep, clipping). Negative stocks are scanned/printed → emulate the _scanned-print_ look (softer toe/shoulder, latitude), not the orange-mask negative itself.

---

## Pipeline order (recommended, all stocks)

1. Decode sRGB byte → **linear** (LUT).
2. **Channel gains** (white-balance / cast) — linear multiply.
3. **3×3 color matrix** (hue crosstalk, channel mixing) — linear.
4. **Global saturation** + **per-hue saturation** — convert linear→ a luma-preserving chroma op (e.g. scale around Rec.709 luma, or in HSL/Oklch). Reds/greens/blues moved here.
5. Re-encode linear → sRGB 0–1.
6. **Per-channel tone curves** (R,G,B) on the 0–1 gamma-encoded value — this delivers contrast, toe/shoulder, and the highlight/shadow color casts.
7. Optional **halation** (slide reds; negative warm highlights) and **grain** (seeded), added last.
8. Quantize → byte.

> Curves are given as control points `(x,y)` in 0–1 on the gamma-encoded value; interpolate monotonic-cubic (PCHIP) or Catmull-Rom clamped. A linear point set `(0,0)(1,1)` = identity.

---

# SLIDE / E-6 REVERSAL FAMILY (POSITIVE)

Fuji's own published ratings for the Fujichrome line (single source, [M], from filmcolors.org reproduction of the Fuji "Contrast and Saturation table"):

| Stock                 | Color repro      | Saturation              | Contrast     | Sharpness      | RMS gran. | Push  | ISO |
| --------------------- | ---------------- | ----------------------- | ------------ | -------------- | --------- | ----- | --- |
| Velvia 50 (RVP50)     | image color      | "world's highest"       | High         | Extremely high | **9**     | −½…+1 | 50  |
| Velvia 100 (RVP100)   | image color      | "quintessentially high" | High         | Extremely high | **8**     | +1    | 100 |
| Velvia 100F (RVP100F) | vivid/real color | Ultra high (< RVP)      | High         | Extremely high | **8**     | +1    | 100 |
| Provia 100F (RDP III) | natural color    | High                    | **Standard** | High           | **8**     | +2    | 100 |
| Provia 400X           | real color       | High                    | Standard     | Standard       | 7         | +2    | 400 |
| Astia 100F (RAP)      | real color       | **Standard** (lowest)   | **Soft**     | High           | **7**     | +2    | 100 |

Ranking that drives the recipes: **Saturation** Velvia50 ≳ Velvia100 > Provia > Astia. **Contrast** Velvia(High) > Provia(Standard) > Astia(Soft).

---

## 1. VELVIA 50 — `RVP50` _(priority)_

**Identity** — E-6 reversal, **POSITIVE**, ISO 50. Original 1990; "Velvia 50" reissue 2007 (new couplers/raw materials, "nearly identical performance"). The reference for extreme saturation. **Signature in words:** the punchiest landscape slide ever made — electric greens, deep saturated blues, hot reds; high contrast with crushed shadows and clipped speculars; a warm overall bias. Famous for making foliage and skies "pop"; notoriously unkind to skin (goes ruddy/over-red).

**Documented color science [M]**

- Datasheet (AF3-0221E2): _"world's highest level of image color saturation and vibrancy… well-modulated, vivid color reproduction… fine neutral gray reproduction from highlights to shadows."_ Push/pull −½ to +1 stop with minimum color-balance shift.
- Contrast rating **High** [M]; RMS granularity **9** [M]; resolving power 80 lp/mm (1.6:1) / 160 lp/mm (1000:1) [M].
- Community-consistent behavior: warm bias vs the cooler RVP100; greens and reds boosted hardest; deep blues; steep contrast clips highlights and blocks shadows (narrow latitude, ~5 stops usable). [secondary, consensus]

**Recipe (seeds)**

```
# linear stage
channel_gains      R 1.06  G 1.00  B 0.96     # [E] warm bias
color_matrix (lin):                            # [E] cross-channel to deepen greens/reds, purify blue
  [ 1.14, -0.10, -0.04 ]
  [ -0.08, 1.16, -0.08 ]
  [ -0.04, -0.12, 1.16 ]
global_saturation  +35%  (×1.35)               # [E] grounded in "highest saturation" [M]
per_hue_saturation:                            # multipliers, [E]
  reds    ×1.30   oranges ×1.18  yellows ×1.10
  greens  ×1.40   cyans   ×1.15  blues  ×1.30
  magentas×1.12
# gamma-encoded stage — steep S (High contrast) [E]
tone_curve_RGB (shared luma S):
  (0.00,0.00)(0.12,0.06)(0.25,0.18)(0.50,0.50)(0.75,0.84)(0.88,0.95)(1.00,1.00)
tone_curve_R:  (0,0)(0.5,0.52)(1,1)            # tiny warm lift in mids
tone_curve_B:  (0,0.01)(0.5,0.48)(1,0.99)      # slight blue-shadow lift, blue-highlight roll-off
contrast/gamma     effective γ ≈ 1.15–1.25
grain  RMS-9 → sigma ≈ 3.0 (8-bit), luminance, fine                       # [E] from RMS 9 [M]
halation (optional): threshold 0.85, strength 0.10, tint (255,40,30), radius 2px  # slide reds bloom
```

**Signature trait to nail:** maximal green + red saturation with a _steep, clipping_ contrast curve and a faint warm cast. If skin looks too healthy, you've under-cooked it.

---

## 2. VELVIA 100 — `RVP100` _(priority)_

**Identity** — E-6 reversal, **POSITIVE**, ISO 100. Achieves "world's highest color saturation **equal to Velvia 50**" via new cyan/magenta/yellow couplers [M]. **Signature:** Velvia saturation, one stop faster, **slightly lower contrast than RVP50, cooler yellows, better skin tones** (Ken Rockwell; Fuji). Described as "flashier / more avant-garde" vs RVP50's "creamy/warm" (Novikov). Use as the _slightly cooler, marginally more forgiving_ Velvia.

**Documented color science**

- Saturation "quintessentially high," Contrast **High**, RMS **8** [M].
- Cooler yellow rendition and improved skin vs RVP50 [secondary, strong consensus]; cooler overall white balance than RVP50 [M-ish, Fuji marketing + reviews].

**Recipe (seeds)** — start from Velvia 50 and apply these deltas:

```
channel_gains      R 1.03  G 1.00  B 1.00     # [E] less warm than RVP50
global_saturation  +33% (×1.33)
per_hue_saturation: greens ×1.36  reds ×1.26  blues ×1.30  yellows ×1.04  # cooler/tamed yellow [E]
tone_curve (shared S, slightly gentler than RVP50):
  (0,0)(0.12,0.07)(0.25,0.19)(0.5,0.5)(0.75,0.82)(0.88,0.94)(1,1)
grain sigma ≈ 2.6 (RMS 8) [E]
halation same as RVP50 but strength 0.08
```

**Signature trait to nail:** Velvia-level saturation but **neutral-to-cool** white balance and a hair less shadow crush than the 50.

---

## 3. PROVIA 100F — `RDP III`

**Identity** — E-6 reversal, **POSITIVE**, ISO 100. The neutral, all-round professional slide. **Signature:** accurate, clean, "natural color" — moderate (not Velvia) saturation, **standard/normal contrast**, finest grain (RMS 8), excellent long-exposure & push (+2) behavior. Slightly cool-neutral; reds render "bright, bold, rich" (Shutterbug); holds highlights far better than Velvia. The calibration baseline of the slide family.

**Documented color science**

- Color repro **natural**; Saturation **High** (but a clear step below Velvia); Contrast **Standard**; Sharpness High; RMS **8**; push **+2** [M].
- "Ultra-high-quality, daylight ISO 100… finest grain… true-to-life contrast curve" [M datasheet].

**Recipe (seeds)**

```
channel_gains      R 1.00  G 1.00  B 1.02     # [E] faint cool/clean cast
color_matrix: near-identity, mild green purity:
  [ 1.06, -0.04, -0.02 ]
  [ -0.03, 1.07, -0.04 ]
  [ -0.02, -0.06, 1.08 ]
global_saturation  +14% (×1.14)               # [E] "High but < Velvia"
per_hue_saturation: reds ×1.16 greens ×1.16 blues ×1.18 yellows ×1.04 skin ×1.00
tone_curve (gentle normal S, standard contrast):
  (0,0)(0.15,0.12)(0.5,0.5)(0.82,0.86)(1,1)
grain sigma ≈ 2.4 (RMS 8) [E]
halation off (or threshold 0.92 strength 0.04)
```

**Signature trait to nail:** _restraint_ — clean neutral color with a gentle, well-behaved contrast curve and intact highlights. It should read "professional/accurate," not punchy.

---

## 4. ASTIA 100F — `RAP`

**Identity** — E-6 reversal, **POSITIVE**, ISO 100. The soft portrait/fashion slide. **Signature:** "soft contrast and translucency," **lowest saturation of the slide line ("Standard")**, creamy-smooth, flattering skin, faithful (not boosted) color, very fine grain (RMS 7), wide-for-a-slide latitude, +2 push. Slightly cool-neutral. The anti-Velvia.

**Documented color science**

- Color repro **real color**; Saturation **Standard** (lowest); Contrast **Soft**; RMS **7**; push **+2** [M].
- "World-class granularity for extreme skin-tone reproduction… soft contrast and translucency… ideal for portrait and fashion." [M]

**Recipe (seeds)**

```
channel_gains      R 1.00  G 1.00  B 1.01
color_matrix: near identity (no green boost — keep it faithful)
global_saturation  +4% (×1.04)  or even ×1.00
per_hue_saturation: reds ×1.04 greens ×1.02 blues ×1.06 skin ×0.96   # gently desaturate skin [E]
tone_curve (SOFT — lifted toe, pulled shoulder, low slope):
  (0,0.03)(0.12,0.12)(0.5,0.5)(0.85,0.82)(1,0.98)
contrast/gamma  effective γ ≈ 0.92 (lower contrast)
grain sigma ≈ 2.2 (RMS 7, finest) [E]
halation off
```

**Signature trait to nail:** **soft, low-contrast curve with lifted shadows + held-back highlights and slightly muted skin.** It is the only slide here that should _not_ clip.

---

# NEGATIVE / C-41 FAMILY (emulate the _scanned-print_ look, not the orange-mask neg)

## 5. FUJICOLOR PRO 400H _(priority)_

**Identity** — C-41 color **NEGATIVE**, ISO 400, launched 2004, discontinued 2021. Fuji's beloved pro pastel/wedding film. Built on a **4th color-sensitive layer** (beyond RGB) + "Fine Σ" flat-grain tech. **Signature:** pastel, airy, **low-to-moderate contrast**, wide latitude (~10 stops DR [M-derived]); cool **cyan-leaning highlights**; **denser, cooler greens** (the magenta layer); **bright pinks**; **desaturated, clean shadows**; faithful, slightly cool skin. Iconic when **overexposed +1 to +2** — highlights wash toward airy cyan-white pastel.

**Documented color science [M]** (datasheet AF3-176E)

- _"Clearer colors in the highlights and appropriately controlled (i.e. reduced) color saturation in the shadows"_ — **this is the recipe's spine**: lift+desaturate highlights, desaturate shadows.
- 4th-layer tech "reproduce colors as perceived by the human eye… natural colors even under fluorescent/mixed light… more natural-looking shadows… three-dimensional look." [M]
- "Faithful reproduction of neutral grays over a wide exposure range from under- to over-exposure"; "superb skin tones, smoothly continuous gradation from highlights to shadows without washout." [M]
- Magenta/4th layer makes **greens appear denser and cooler** in scans; gave a "cool deep greens + bright pinks" daylight palette (Analog.Cafe, citing the 4th-layer behavior). [secondary, datasheet-consistent]
- Dynamic range **~3.15 lux·s ≈ ~10 stops** (Analog.Cafe, computed from Fuji's published characteristic curves). RMS granularity **4** on datasheet (fine on paper; looks grainier than Portra 400 in practice). [secondary]

**Recipe (seeds)** — this is the marquee look, tune it carefully.

```
# linear stage
channel_gains      R 0.99  G 1.00  B 1.04      # [E] overall cool lean
color_matrix (lin): push greens cooler/denser, keep skin faithful:
  [ 1.04, -0.02, -0.02 ]
  [ -0.05, 1.08, -0.03 ]        # green row pulls a little red+blue out → denser, cooler green
  [ -0.02, -0.04, 1.06 ]
global_saturation  −8% (×0.92)                 # low overall saturation [M direction]
per_hue_saturation:
  greens ×1.10 (denser) but shifted cooler   reds/pinks ×1.08 (bright pink)
  blues  ×1.04   yellows ×0.92   skin ×0.96
# gamma-encoded stage
tone_curve (LOW contrast, lifted toe = airy; soft shoulder):
  (0,0.04)(0.15,0.16)(0.5,0.51)(0.80,0.80)(1,0.96)
# HIGHLIGHT cyan cast + SHADOW desaturation are the signature:
tone_curve_R: (0,0.05)(0.5,0.50)(0.85,0.83)(1,0.95)   # pull red out of highlights → cyan highlights
tone_curve_B: (0,0.06)(0.5,0.51)(1,0.99)              # lift blue in shadows → cool clean shadows
shadow_desaturation: below luma 0.25, ×0.80 chroma    # "controlled saturation in shadows" [M]
highlight_desaturation: above luma 0.80, ×0.85 chroma # "clearer (cleaner) highlights" [M]
grain sigma ≈ 3.2 (looks grainier than RMS-4 implies) [E]
halation (optional, warm): threshold 0.90 strength 0.05 tint (255,180,150)
```

> To emulate the _classic overexposed_ Pro 400H look, additionally raise input exposure +0.7…+1.3 stop **before** the curve so the lifted toe + cyan highlight roll-off produce the airy pastel.

**Signature trait to nail:** **airy low-contrast pastel with cyan-leaning, desaturated highlights, cool dense greens, and clean desaturated shadows.** Highlights must drift cyan/white, never warm.

---

## 6. SUPERIA X-TRA 400 _(priority — consumer)_

**Identity** — C-41 color **NEGATIVE**, ISO 400, consumer line (ca. 1998; "New Super Uniform Fine Grain" revision; original versions had a 4th cyan layer, dropped late-2000s). **Signature:** lively consumer color — **distinct Fuji greens and punchy blues**, vibrant reds/pinks, **higher contrast and more saturation than Pro 400H**, a characteristic **cool green-cyan cast in shadows** (and strong green under fluorescent), visible grain. The "color-pop snapshot" look.

**Documented color science [M]** (datasheet AF3-0217E)

- Emphasis on **gray balance** "maintained from highlights to deepest shadows," wide latitude, excellent skin [M].
- _"Photographing under fluorescent lighting may result in a greenish tint"_ (corrected only in printing) [M] → the famous green cast.
- 18% gray-card target: **red-channel density 0.75–0.95** through Status M [M] (process/scan reference, not a screen number).
- The newest revision has a **"slight reddish tint" vs the previous** Superia X-TRA 400 [M] → later stock is marginally warmer.
- 4th cyan layer (original) gave deep cool greens + bright pinks like Pro 400H; later versions lost it → simpler, slightly warmer palette [secondary, datasheet-consistent].

**Recipe (seeds)**

```
channel_gains      R 1.00  G 1.03  B 1.02      # [E] green+cyan lean (classic Fuji consumer cast)
color_matrix: boost green presence, cool shadows:
  [ 1.08, -0.05, -0.03 ]
  [ -0.04, 1.12, -0.06 ]
  [ -0.03, -0.05, 1.10 ]
global_saturation  +18% (×1.18)
per_hue_saturation:
  greens ×1.24  blues ×1.18  reds ×1.16  pinks/magenta ×1.14  yellows ×1.02
# moderately punchy S-curve, cool shadow cast:
tone_curve (RGB shared): (0,0.02)(0.15,0.13)(0.5,0.5)(0.82,0.85)(1,0.99)
tone_curve_G: (0,0.04)(0.5,0.52)(1,1)          # lift green in shadows → green-cyan cast
tone_curve_B: (0,0.03)(0.5,0.50)(1,0.98)
grain sigma ≈ 3.8 (consumer, visible) [E]
halation off
```

**Signature trait to nail:** **vivid greens + cool green-cyan shadow cast** with snappy consumer contrast. If shadows are neutral, add green.

---

## 7. SUPERIA 200 (and the consumer family)

**Identity** — C-41 **NEGATIVE**, ISO 200, consumer. Same Superia DNA, gentler. **Signature:** the classic "Fuji green," good reds, **slightly warmer and lower-contrast than X-TRA 400, finer grain**, less aggressive cast. Everyday daylight look.

**Recipe (seeds)** — start from Superia X-TRA 400, soften:

```
channel_gains      R 1.01  G 1.02  B 1.00      # [E] a touch warmer than 400
global_saturation  +12% (×1.12)
per_hue_saturation: greens ×1.18 blues ×1.10 reds ×1.14 yellows ×1.04
tone_curve: (0,0.02)(0.15,0.14)(0.5,0.5)(0.82,0.84)(1,0.99)   # slightly softer
grain sigma ≈ 3.0 (finer than 400) [E]
```

**Signature trait to nail:** mild Fuji-green daylight palette, friendlier contrast than X-TRA 400. (All numbers [E], directionally grounded.)

---

## 8. FUJICOLOR NATURA 1600 (+ Fujichrome notes)

**Identity** — C-41 **NEGATIVE**, ISO 1600, Japan-only, 2003–2017, "Fine Σ" tech (shared with Pro 400H). **Signature:** highest box-ISO color film ever; **warm, natural color with good reds/blues/yellows**, surprisingly fine grain for the speed but visibly grainy, **lower contrast**, designed for available/tungsten low light (Natura cameras) — flattering in warm indoor light. [secondary: All About Film, Casual Photophile, Analog.Cafe]

**Recipe (seeds, all [E])**

```
channel_gains      R 1.05  G 1.00  B 0.97      # warm low-light bias
global_saturation  +8% (×1.08)
per_hue_saturation: reds ×1.16 blues ×1.10 yellows ×1.08 greens ×1.04
tone_curve (low contrast, lifted toe): (0,0.05)(0.15,0.16)(0.5,0.5)(0.82,0.80)(1,0.96)
grain sigma ≈ 5.5 (high-ISO, prominent)
halation (warm, strong-ish): threshold 0.82 strength 0.10 tint (255,170,120)
```

**"Fujichrome" / "Natura" as generic labels:** Fujichrome = the slide family → use **Provia (neutral)** or **Velvia (punchy)** as the generic. Natura (camera brand) low-light look ≈ the Natura 1600 recipe.

---

# Per-hue saturation reference (engine hue bins)

Use 6–8 hue bins. Across the Fuji line the _signature_ moves are:

- **Greens** — boosted & shifted cooler on every Fuji stock (the brand's calling card). Strongest: Velvia, X-TRA. Cool-dense on Pro 400H.
- **Blues** — boosted, deep, slightly cyan. Strong on Velvia/Superia.
- **Reds** — hot on Velvia; bright **pink/magenta** on the negatives (Pro 400H, Superia).
- **Yellows** — tamed/cooled on Velvia 100, Pro 400H (vs warm Velvia 50, Natura).
- **Skin** — boosted on Velvia (problem), faithful/slightly muted on Provia/Astia/Pro 400H.

---

# Free / openly-licensed Fuji LUTs & CLUTs

| Source                                                                                                        | What                                                                                                           | Format                                                                  | License                                                                                                                                                      | Notes                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **abpy/FujifilmCameraProfiles** (github.com/abpy/FujifilmCameraProfiles)                                      | Provia, Velvia, Astia, Classic Chrome, Pro Neg Std/Hi, Eterna, Reala Ace, Classic/Nostalgic Neg, Bleach Bypass | `.cube` (DisplayP3 + sRGB), **`.png` HaldCLUT (sRGB)**, DCP, xml tables | **CC-BY-NC-SA 4.0**                                                                                                                                          | **Non-commercial.** Must attribute + share-alike. Built to match Adobe X-Trans4 camera-matching profiles. LUTs expect a **linear** input profile. Highest-quality free set; **but NC license blocks commercial product use** — verify before shipping. |
| **arangast / Stuart Sowerby** (blog.sowerby.me/fuji-film-simulation-profiles; thread discuss.pixls.us/t/3247) | Provia, Astia, Velvia, Classic Chrome, Pro Neg Std/Hi (X-Trans II)                                             | **HaldCLUT PNG** (zip, 8.4 MB)                                          | Freely shared; **added to the RawTherapee Film Simulation Collection** (RawTherapee/PIXLS community, GPL-spirit). No explicit SPDX license stated by author. | Made from Fuji's own RAW converter exports; "very close to out-of-camera." Free to use; **confirm license** for commercial redistribution.                                                                                                             |
| **pixlsus/RawTherapee-Presets** (github.com/pixlsus/Rawtherapee-presets)                                      | Fuji presets incl. Acros                                                                                       | PP3 presets                                                             | Community repo (check repo LICENSE)                                                                                                                          | Presets, not LUTs; RawTherapee-specific.                                                                                                                                                                                                               |
| **bastibe/Fujifilm-Auto-Settings-for-Darktable**                                                              | Fuji film-sim styles + LUTs for Darktable                                                                      | LUTs + LUA                                                              | MIT (check repo)                                                                                                                                             | Darktable-oriented; usable LUTs.                                                                                                                                                                                                                       |
| **Fujifilm official "Film Simulation LUTs"** (fujifilm-x.com/support/download/lut)                            | Velvia, Astia, Classic Chrome, Eterna, etc.                                                                    | `.cube` for **F-Log/F-Log2**                                            | **Proprietary EULA** (free download, NOT redistributable; intended for Fuji F-Log footage)                                                                   | These expect F-Log-encoded input, **not sRGB** — not drop-in for an sRGB editor. Reference only.                                                                                                                                                       |

**Important:** these LUTs emulate Fuji's **in-camera film _simulations_** (digital looks named after the stocks), which approximate — but are not identical to — the analog emulsions. They're an excellent cross-check / shortcut, but the recipes above target the _analog stock_ behavior documented in the datasheets. The cleanest legal path for a commercial product is to **ship your own recipe-based curves/matrices** (above) and optionally let users import their own `.cube`/HaldCLUT files.

---

# Sources (URLs)

**Primary — Fujifilm datasheets (qualitative science = [M]; curves are plotted images, not numeric):**

- Velvia 50 [RVP50] data guide — https://www.ishootfujifilm.com/uploads/VELVIA%2050%20Data%20Guide.pdf
- Velvia 100 [RVP100] datasheet — https://asset.fujifilm.com/master/emea/files/2020-10/2f3c7f90a0b0c6e605e84f98b7d489c2/films_velvia-100_datasheet_01.pdf
- Provia 100F [RDP III] datasheet — https://asset.fujifilm.com/master/emea/files/2020-10/2c27854d5609945fbe7e48afc61f815d/films_provia-100f_datasheet_01.pdf
- Pro 400H datasheet — https://asset.fujifilm.com/master/emea/files/2020-10/a6cb96275e4957ddc7b3ca932b7755e5/films_pro-400h_datasheet_01.pdf
- Superia X-TRA 400 datasheet (AF3-0217E) — https://asset.fujifilm.com/master/emea/files/2020-10/9a958fdcc6bd1442a06f71e134b811f6/films_superia-xtra400_datasheet_01.pdf
- Fujifilm Professional Data Guide (spectral dye density / curves overview) — https://asset.fujifilm.com/www/ca/files/2020-03/d52487c5c6f84e7f935c299491c5c1ff/ProfessionalFilmDataGuide.pdf
- Fuji "Contrast and Saturation table for Fujichrome films" (ratings = [M]) — https://filmcolors.org/wp-content/uploads/2025/12/Fuji_Contrast-and-Saturation-table-for-Fujichrome-films.pdf

**Secondary — color/behavior writeups (consensus, used for cast/latitude direction):**

- Pro 400H review (4th layer, ~10-stop DR, cool greens/pinks) — https://www.analog.cafe/r/fujifilm-fujicolor-pro-400h-film-review-rau5
- Provia 100F review/notes — https://www.analog.cafe/r/fujifilm-provia-100f-slide-film-review-ensh ; https://www.shutterbug.com/content/new-fujichrome-provia-100f-rdp-iii
- Velvia 50 vs 100 (warmth/contrast/yellows) — http://www.olegnovikov.com/technical/velvia50vs100/velvia50vs100.shtml ; https://www.kenrockwell.com/fuji/velvia100.htm
- Superia line / 4th-layer history — https://en.wikipedia.org/wiki/Fujifilm_Superia ; https://www.filmtypes.com/films/fuji-superia-x-tra-400
- Natura 1600 — https://www.analog.cafe/r/fujicolor-natura-1600-film-review-4dvx ; https://casualphotophile.com/2017/08/21/fujifilm-superia-1600-natura-1600-everything-you-need-to-know-about-this-super-fast-color-film/

**Free LUTs / CLUTs:**

- https://github.com/abpy/FujifilmCameraProfiles (CC-BY-NC-SA 4.0)
- https://discuss.pixls.us/t/fuji-film-simulations-for-rawtherapee/3247 + http://blog.sowerby.me/fuji-film-simulation-profiles/
- https://github.com/bastibe/Fujifilm-Auto-Settings-for-Darktable
- https://www.fujifilm-x.com/en-us/support/download/lut/ (proprietary, F-Log)
