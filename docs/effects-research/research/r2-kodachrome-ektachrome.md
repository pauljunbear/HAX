# R2 — Kodak Reversal / Slide Film Research: Kodachrome & Ektachrome

Film-emulation research for the imager2 engine. Engine target: 8-bit sRGB bytes, cheap LINEAR
conversion (SRGB_TO_LINEAR LUT + linearToSrgbByte), 3×3 matrices, per-channel 1D tone curves,
global + per-hue saturation, seeded grain, optional halation.

**Confidence tags:** `[MEASURED]` = published in a Kodak datasheet or a peer-style colorimetric
analysis. `[DOCUMENTED-QUAL]` = consistent qualitative statement across primary/expert sources
(dye chemistry, characteristic-curve behavior) but not a number we read off a curve.
`[ESTIMATED]` = engineering values _I_ derived to reproduce the documented behavior in our pipeline;
these are tuning starting points, not datasheet facts. **No datasheet numbers are fabricated.**

---

## 0. Cross-cutting facts (apply to all reversal stocks)

### Reversal (positive) vs negative — how it clips

- A color **reversal** film _is_ the final viewed image (a transparency for projection / light-box),
  so it is built high-contrast and **narrow-latitude (~5 stops usable, ~½ stop highlight headroom)**.
  [DOCUMENTED-QUAL]
- On the characteristic curve (density vs log-exposure), reversal curves **descend**: more exposure →
  less density → clear film (**D-min**) = the _highlight/white_; less exposure → max density
  (**D-max**, black) = the _shadow_. [DOCUMENTED-QUAL — standard sensitometry]
- Practical consequence for our positive-image emulation: a **strong S-curve with BOTH ends
  compressed** — highlights **clip hard to white** when pushed past the shoulder (little roll-off),
  and shadows **block up to a dense black**. This bidirectional clip is the core "punch" of slide film
  and is what separates a slide look from a negative look. [DOCUMENTED-QUAL]
- Average gamma / contrast index of E-6 / K-14 positives sits roughly **1.5–2.2** depending on stock
  (E100 = "low contrast tone scale"; E100VS / EBX / Velvia-class = high). Exact per-channel gammas are
  printed only as curve images in the datasheets, not as numbers. [ESTIMATED range from datasheet
  language + general film science]

### RMS granularity (the only hard grain numbers Kodak prints) — all [MEASURED]

Read at gross diffuse visual density 1.0, 48-µm aperture, 12× — lower = finer:
| Stock | Diffuse RMS Granularity |
|---|---|
| Ektachrome E100 | **8** (extremely fine) |
| E100G / E100GX | 8 (extremely fine) |
| Kodachrome 25 | **9** |
| Kodachrome 64 | **10** |
| E100VS | **11** (very fine) |
| Kodachrome 200 | **16** |

> Translation for our seeded-grain stage: Kodachrome 25/64 and the modern E100 family are
> **extremely fine grained** — over-graining is the #1 tell of a fake. Only K200 should look notably
> grainy.

---

## 1. KODACHROME — the headline

### 1a. Identity

- **Process K-14** (unique, complex; dyes are _added during processing_, not built into the emulsion —
  it is technically a black-&-white emulsion set developed into three dye layers). Color **reversal /
  positive**. Daylight-balanced. [MEASURED — datasheets]
- **Kodachrome 25 (KM)** ISO 25, **Kodachrome 64 (KR)** ISO 64 (the iconic one),
  **Kodachrome 200 (KL)** ISO 200. Discontinued 2009 (last lab 2010). [MEASURED]
- Datasheet self-description, K64: "Extremely sharp, extremely fine grain, reproduces subtle color
  naturally, archival." Note the word **naturally** — Kodak did _not_ market Kodachrome as a
  high-saturation film. [MEASURED — Pub. E-88 / E-55]

### 1b. What ACTUALLY makes it look like Kodachrome (myth vs documented)

