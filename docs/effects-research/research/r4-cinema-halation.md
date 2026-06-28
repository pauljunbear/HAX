# R4 — Cinema Film Stocks + The Physics of Halation

Research for HAX / imager2 film-emulation effects. Engine assumptions: 8-bit sRGB byte buffers; cheap linear via `SRGB_TO_LINEAR` LUT (byte→0..1 linear) and `linearToSrgbByte`; 3×3 color matrices; per-channel tone curves (256-entry LUTs); seeded grain; separable `gaussianBlurLinear(buffer, sigma)` available.

Confidence tags: **MEASURED** = from manufacturer datasheet / physics. **ESTIMATED** = art-directed value grounded in documented behavior but not a measured constant. Treat every concrete RGB/curve number below as **ESTIMATED** unless tagged MEASURED — datasheets give curves as plots, not closed-form numbers, so the tone curves are fits, not transcriptions.

---

## PART 1 — HALATION PHYSICS (the keystone — reused by every film effect)

### Why halation happens (MEASURED physics)

Color film is a stack of emulsion layers over a clear base. Order from the lens inward: **blue-sensitive layer (top), then green, then red (deepest, nearest the base)**. Bright light fully penetrates the emulsion, exits the back of the base, **reflects off whatever is behind the film** (camera pressure plate / interior metal in a movie camera), and re-enters the emulsion from behind — a second, spread-out exposure around the bright source. (Dehancer; Lomography; mononodes)

Normally an **anti-halation layer** kills this. Two implementations:

- **Still film**: a dye/AHU layer between emulsion and base (or a dyed base) that absorbs the through-light.
- **Motion-picture film (Kodak Vision3)**: **remjet** — an opaque black carbon backing on the film base. Movie cameras can't use a black pressure plate (film must travel freely), so the remjet is the only thing stopping back-reflection. It's removed during ECN-2 processing. (Dehancer; Lomography)

**Cinestill** = Kodak Vision3 cine film with the **remjet stripped before spooling** so it runs in standard C-41. Removing remjet removes the anti-halation backing → light reflects off the camera pressure plate → the famous **red halo around highlights**. (myfavouritelens; thedarkroom; bluemooncamera)

### Why it's RED → ORANGE (MEASURED mechanism)

The back-reflected light has already passed through the emulsion once, so its **blue and green components are largely absorbed**; what survives and re-exposes is dominated by **red**, and the red layer is also physically closest to the reflecting back surface. → red halo. (Dehancer)

When the source is **very bright/overexposed**, enough energy survives to also re-expose the **green layer**, adding yellow → the halo shifts toward **orange at the hottest core, fading to red at the outer edge**. This radial hue gradient (orange center → red rim) is the single most authentic tell. The final on-screen hue also depends on the scene's white-balance/grade. (Dehancer; mononodes)

### Documented behavior to replicate (MEASURED tendencies)