**The documented signature is a combination of four things, NOT raw gamut:**

1. **Deep, dense blacks + contrast that lives in the shadows.** Kodachrome's dye set produced an
   unusually high D-max; slides read as having rich, "moody," slightly dark shadows rather than open
   ones. This is the single most-cited trait. [DOCUMENTED-QUAL]

2. **A warm/cool tonal CROSSOVER (split-tone), not a global tint.** Reds, oranges and skin run
   **warm**; shadows and skies run **cool (toward cyan/blue)**. The cool-shadow lean is repeatedly
   reported by practitioners ("add a small amount of blue cast", "strong blue cast gives the iconic
   look"). It is _grounded in the spectral data_: Kodachrome's red-sensitive layer peaks abnormally
   long (~650 nm) so it records blue sky **~¼ stop darker**, depositing extra **cyan dye** in skies
   and shadows → a measurable cyan/blue lean at the dark end. [DOCUMENTED-QUAL + MEASURED spectral
   basis — Wetherill colorimetric analysis]

3. **Selectively saturated reds/warm tones — the "National Geographic red."** Not a wide-gamut film.
   The famous reds come from (a) the long red sensitivity exaggerating/saturating reds–oranges, and
   (b) Kodachrome's **narrow-band cyan dye whose absorption peak sits low** (toward shorter
   wavelengths), reducing dye overlap so reds/magentas read purer and greens/blues read vivid.
   [DOCUMENTED-QUAL — Photo Engineer / AgX / Koch on Photrio: "narrow band cyan reduced the overlap…
   created the distinctive look"]

4. **High acutance / apparent sharpness with very fine grain.** "Extremely high sharpness"
   (datasheet). The perceived "glow"/crispness is edge acutance + fine grain, **not** heavy halation —
   Kodachrome had good anti-halation. [MEASURED descriptor + DOCUMENTED-QUAL]

**MYTH-BUSTERS (what naive emulations get wrong):**

- **It is NOT a neon/wide-gamut film.** A colorimetric reconstruction of the Kodachrome 25 dye gamut
  (cpixip, Kinograph, 2025, using the E-55 spectral-dye-density curves) found the entire reproducible
  Kodachrome gamut **fits _inside_ sRGB** — several ColorChecker patches (blues, cyans, yellow-oranges)
  were _outside_ what Kodachrome could reproduce. So **global mega-saturation is wrong.** The
  "Velvia/neon" film is **E100VS / Elite Extra Color**, _not_ Kodachrome. [MEASURED — Kinograph
  reconstruction]
- It is NOT a uniform orange/warm wash → that kills the cool shadows. The look is a **crossover**.
- It is NOT "teal & orange." Greens go **slightly dark and muted**, not teal.
- It is NOT grainy (25/64). Don't over-grain.
- Contrast is not a flat global boost — it's **shadow-weighted** with dense blacks and rich (not
  blown) highlights.

### 1c. Documented color science

- **Kodachrome 25 spectral-sensitivity mean wavelengths: B = 444.3 nm, G = 554.8 nm, R = 632.0 nm**
  (red layer peaks ~650 nm; the human eye's red cone peaks ~580 nm and is <20% by 650 nm). [MEASURED —
  Wetherill, from Kodak Pub. E-77, 1980]
- **Colorimetric quality factor q** (0–1, how well a channel matches eye cone combinations), K-25
  Daylight under D55: **B q = 0.803, G q = 0.867, R q = 0.475.** The low red q is _the_ color-science
  reason reds/oranges are rendered shifted-redder and more saturated than "accurate." [MEASURED —
  Wetherill]
- Blue sky recorded ~¼ stop darker → more cyan dye in sky/shadow → slight hue shift toward the cyan
  dye in those regions. [MEASURED reasoning — Wetherill]
- Narrow-band cyan dye with low-side peak → reduced inter-dye overlap → vivid greens/blues +
  pure reds, but **greens print/scan too dark with hue changes**; Kodachrome's cyan was famously
  incompatible with E-6-optimized papers and scanners (greens/blues go dark). [DOCUMENTED-QUAL —
  Wetherill + Photrio]
- Flesh tones: Kodachrome rendered skin slightly less "rosy" than Ektachrome (Ektachrome was tuned
  warmer/rosier for portraits). [DOCUMENTED-QUAL — Wetherill]
- Push (K200 only): "color balance shifts in the **magenta-red** direction." [MEASURED — E-88]

### 1d. Implementable recipe — KODACHROME 64 (priority hero)

Operate tone curves & casts in **sRGB-gamma space (0–1 on the byte value /255)**; do channel
gains/matrix and saturation in **linear**. All numbers below [ESTIMATED] unless tagged — they
reproduce the documented behavior, tune to taste.

```
# --- 1. Channel gain (LINEAR), gentle warm midtone bias ---
R *= 1.05
G *= 1.00
B *= 0.95        # warms overall; the cool comes back via the shadow split below

# --- 2. Optional 3x3 saturation/cross-talk matrix (LINEAR), mild ---
#   keeps reds pure, lets greens darken slightly. Identity-ish, small off-diagonals:
[ 1.08  -0.05  -0.03
 -0.04   1.04   0.00
 -0.02  -0.06   1.08 ]   # row-sums ~1.0 to preserve neutrals

# --- 3. Per-channel tone curves (sRGB space, control points (in -> out), 0..1) ---
# Master contrast S-curve, SHADOW-WEIGHTED, deep blacks, controlled highlights:
#   apply same shape to all three as a base, then the per-channel cast offsets below.
BASE_S:  (0.00,0.00) (0.06,0.030) (0.22,0.165) (0.50,0.520) (0.78,0.840) (0.93,0.960) (1.00,1.00)
#   -> blacks crushed (0.06->0.03), mids lifted, near-white compressed = slide punch

# Crossover: COOL shadows / WARM highlights (the Kodachrome signature)
R curve: BASE_S, then  shadow point (0.18 -> 0.165)   highlight point (0.85 -> 0.875)
G curve: BASE_S  (unchanged)
B curve: BASE_S, then  shadow point (0.18 -> 0.205)   highlight point (0.85 -> 0.825)
#   net: dark quartertones pick up blue/cyan; highlights pick up warm/yellow

# --- 4. Saturation ---
global_saturation = +10%        # modest, NOT heavy (gamut fits inside sRGB)
per-hue:
  reds/oranges (hue ~  0-40 deg):  saturation +22%, value -3%   # NatGeo red, deepened
  yellows      (hue ~ 45-70 deg):  saturation +8%
  greens       (hue ~ 80-160 deg): saturation +6%, value -6%, hue -4deg (toward yellow-green, darker)
  blues/cyans  (hue ~180-250 deg): saturation +12%, value -4%   # deep skies
  skin protect: limit red-sat boost where hue 20-35 & sat already low (avoid orange skin)

# --- 5. Grain (seeded) --- RMS 10 = fine
grain_amount ~ 0.06 (on 0..1), monochromatic-ish, slightly stronger in midtones, fine kernel (1px)

# --- 6. Halation (optional) --- Kodachrome had LOW halation; keep subtle
halation: red-orange, threshold high (only speculars/bright reds), radius small, strength 0.10
```

### 1e. KODACHROME 25 (variant)

Same signature, **gentler**: it was the finest-grain, most delicate-gradation Kodachrome.

- Grain RMS **9** [MEASURED] → grain_amount ~0.05.
- Slightly **lower** contrast: soften BASE_S near blacks (0.06 -> 0.035), shoulder a hair gentler.
- Saturation: global +8%, red boost +18% (a touch less punch than 64).
- Same cool-shadow/warm-highlight crossover, slightly reduced magnitude.

### 1f. KODACHROME 200 (variant)

The "available-light" Kodachrome — same DNA, **grainier and a touch muted/warmer**.