- **Threshold-driven**: only bright sources/highlights halate; mid-tones get only a faint "global" red glaze.
- **Scales super-linearly with brightness**: brighter source → bigger, more orange halo. Incandescent/sodium bulbs halate strongly; LEDs barely (weak red content).
- **Visible mainly on the DARK side of a contrast edge** — the red is only distinguishable against a darker background (a window's halo shows on the wall, not in the sky). Cool/blue backgrounds suppress visibility.
- **Spread is relative to frame size**: halos look larger on 16mm than on 65mm. → in code, scale blur radius to image dimensions, never absolute px.
- **Halation rides with Bloom**: a tight tinted halation ring + a broader soft bloom almost always co-occur. Simulate as two summed blurs (tight core + wide glow). (Dehancer)

### THE CORRECT HALATION ALGORITHM (reusable across all stocks)

Everything happens in **LINEAR light** — this is the one non-negotiable. Light scatter is additive energy; blurring/screening in sRGB (gamma) makes the glow too dim, muddy, and hue-shifted. (Color.io / Dehancer / Darktable all isolate highlights, blur, tint red, and add/screen back.)

```
INPUT: sRGB bytes. PARAMS below.
1. LINEARIZE: lin[i] = SRGB_TO_LINEAR[byte]            // 0..1 linear RGB
2. LUMINANCE (linear Rec.709): Y = 0.2126R + 0.7152G + 0.0722B
3. HIGHLIGHT MASK with soft knee (avoid banding):
     e = smoothstep(T, T + knee, Y)        // T≈0.55, knee≈0.25 (linear)
     energy = pow(e, P)                     // P≈1.6 → super-linear brightness response
4. BUILD TINTED SOURCE buffer (per pixel), hue depends on energy (orange hot → red cool):
     tint = mix(RED, ORANGE, clamp(energy,0,1))
       RED    = (1.00, 0.07, 0.05)  // linear, outer rim
       ORANGE = (1.00, 0.32, 0.10)  // linear, hot core
     src.rgb = energy * tint        // optionally * Y to weight by actual highlight light
5. TWO-RADIUS BLUR in linear (separable gaussian), then sum:
     core  = gaussianBlurLinear(src, sigmaCore)   // sigmaCore ≈ 0.004 * maxDim
     bloom = gaussianBlurLinear(src, sigmaBloom)  // sigmaBloom ≈ 0.025 * maxDim
     halo  = coreWeight*core + bloomWeight*bloom  // 0.7, 0.45
6. RECOMBINE onto linear base (SCREEN = gentle, won't hard-clip):
     out = 1 - (1 - base) * (1 - halo * intensity)   // intensity ≈ 0.5
     // ADD (out = base + halo*intensity) for a punchier, clip-prone look
7. linearToSrgbByte(out)
```

**Concrete default params** (ESTIMATED, tuned to the physics above):
| param | value | notes |
|---|---|---|
| `T` (luminance threshold, linear) | **0.55** | ≈ sRGB byte ~196 (≈77%). Raise to 0.7 for "only the brightest" (sRGB ~219). |
| `knee` | 0.25 | soft shoulder so the mask doesn't band |
| `P` (energy exponent) | 1.6 | super-linear; bigger = halo confined to hottest spots |
| `RED` tint (linear) | (1.00, 0.07, 0.05) | outer halo; ~sRGB `#FF4030` |
| `ORANGE` tint (linear) | (1.00, 0.32, 0.10) | hot core; ~sRGB `#FF9A4D` |
| `sigmaCore` | 0.004 × maxDim | the crisp red ring (e.g. 8px @ 2000px) |
| `sigmaBloom` | 0.025 × maxDim | the soft wide glow (e.g. 50px @ 2000px) |
| `coreWeight / bloomWeight` | 0.7 / 0.45 | |
| `intensity` | 0.3 (subtle) – 0.8 (Cinestill-strong) | global dose |
| blend | **screen** | add = harsher |

**Falloff**: gaussian ≈ natural exponential rolloff; the tight+wide sum reproduces the real "sharp ring inside a soft glow." **Resolution independence**: sigmas are fractions of `maxDim`. **Optional realism**: gate the halo by "dark neighbor" (multiply halo by `1 - localBackgroundLuma`) so red only shows against dark backgrounds; and damp where background is blue. Skipping these is fine for a v1.

---

## PART 2 — THE STOCKS

### Kodak Vision3 500T / 5219 (the negative inside Cinestill 800T) — MEASURED from datasheet H-1-5219

- **Type/balance**: tungsten-balanced color negative, **3200K**. Process **ECN-2**.
- **Exposure index** (MEASURED, datasheet table): **EI 500 tungsten 3200K (no filter)**; **EI 320 in daylight 5500K with a WRATTEN 85 filter**. ±150K tungsten needs no correction.
- **Latitude / "cinematic" curve**: "extended highlight latitude," exposure scale 0→5 increments; long shoulder, lifted toe → the low-contrast, wide-DR negative look (~10+ stops in practice). Proprietary Dye Layering Technology = reduced shadow grain. (Kodak sell sheet)
- **Signature**: clean shadows, gentle gradation, holds highlight detail without harsh clipping; renders neutral under tungsten, **goes blue if shot in daylight uncorrected** (basis of the cool night look).

### Kodak Vision3 250D / 5207 — MEASURED from datasheet H-1-5207

- **Type/balance**: **daylight-balanced** color negative, **5500K**. Process ECN-2.
- **Exposure index** (MEASURED): **EI 250 daylight (no filter)**; **EI 64 tungsten 3200K with WRATTEN 80A**.
- **Latitude** (MEASURED, datasheet): 18% gray = "0"; white card +2⅓ stops; **≥3½ more stops above that for specular highlights**; 3% black at −2⅔; **≥2½ stops below for shadow** → ~10+ stops total, very gentle curve.
- **Signature**: fine grain, clean neutral daylight color, the everyday "cinematic daylight negative."

### Cinestill 800T — the priority look (MEASURED source + ESTIMATED recipe)

- **What it is**: Vision3 500T/5219 with remjet removed for C-41. Tungsten **3200K**, **EI 800** (rateable; push to 3200). ~10+ stop DR, fine grain for the speed. (myfavouritelens; daydreamfilm; kubusphoto)
- **Essence (the four tells)**: (1) **RED HALATION** around every bright point light — the defining feature; (2) **cool / tungsten-in-the-wild cast** — teal-blue shadows, since tungsten film under mixed night light skews cool; (3) warm sodium/incandescent **highlights** (split-tone with the cool shadows); (4) moderate-visible **grain** + lifted blacks (negative latitude).
- **Implementable recipe (ESTIMATED, grounded in datasheet balance + the documented look):**
  1. **WB toward tungsten/cool** — multiply linear RGB by gains then renormalize to preserve luma: `R*0.90, G*1.00, B*1.15`. (Documented fact: tungsten-balanced film shot in daylight goes blue; these gains emulate that.) As a 3×3: `diag(0.90,1.00,1.15)`.
  2. **Split-tone**: push **shadows toward teal** (add ~ (−6, +2, +8) in 8-bit to low end) and **highlights toward warm amber** (add ~ (+10, +4, −8) to high end) via per-channel curves.
  3. **Tone curve**: lift toe (+8–12/255 black point), soft shoulder, slight overall contrast reduction (negative film) — then a mild print-style contrast bump in mids.
  4. **HALATION**: run Part-1 algorithm at **intensity 0.6–0.8**, `T≈0.5` (halos around most light sources). This is the hero.
  5. **Grain**: seeded, moderate amount (ISO 800), luminance-weighted slightly toward shadows.
- Confidence: stock identity & balance **MEASURED**; specific gains/curves **ESTIMATED**.

### Cinestill 50D — MEASURED source + ESTIMATED recipe

- **What it is**: Vision3 50D / 5203 with remjet removed. **Daylight 5500K, EI 50**, exceptionally fine grain, **pastel palette**, wide latitude. **Least halation of the Cinestill line** (daylight scenes have fewer dark backgrounds to show red halos against, and low speed). (bluemooncamera; thedarkroom; analog.cafe)
- **Recipe (ESTIMATED)**: neutral WB (no cast); **very fine** seeded grain; **lowered saturation (~ −15%) + pastel lift** (raise black point, gentle shoulder); soft low contrast; faint warm-highlight tint; **halation at very low intensity (~0.15–0.25), high threshold T≈0.7** so only true speculars glow faintly red.

---

## PART 3 — CROSS-PROCESSING (documented shifts)

Two directions; the famous "xpro" look is **slide (E-6) developed in C-41**. (thedarkroom; kubusphoto; lomography)

- **E-6 slide → C-41 (the iconic look)**: **extreme contrast (+30–50%), blown highlights, crushed shadows**, heavy saturation, and a **color crossover cast** (shadows and highlights shift different directions). **Fuji stocks → green/cyan** (esp. shadows/mids, e.g. Provia); **Kodak stocks → warm yellow/red**. Surreal, bleached. (thedarkroom; kubusphoto)
- **C-41 negative → E-6 slide**: muddy, **flat/low-contrast, dull/desaturated**, weak colors — generally the less attractive direction.

**Cross-process essence + recipe (ESTIMATED, grounded in documented shifts):**

1. **Steep contrast S-curve**, hard shoulder (clip highlights to white), crushed toe.
2. **Saturation +30–50%**.
3. **Color crossover** (the signature): tint **shadows cyan-green**, **highlights yellow** (Fuji flavor) — e.g. per-channel: in shadows raise G & B (cyan-green), in highlights raise R & G / drop B (yellow). 3×3 global green/yellow bias e.g. `R[1.05, 0, 0; 0,1.08,0; 0,0,0.92]` then re-clip.
4. Optional global green cast `+(−2,+8,−4)`/255 in mids. For a "Kodak xpro" variant, swap the crossover to warm: yellow-red highlights, magenta shadows.

---

## FREELY-AVAILABLE LUTs (verify license before shipping)

- **Lutmix — Cinestill 800T free LUTs** (.cube, 4 looks): https://www.lutmix.com/downloads/cinestill-800t-free-luts/ — free download; **license terms not explicitly stated on page → confirm before redistribution.**
- **CineColor — "Vision LUT" free** (Kodak Vision-inspired, .cube): https://cinecolor.io/products/vision-lut-free-download — free; check EULA.
- **Tom Majerski — free VisionT (Vision3 500T) emulation LUT** (via Jonny Elwyn roundup): https://jonnyelwyn.co.uk/film-and-video-editing/free-film-luts-for-editors-dits-and-colorists/
- **Juan Melara — free print-film emulation LUTs** (Kodak 2383 / 2393, Fuji 3510 — the _print_ stage, pairs well after a negative curve): https://juanmelara.com.au/blog/print-film-emulation-luts-for-download
- Note: none are confirmed Creative-Commons; most are "free to download/use" without a formal license. For a shipped product, prefer building the look from the parametric recipes above (no license risk) and use LUTs only as visual reference.

---

## SOURCES

- Halation physics: https://blog.dehancer.com/articles/halation/ · https://mononodes.com/a-study-on-halation/ · https://www.lomography.com/magazine/352787-what-is-the-anti-halation-layer · https://en.wikipedia.org/wiki/Anti-halation_backing
- Halation simulation method: https://www.color.io/user-guide/film-halation · https://nishchalb.github.io/posts/dt_halation/ (Darktable: isolate red channel + details threshold + diffuse/blur)
- Kodak Vision3 500T/5219 datasheet (H-1-5219): https://www.argentix.ca/specs/V3-5219-en.pdf · https://www.kodak.com/content/products-brochures/Film/VISION3_5219_7219_Technical-data.pdf
- Kodak Vision3 250D/5207 datasheet (H-1-5207): https://www.argentix.ca/specs/V3-5207-en.pdf
- Cinestill 800T: https://www.myfavouritelens.com/cinestill-800t-35mm-film-review/ · https://www.daydreamfilm.app/blog/film-reviews/cinestill-800t-review · https://www.kubusphoto.com/blog/cinestill-800t-guide
- Cinestill 50D: https://bluemooncameracodex.com/film-fridays/ffcinestill50d · https://thedarkroom.com/film/cinestill-50d-50iso-color-film-review/ · https://www.analog.cafe/r/cinestill-50d-35mm-c-41-film-review-l0tw
- Cross-processing: https://thedarkroom.com/cross-processing-film/ · https://www.kubusphoto.com/blog/cross-processing-explained · https://en.wikipedia.org/wiki/C-41_process