- Grain RMS **16** [MEASURED] → grain_amount ~0.13, slightly chromatic.
- Saturation ~5–8% lower than K64 overall (reds still lead).
- Push tendency = **magenta-red** shift [MEASURED]; for a "pushed" sub-variant add R \*=1.03, slight
  magenta in mids (G shadow point -0.01).
- Contrast similar to K64 or marginally higher in low light; keep deep blacks.

---

## 2. EKTACHROME — the clean, neutral E-6 counterpart

### 2a. Identity

- **Process E-6.** Color reversal / positive. Daylight-balanced. The standard "modern slide" dye set
  (compatible with E-6 papers/scanners — the opposite of Kodachrome's quirky cyan). [MEASURED]
- Iconic for **cool, clean neutrality**: accurate-to-slightly-cool whites, faithful skies/greens,
  pleasing skin. The "Ektachrome blue" (clean, slightly cool blues/cyans) is its counterpoint to the
  "Kodachrome red." [DOCUMENTED-QUAL]

### 2b. EKTACHROME E100 (current film, 2018–) — the reference

Datasheet (Pub. E-4000): "**extremely fine grain (RMS 8)**, a **low D-min for whiter, brighter
whites**, **moderately enhanced color saturation** with a **neutral color balance** and a **low
contrast tone scale**… matched color records for a neutral tone scale, pleasing natural skin tones,
consistent gray-scale rendition, dark-storage stability ≥80 yrs." [MEASURED — all from E-4000]

**Essence:** cleaner, cooler, flatter and more accurate than Kodachrome. Whites go truly white
(low D-min), shadows stay more open (low contrast tone scale), saturation is _moderately_ up not
wild, balance neutral with at most a faint cool/cyan-green lean. **No strong crossover.**

#### Implementable recipe — E100

```
# 1. Channel gain (LINEAR): near-neutral, faintly cool
R *= 0.99 ; G *= 1.00 ; B *= 1.02

# 2. Tone curve (sRGB) — GENTLE S, OPEN shadows, CLEAN whites (low D-min)
BASE_E:  (0.00,0.00) (0.08,0.060) (0.25,0.235) (0.5,0.515) (0.75,0.785) (0.92,0.955) (1.00,1.00)
#   blacks only lightly deepened; highlights lifted toward clean white (whiter whites)
#   slight white-point: map (0.95 -> 0.975) to brighten near-whites without clipping detail

# 3. Crossover: minimal. Optional faint cool shadow:
B shadow point (0.18 -> 0.195) ; R highlight neutral. Keep skin neutral.

# 4. Saturation: global +9%; gentle per-hue:
   blues/cyans +12% (clean Ektachrome sky), greens +8% (faithful, NOT darkened like Kodachrome),
   reds +8% (restrained), skin protected/neutral.

# 5. Grain RMS 8 -> grain_amount ~0.045 (extremely fine)
# 6. Halation: essentially none / optional faint neutral, strength <=0.06
```

### 2c. EKTACHROME E100VS & ELITE CHROME EXTRA COLOR (EBX) — the SATURATED E-6

- **E100VS** (Pub. E-4024-era): "the **most vivid, saturated ('VS') colors** available in a 100-speed
  film, via Kodak's proprietary **Color Amplifying Technology**, achieved while maintaining a
  **neutral gray scale**." RMS **11**. For "nature, scenics, food, jewelry… brilliant dramatic hues."
  [MEASURED — E100VS datasheet]
- **Elite Chrome Extra Color 100 (EBX)** = the **consumer version of E100VS**: "more contrast and a
  lot of saturation," slight 3D pop. [DOCUMENTED-QUAL — photo.net + Kodak E-126E]
- This is the **Velvia-competitor** and the film most "Kodachrome" presets are _actually_ imitating
  by accident (the neon one).

#### Implementable recipe — E100VS / EBX

```
# Neutral balance (NOT a crossover): R*=1.00 G*=1.00 B*=1.00 (keep gray neutral)
# Higher-contrast S (more than E100, less shadow-weighting than Kodachrome):
BASE_VS: (0,0) (0.07,0.045) (0.25,0.205) (0.5,0.515) (0.75,0.815) (0.93,0.965) (1,1)
# Saturation is the headline:
   global +30%  (EBX: +35% and steeper curve)
   blues/greens +35% (vivid skies & foliage), reds +28%, yellows +25%
   watch skin: clamp red/orange sat to avoid sunburn
# Grain RMS 11 -> grain_amount ~0.07
```

### 2d. E100G / E100GX & ELITE CHROME 100 (standard, ED) — brief

- **E100G**: ultra-fine (RMS 8), **neutral** ("G" = neutral gray), lower saturation than VS, very
  natural — essentially the modern-but-discontinued sibling of E100. **E100GX** = same but tuned
  **slightly warm**. [MEASURED / DOCUMENTED-QUAL]
- **Elite Chrome 100 (ED)** = consumer E-6 all-rounder: moderate saturation, faint warm lean, decent
  skin. Recipe ≈ E100 with global sat +12% and R\*=1.01. [DOCUMENTED-QUAL]

---

## 3. Quick contrast table (engine starting points, all tuning [ESTIMATED])

| Stock           | Balance                | Contrast / S-curve                     | Global sat  | Hero hue                    | Crossover                        | Grain (0–1) |
| --------------- | ---------------------- | -------------------------------------- | ----------- | --------------------------- | -------------------------------- | ----------- |
| Kodachrome 64   | warm mid               | strong, shadow-weighted, deep blacks   | +10%        | deep RED/orange             | **cool shadow / warm highlight** | 0.06        |
| Kodachrome 25   | warm mid               | strong (gentler)                       | +8%         | red                         | cool/warm (mild)                 | 0.05        |
| Kodachrome 200  | warm, muted            | strong                                 | +5%         | red (magenta push)          | cool/warm                        | 0.13        |
| Ektachrome E100 | neutral-cool           | **gentle**, open shadows, clean whites | +9%         | clean blue                  | minimal                          | 0.045       |
| E100VS / EBX    | neutral                | high                                   | **+30–35%** | everything (blue+green+red) | none                             | 0.07        |
| E100G / GX      | neutral / warm-neutral | moderate                               | +10%        | none                        | none                             | 0.045       |

---

## 4. Free / openly-licensed LUTs & Hald CLUTs we could optionally ship

> **Trademark note:** "Kodachrome" and "Ektachrome" are Kodak / Kodak Alaris trademarks. Descriptive
> emulation use ("Kodachrome-style") is generally fine, but avoid branding a shipped preset as the
> bare trademark in a commercial product without legal sign-off. Several repos below carry an explicit
> "LUTs may be subject to others' trademarks — use at own risk" disclaimer.

- **RawTherapee Film Simulation Collection** — the canonical free HaldCLUT pack; includes
  Kodachrome 25/64/200 and multiple Ektachrome HaldCLUTs (derived originally from Pat David's
  G'MIC film-emulation work). Freely downloadable from RawPedia. Widely redistributed; **verify the
  per-file license before commercial bundling** (the collection's terms have historically been
  permissive/CC-ish but are not uniformly stated). Best _quality_ free option.
  http://rawpedia.rawtherapee.com/Film_Simulation [DOCUMENTED]
- **github.com/cedeber/hald-clut** — bundles the RawTherapee Film Simulation set + PictureFX v2 +
  Fuji sims as ready HaldCLUT PNGs. **Repo license: GPL-3.0** (copyleft — fine for a GPL/AGPL app, a
  consideration for closed-source). Includes a `convert.sh` to make identity CLUTs. [MEASURED — repo
  LICENSE = GPL-3.0]
- **github.com/YahiaAngelo/Film-Luts** ("G'MIC Film LUTs Collection") — film LUTs incl. Kodak stocks.
  **Repo license: MIT** (permissive — allows commercial use w/ notice) **BUT** carries an explicit
  disclaimer that individual LUTs "might be subject to copyrights and trademarks of their respective
  owners." So the _wrapper_ is MIT; the _content_ provenance is G'MIC. Safe-ish but diligence needed.
  [MEASURED — repo LICENSE = MIT + disclaimer]
- **PictureFX (digicrea.be) — incl. "Ektachrome 1966 E4" .cube / Darktable LUT** — "Open Source
  Photography" releases by Marc R.; distributed free (PictureFX v2 series). Good for an _Ektachrome_
  preset specifically. Check the specific CC/open license on the download page before shipping.
  https://marcrphoto.wordpress.com/2024/01/15/picturefx-ektachrome-1966-e4-lut/ [DOCUMENTED]

**Recommendation:** for imager2 we should ship our own parametric recipes (Section 1–3) as the
primary path — they're tunable, dependency-free, and dodge the trademark/provenance question. Keep a
RawTherapee/PictureFX HaldCLUT around only as a _reference target_ to A/B our curves against, not as a
shipped asset unless license is confirmed.

---

## 5. Sources (URLs)

- Kodak Pub. **E-88**, _Kodachrome 64 & 200 Films_ (datasheet, RMS 10/16, K-14, push=magenta-red):
  https://125px.com/docs/film/kodak/e88-2005_09.pdf [MEASURED]
- Kodak Pub. **E-55**, _Kodachrome 25/64/200 Professional_ (RMS 9 for K25):
  https://125px.com/docs/film/kodak/e55-2009_06.pdf [MEASURED]
- Kodak Pub. **E-4000**, _EKTACHROME E100_ (RMS 8, low D-min, low contrast, moderate sat, neutral):
  https://business.kodakmoments.com/sites/default/files/files/products/e4000_ektachrome_100.pdf [MEASURED]
- Kodak, _EKTACHROME E100VS_ datasheet (RMS 11, Color Amplifying Tech, most vivid 100-speed):
  https://www.mr-alvandi.com/downloads/film-and-processing/kodak-professional-E100VS.pdf [MEASURED]
- Kodak Pub. **E-126E**, _Elite Chrome Extra Color 100_ (EBX):
  https://filmcolors.org/wp-content/uploads/2025/12/Kodak_Professional-Elite-Chrome-Extra-Color-100-Film_E-126E.pdf [MEASURED]
- Kodak Pub. **E-77** color films data book (1980; source of Kodachrome 25 curves):
  https://www.photomemorabilia.co.uk/Colour_Darkroom/MFisher/Kodak_%20Color_Films_E77_DataBook_Sep1980.pdf [MEASURED]
- Chris Wetherill (VISNS), _How Good Was Kodachrome? A Colorimetric Analysis_ (mean wavelengths, q
  factors, red-channel/sky/cyan reasoning):
  https://visns.neocities.org/4x5LFphotography/HGWK [MEASURED analysis]
- Kinograph Forums, _Kodachrome Colors_ (cpixip reconstruction of K25 dye gamut → fits inside sRGB):
  https://forums.kinograph.cc/t/kodachrome-colors/2863 [MEASURED reconstruction]
- Photrio, _How Kodachrome Narrow Band Cyan Dye helped … garish colors_ (narrow cyan, low-side peak,
  reduced overlap → distinctive look):
  https://www.photrio.com/forum/threads/...110837/ [DOCUMENTED-QUAL — expert forum]
- Practitioner recipes corroborating cool-shadow/warm crossover & restraint:
  veresdenialex Kodachrome-64 recipe; r/photography K64 thread. [DOCUMENTED-QUAL]
- LUT licenses: cedeber/hald-clut (GPL-3.0), YahiaAngelo/Film-Luts (MIT + disclaimer),
  RawPedia Film_Simulation, PictureFX (links in §4). [MEASURED repo licenses]
