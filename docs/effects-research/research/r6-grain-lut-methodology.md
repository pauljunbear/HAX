# R6 — Film Grain & Film LUT Methodology (for a pure-CPU JS image editor)

Research target: the _correct_ way to (A) model film grain and (B) build/source film LUTs, for a web image editor operating on 8-bit RGBA in JavaScript on the CPU, with a seeded PRNG (mulberry32) available. Emphasis on physically-grounded models, Kodak's own granularity definition, and shippable open-source resources with verified licenses.

Primary sources are cited inline. The two anchor documents:

- **Newson, Faraj, Delon, Galerne — "Realistic Film Grain Rendering," IPOL Journal 7 (2017) 165–183.** https://www.ipol.im/pub/art/2017/192/ (full PDF read for this report). The reference physically-based grain model.
- **Tim Vitale — "Film Grain, Resolution and Fundamental Film Particles," v24 (2010).** https://cool.culturalheritage.org/videopreservation/library/film_grain_resolution_and_perception_v24.pdf — quotes Kodak H-1 (1999) and F-5 (1998); the RMS-granularity definition + Table 3 of stock values.

---

## A. Film grain — the real model (the important part)

### A.1 Why per-pixel `Math.random()` uniform white noise is WRONG

A naive `pixel += (Math.random()-0.5)*amt` per channel fails on **every** axis that defines film grain:

1. **No spatial structure / no grain size.** Real grain is _spatially correlated_: silver-halide crystals / dye clouds have a physical size (B&W silver particles ≈ 0.2–2.0 µm; **color dye clouds ≈ 1.0–6 µm, up to 10 µm in clumps** — Vitale/Kodak H-1), and they _clump_. Clumping/agglomeration "is an essential visual feature of graininess" (Newson §2). Per-pixel noise has a flat (white) power spectrum and zero correlation length → it reads as digital sensor noise / TV static, not grain. Grain has a low-pass / band-pass spectrum (a "grain size").
2. **Wrong tonal dependence (equal in all tones).** White noise has constant variance everywhere. Film grain variance is **tone-dependent and peaks in the midtones**. Kodak F-5 (1998), quoted in Vitale p.442, verbatim: _"Large, even-toned areas in the mid-tones of a photograph will appear more grainy than dark- or light-toned areas or areas that include fine detail."_ The Newson Boolean model reproduces this automatically (see A.4) — the variance of the binary grain indicator is `ũ·(1−ũ)`, maximal at mid-gray.
3. **Wrong distribution & wrong coupling.** Grain arises from _counting statistics_ of discrete grains in a finite area → Poisson/binomial, well-approximated by a Gaussian whose **variance scales with local density**, not a fixed uniform. And in color film, grain is **not** three independent equal-power RGB white-noise fields (see A.3).
4. **Unseeded → preview ≠ export.** `Math.random()` is unseeded and non-reproducible, so a low-res preview and the full-res export get _different_ grain, and re-renders flicker. Grain must be driven by a **seeded** PRNG (mulberry32) keyed off pixel coordinates (+ a user seed), so the same coordinate always yields the same grain at any resolution/crop.

### A.2 What real grain actually is (physical behavior to reproduce)

- **B&W: monochromatic luminance/density noise.** A single emulsion of silver grains → one channel of density fluctuation. Apply as a single luminance perturbation, identical on R=G=B.
- **Color: three layers grain semi-independently, but luminance dominates perceptually.** Modern color film has up to 9 sub-layers (3 per dye: a slow/fine, normal, and fast/coarse layer — Vitale p.339). Each dye layer (Y/M/C) has its own grain. _But_ at the spatial scale of grain the eye is achromatic: Kodak H-1 (1999), via Vitale p.~9: _"close to its resolution limit … the eye sees only brightness differences and does not distinguish color in very small detail … 'dye-cloud clusters' form groups similar to 'silver-grain clusters'."_ ⇒ model grain as **mostly luminance** with a **small, optional, independent per-channel chroma component** (chroma grain visible mainly in shadows of fast color neg / cross-processed looks).
- **Magnitude depends on DENSITY.** For a **negative**, grain is most visible at **mid-to-high density** (Kodak: "High density … also increases graininess"). High negative density = the bright/exposed regions of the scene, which after printing/inversion become the **midtones→shadows of the positive**. Net perceptual result on the final positive image: grain peaks in **midtones**, tapers in extreme highlights and deep blacks. Use a midtone-weighted response curve (A.5).
- **Grain has a SIZE (spatial correlation).** You must either (a) generate noise at a coarser scale and upsample (value/Perlin noise), or (b) generate white noise then low-pass filter it. Newson models the observed grain as the binary grain field convolved with a **Gaussian kernel of std σ** (the "filtered Boolean model," eq. 3) — σ is literally the grain blur/size in output-pixel units.
- **Distribution is Gaussian/Poisson.** Number of grains in a cell ~ Poisson(λ); coverage indicator is Bernoulli; the filtered sum over many grains → approximately Gaussian by CLT, with **signal-dependent variance**.

### A.3 The reference model — Newson et al. inhomogeneous Boolean model (IPOL 2017)

This is the gold standard; understand it even though we'll ship a cheaper approximation.

- **Grain field = inhomogeneous Boolean model**: union of random disks. Centers are a Poisson point process with _local_ intensity λ(y); radii rᵢ are i.i.d. (constant, or **log-normal** with mean µ_r, variance σ_r²).
- **Local intensity from the image gray-level.** Normalize input `ũ(y) = u(y)/(u_max+ε) ∈ [0,1)`. Probability a point is covered by a grain is `P = 1 − exp(−λ·E[πr²])` (eq. 1). Set this equal to ũ ⇒
  ```
  λ(y) = (1 / (π(µ_r² + σ_r²))) · log( 1 / (1 − ũ(y)) )      (eq. 2)
  ```
  So darker target areas → fewer grains, brighter → more. (Conventions can be inverted for negative vs positive; what matters is the _coverage = ũ_ relationship.)
- **Filtering = observed grain.** Output `v(y) = (φ_σ ∗ 1_Z)(y)` (eq. 3): convolve the binary grain set with a Gaussian of std σ (output-pixel units). σ controls perceived grain size/softness.
- **Evaluation = Monte Carlo.** Each output pixel is averaged over **N** samples ξ_k ~ N(0, σ²I) of the (binary) Boolean model. Two implementations (grain-wise vs pixel-wise); the code auto-picks the faster one by µ_r and σ_r/µ_r.
- **Parameters (the whole model):** `µ_r` (mean grain radius, in input-pixel units), `σ_r` (radius std; log-normal), `σ` (Gaussian filter std = grain size at output res), `N` (MC iterations, e.g. 200–800). Renders at **any zoom** because the model is continuous.

**Why the variance peaks in midtones (the key emergent property):** coverage probability = ũ, so the binary field has Bernoulli variance `ũ(1−ũ)`, maximized at ũ=0.5. After Gaussian filtering this becomes the observed grain power → **maximal in midtones, →0 at pure black/white.** This is exactly the Kodak observation, falling out of the physics for free. Any shipped approximation should preserve this `ũ(1−ũ)`-like envelope.

**Why we don't ship Newson directly:** Monte-Carlo (N samples × Poisson grain generation) per output pixel is far too heavy for interactive pure-CPU JS on multi-MP images. We ship an approximation that _keeps the four properties that matter_ (spatial correlation/size, midtone-peaked variance, Gaussian distribution, seeded reproducibility) at ~1–2 passes over the pixels.

### A.4 RMS granularity — Kodak's own definition (for an "ISO/grain" UI mapping)

- **Definition (Kodak / ISO 10505):** RMS granularity = the **root-mean-square (standard deviation) of optical-density fluctuations** in a uniformly-exposed patch, measured with a **microdensitometer through a 48 µm diameter circular aperture**, on film developed to a **mean density of 1.0 D** (Vitale pp. 10–11, citing Kodak H-1; Wikipedia "Film grain").
- **Reporting convention:** quoted as **diffuse RMS granularity × 1000**. So "granularity 10" ⇒ an RMS density fluctuation of **σ_D = 0.010** at D=1.0 through a 48 µm aperture. (VU/Wikipedia.)
- **Typical published values (Vitale Table 3 + text):**
  - Color **negative** can be as low as **5** (≈ as clean as film gets); but the _printed_ system is grainier (neg grain + print grain combine).
  - Kodak slide ≈ **8–13**; Fuji reversal ≈ **7–10**.
  - Examples: Kodachrome 25 = 9, Kodachrome 64 = 10, Ektachrome 100 = 11, Ektachrome 160 = 13, **Fuji Velvia 50 = 8**, Provia 100F = 9, Ektachrome 100GX = 8.
  - Rule of thumb: **faster film ⇒ grainier** (bigger crystals = more sensitive but coarser), _except_ Kodak T-Grain (T-Max) stocks which beat their speed class.
- **Mapping to a UI "ISO/grain" slider:** expose intensity as a target σ_D and convert to your working-space amplitude.
  - Aperture-scaling caveat: RMS granularity is defined at a _fixed 48 µm aperture_; measured σ scales ≈ `1/√(aperture area)` (Selwyn's law: `σ·√area = const`). So to "hit" a published number you must also fix an effective on-screen grain size. Practically: let the UI map **ISO 50→σ_D≈0.008, ISO 100→0.010, ISO 400→~0.018, ISO 1600→~0.03–0.04, ISO 3200+→0.05+** at a reference grain size, and let the **grain-size** control set the correlation length. This is an _approximate calibration_, honest to the spec's shape, not a metrologically exact match (the spec is aperture- and density-specific).

### A.5 CONCRETE seeded algorithm for our CPU/JS engine (recommended)

Design goals: one or two linear passes over the RGBA buffer, mulberry32-seeded (preview == export), spatial correlation (grain size), midtone-peaked tone response, mostly-luminance with optional chroma, Gaussian-ish distribution. This is a **"value-noise scaled by a tonal-variance curve, applied as luminance"** model — the practical distillation of Newson that keeps its emergent properties.

**Working space:** operate on **gamma/display-encoded values normalized to [0,1]** (i.e., straight from 8-bit /255). Reason: the midtone-peaked envelope `t(1−t)` is defined in _display_ tones, which is what matches the Kodak "midtones look grainiest" observation and what users see. (If your pipeline is linear-light, convert the _response weight_ via the display value, not the linear value, or you'll push the peak into the highlights.) Add grain **before** any final output quantization; if you also apply a film LUT, apply **grain after the tone/LUT** so its tonal response matches the final look (or before, if emulating the negative — document the choice; "grain after look" is the safe default for a stills editor).

**Step 1 — Seeded value noise at grain scale (gives spatial correlation = grain size).**

- Pick `grainSize` in px (correlation length). Generate noise on a coarse lattice of spacing `s = grainSize` and **bilinearly (or smoothstep) interpolate** up to full res. Lattice values come from a hash of integer lattice coords + user `seed` → mulberry32 → one Gaussian sample (Box–Muller or sum-of-12-uniforms). This is deterministic per (lattice node, seed): preview and export match exactly, and it's resolution-independent if you key the lattice in _image_ coordinates.
- For a more film-like band-pass spectrum, sum 2 octaves: `n = 0.8*value(s) + 0.2*value(s/2)` (a touch of fine structure over the dominant clump size). Normalize so `Var(n) ≈ 1`.
- Cheap PRNG/hash (per lattice node):
  ```js
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function nodeRand(ix, iy, seed) {
    // hash coords→seed→one uniform
    let h = (ix * 374761393 + iy * 668265263) ^ (seed * 2246822519);
    h = (h ^ (h >>> 13)) >>> 0;
    return mulberry32(h)();
  }
  // Gaussian via two uniforms (Box–Muller), or approx by (sum of 3 uniforms - 1.5)
  ```

**Step 2 — Tonal response (midtone-peaked variance envelope).**

- For each pixel compute display luminance `Y = 0.299R+0.587G+0.114B` (or Rec.709 0.2126/0.7152/0.0722), normalized [0,1].
- Base envelope from the Boolean model: `w_base(Y) = sqrt(Y*(1−Y)) * 2` (so peak≈1 at Y=0.5). This reproduces Newson's `ũ(1−ũ)` variance — grain dies at pure black/white, peaks mid.
- Apply **user shadow/mid/highlight weights** to reshape: `w(Y) = w_base(Y) * (wShadow*S(Y) + wMid*M(Y) + wHigh*H(Y))` where S/M/H are smooth bumps centered ~0.2/0.5/0.8. Defaults `wShadow=0.6, wMid=1.0, wHigh=0.5` (film: a bit more grain into shadows than highlights). Many emulations also lift shadow grain specifically (push/fast-film look) → expose `shadowGrain`.

**Step 3 — Compose and apply (luminance + optional chroma).**

```
amp      = intensity                      // master, maps from ISO/grain (A.4)
gLum     = n_lum(x,y) * w(Y) * amp        // shared luminance grain (R=G=B add)
// optional independent chroma grain (small):
gR = gLum + colorAmount * n_R(x,y) * w(Y) * amp
gG = gLum + colorAmount * n_G(x,y) * w(Y) * amp
gB = gLum + colorAmount * n_B(x,y) * w(Y) * amp
R' = clamp(R + gR);  G' = clamp(G + gG);  B' = clamp(B + gB)
```

- `n_lum`, `n_R/G/B` are independent seeded noise fields (offset the hash seed per field). With `colorAmount=0` you get pure B&W-style luminance grain (correct default for most looks). `colorAmount ≈ 0.1–0.3` adds the semi-independent layer grain for color-neg/shadow chroma.
- **Distribution:** because Step 1 uses Gaussian lattice samples, the result is Gaussian with std `= w(Y)*amp` — i.e. signal-dependent variance, the Poisson/Gaussian behavior we wanted. (For a more authentic skew you can use Poisson at very high amp, but Gaussian is indistinguishable at normal strengths.)
- **Monochrome multiplicative option:** film grain is closer to _multiplicative in density_ than additive in light. A subtle upgrade: `R' = R * (1 + gLum_centered)` instead of `R + g`. Additive is fine and simpler; multiplicative slightly better preserves highlight integrity. Document which you pick.

**Parameter ranges → UI:**

| UI control           | Internal                   | Range                              | Default           | Notes                          |
| -------------------- | -------------------------- | ---------------------------------- | ----------------- | ------------------------------ |
| Grain amount / "ISO" | `intensity` (→σ_D)         | 0–0.06 of full-scale (ISO 50→3200) | ~0.012 (≈ISO 100) | map via A.4                    |
| Grain size           | `grainSize` (px @ ref res) | 1–6 px                             | 2 px              | correlation length / Newson σ  |
| Roughness            | octave mix                 | 0–0.4 fine                         | 0.2               | band-pass character            |
| Shadow grain         | `wShadow`                  | 0–1.5                              | 0.6               | push/fast-film look            |
| Midtone grain        | `wMid`                     | 0–1.5                              | 1.0               | dominant                       |
| Highlight grain      | `wHigh`                    | 0–1.0                              | 0.5               | usually subtle                 |
| Color grain          | `colorAmount`              | 0–0.5                              | 0.0               | 0 = mono (recommended default) |
| Seed                 | `seed`                     | int                                | per-document      | preview==export                |

**Performance:** Step 1 lattice + bilinear is a handful of ops/px; whole thing is ~15–30 ops/px → a 12 MP image is tens of ms single-threaded, trivially tileable to Web Workers. Cache the coarse lattice; regenerate only when seed/size changes.

**Validation hooks (close the loop):** (1) render a flat 50% gray patch, measure output σ → confirm it tracks `intensity`; (2) render a black→white ramp, plot per-column σ → confirm the `Y(1−Y)` hump (peak at mid, ~0 at ends); (3) render at preview res and export res with same seed → confirm grain matches on overlap.

---

## B. How film LUTs / looks are actually built

### B.1 The datasheet pipeline (what defines a stock's color)

A film stock's color is the composition of a physically-ordered chain (sources: pixeltoolspost colorist guide; JanLohse/spectral_film_lut & ComfyUI-Darkroom methodology; Kodak datasheets):

1. **Spectral sensitivity → exposure.** Each emulsion layer (B/G/R-sensitive) integrates the scene spectrum against its own spectral sensitivity curve → three "log-exposure" values. (Cross-channel because real sensitivities overlap.)
2. **Characteristic curves (D–logE, the "H&D curve") per layer.** Density vs log-exposure, _separately for R/G/B_ (or Y/M/C dye). The **toe** (shadow shoulder-in) and **shoulder** (highlight roll-off) give film's graceful non-clipping latitude (~3½ stops over, ~2½ under). Different per-layer contrast/crossover is where color casts in shadows vs highlights come from. This is the single most important block of the "look."
3. **Inter-layer / color-coupler effects (crosstalk).** Layers chemically interact during development (DIR couplers, adjacency effects) → saturation rises with exposure, edge effects, and channel crosstalk a pure 1D curve can't express.
4. **Spectral dye density.** Developed dyes (C/M/Y) have real, impure absorption spectra → an inherent color matrix. Color-negative film adds the **orange mask** to cancel impure-dye absorption.
5. **Print / scan stage.** For a _print_ look, the negative's transmitted spectrum is re-exposed through a **print stock's** own spectral sensitivities + H&D curves (Kodak 2383/2393, Fuji 3510) — a _second_ full curve+dye stage that adds the final S-curve and color. For a _scan_ look, substitute the scanner's spectral response + its inversion/LUT.

**How this becomes a LUT or curves+matrix:** Run a dense RGB cube of input colors through the whole chain (sensitivity → expose → per-layer D–logE → dye spectra → print/scan) and **tabulate output RGB**. That sampled mapping _is_ the 3D LUT. Or, if you linearize and ignore crosstalk, you can factor it into **per-channel 1D curves (the H&D toe/shoulder) + a 3×3 dye/print matrix** — which captures most of the look but not the nonlinear cross-channel coupling.

### B.2 1D curves + matrix vs full 3D `.cube` — verdict for CPU JS

**The two representations:**

- **Per-channel 1D curves + 3×3 matrix (+ optional sat/HSL tweaks).** A "glass-box" decomposition (see ART/ComfyUI-Darkroom "parametric film emulation"). Captures: toe/shoulder contrast, channel crossover, overall color cast, saturation-with-exposure (approx). Misses: hue-specific twists, non-separable cross-channel coupling, gamut edges.
- **Full 3D LUT (`.cube`, IRIDAS/Adobe format).** Header `LUT_3D_SIZE N` then N³ float RGB triplets (R fastest), domain default [0,1]. Typical sizes **17³, 33³, 65³**. Captures _any_ smooth mapping including all crosstalk/hue twists. Cannot represent grain or spatial effects (it's a per-pixel color map only) — grain stays a separate pass (Section A).

**Can we run a 33³ `.cube` with trilinear interpolation per pixel in JS at reasonable speed? — YES.**

- Per-pixel cost: scale RGB into [0, N−1], floor to find the cell, fetch **8 corner triplets**, do **7 lerps × 3 channels** ≈ ~30 mults + ~24 adds + index math ≈ **~60–100 ops/px**.
- Throughput: a modern JS engine on typed arrays does on the order of 10⁸–10⁹ such ops/sec single-threaded. ⇒ **1 MP ≈ 60–150 ms; 12 MP ≈ 0.7–1.8 s** single-threaded. With Web Workers tiling across 4–8 cores → ~5–10× faster; trivially interactive for preview at reduced res, fine for full-res export.
- Optimizations: store the LUT as a flat `Float32Array` (or pre-quantized `Uint8`/`Int16` for integer-only lerps); precompute strides; for a _fast preview_ path you can even bake the 3D LUT into a per-pixel nearest or a 1D-per-channel approximation. Tetrahedral interpolation (4 corners) is ~30% cheaper than trilinear and slightly more accurate on the diagonal — worth it if you optimize.
- **1D curves+matrix is ~5–10× cheaper** (~10–15 ops/px) and authoring/tweaking is parametric (great for user-adjustable "film strength").

**Recommendation for our engine:**

- Ship **both, layered**: a **parametric 1D-curves + 3×3 matrix** core (fast, live-adjustable, the default "film" engine — toe/shoulder + color cast + sat), and a **33³ `.cube` trilinear** path for accurate per-stock emulation where the look needs cross-channel hue behavior. 33³ is the sweet spot (17³ shows banding on skin gradients; 65³ quadruples memory/cost for marginal gain). Always **dither** 8-bit LUT output (±0.5 LSB ordered/seeded noise — can reuse the grain PRNG) to avoid posterization. Keep grain as its own pass (A.5), applied after the look by default.

---

## C. Open-source / freely-licensed resources (with verified licenses)

Ranked by shippability. "Shippable" = permissive enough to bundle in a product; "Learn-only / copyleft" = study the method or use under share-alike with attribution, **not** clean to bake into a proprietary build.

### Shippable (permissive — MIT)

1. **JanLohse/spectral_film_lut** — https://github.com/JanLohse/spectral_film_lut — **MIT.** ✅ Best methodology + tool. A GUI/Python app that **generates film-emulation LUTs by digitizing datasheets** and running a multi-step spectral pipeline (negative + print + slide materials; Kodak/Fuji/Ilford; motion + still; color + B&W; can also emit a grain LUT). Generates LUTs you can export and ship; MIT covers the code and your generated outputs. _Caveat the authors state:_ accuracy limited by published-datasheet precision (poor for discontinued stocks). **Use as: our reference implementation of the B.1 pipeline, and a generator for stock LUTs.**

2. **jeremieLouvaert/ComfyUI-Darkroom** — https://github.com/jeremieLouvaert/ComfyUI-Darkroom — **MIT.** ✅ 161 film stocks (111 color with H&D characteristic curves, 50 B&W with spectral-sensitivity coefficients) + **35 pre-baked spectral negative→print `.cube` LUTs**; physics-based H&D curves + grain. Data sourced from parsing 586 Capture One `.costyle` files **and** published Kodak/Fuji/Ilford datasheets. **Caveat:** the _derivation_ from Capture One styles is a provenance/derivative-data gray area even though the repo is MIT — safest to lean on the **datasheet-derived curves and the parametric structure** (the "glass box") rather than reshipping `.costyle`-derived tables verbatim. Excellent as a **curve-data reference and a parametric-emulation blueprint** (matches our B.2 "curves+matrix" recommendation).

3. **YahiaAngelo/Film-Luts** — https://github.com/YahiaAngelo/Film-Luts — **MIT (repo).** ⚠️ Ready-made film LUTs, but the maintainer **explicitly disclaims ownership** and warns the LUTs "might be subject to copyrights/trademarks of their respective owners." MIT on the wrapper, **murky provenance on the data** → fine to test/learn from, risky to ship the LUTs themselves. Treat as a sample/QA set, not a shippable pack.

_(Also MIT-adjacent for tooling: `cameramanben/LUTCalc` (camera log/3D `.cube` generator) and OpenColorIO configs — useful for transfer-function math, not film stocks per se.)_

### Learn-only / copyleft / share-alike (attribution + ShareAlike — don't silently bake into proprietary)

4. **G'MIC "Color Presets" / "Simulate Film"** — https://gmic.eu/color_presets/ — **1100+ CLUTs** as `.png` HaldCLUT **and** `.cube`. The G'MIC engine is **CeCILL** (GPL-compatible copyleft). The CLUTs are aggregated from many authors — **Pat David (CC-BY-SA), RawTherapee, Stuart Sowerby/PictureFX, Marc Roovers**, etc.; named stocks carry a **trademark/"fair use" disclaimer**. Mixed CC-BY-SA → **attribution + share-alike**, not clean for proprietary shipping. **Best free library to study and to A/B against.**

5. **Pat David film-emulation HaldCLUTs** — https://patdavid.net/2013/08/film-emulation-presets-in-gmic-gimp/ — **CC BY-SA.** The canonical open B&W + color film CLUT set (the upstream of much of #4). Ship only under CC-BY-SA terms (credit + share-alike).

6. **NatronGitHub/clut** — https://github.com/NatronGitHub/clut — **CC BY-SA 4.0** (HaldCLUT presets incl. Pat David B&W). Same share-alike constraint.

7. **cedeber/hald-clut** — https://github.com/cedeber/hald-clut — **GPL-3.0.** RawTherapee Film Simulation + PictureFX v2 + Fuji X-Trans III + Apple Photo HaldCLUTs collected together. GPL ⇒ copyleft.

8. **RawTherapee Film Simulation Collection** — RawPedia "Film Simulation" (rawpedia.rawtherapee.com/Film_Simulation; mirror via #7). HaldCLUT (`.tif`/`.png`) pack, **mixed CC licenses by sub-pack** (PictureFX, Pat David). Free to use; verify per-pack license before shipping.

9. **bean-mhm/flim** — https://github.com/bean-mhm/flim — **AGPL-3.0 (strong copyleft).** A filmic _view transform_ (AgX-lineage) with `.spi3d` LUTs + OCIO config (default/nostalgia/silver). Beautiful tone-mapping reference; **AGPL makes it unshippable** in a closed product. Study only.

**Commercial methodology references (not redistributable, read for technique):** Dehancer, FilmBox/Video Village, DaVinci Resolve Film Look Creator, Filmomat / Negative Lab Pro — all implement the B.1 spectral chain; useful to read their public write-ups, nothing to ship.

### Bottom line on sourcing

- For a **clean, shippable** approach: **generate** our own LUTs with **spectral_film_lut (MIT)** from public datasheets, and structure the live "film" engine on the **ComfyUI-Darkroom (MIT) parametric model** (H&D curves + matrix). That gives owned, MIT-clean assets.
- Use the **CC-BY-SA / GPL HaldCLUT libraries (G'MIC, Pat David, RawTherapee) for calibration and taste reference** only — or ship them _with_ proper attribution + share-alike if that license is acceptable for the product.

---

## Quick spec recap (for implementation)

- **Grain:** seeded value-noise (mulberry32 hash of lattice coords + seed) at `grainSize` px, ×2 octaves, scaled by `sqrt(Y(1−Y))·(shadow/mid/high weights)·intensity`, applied as **luminance** (R=G=B) with optional small per-channel chroma; Gaussian samples → signal-dependent variance; in display/gamma space; after the look. Map `intensity`→Kodak RMS σ_D (ISO 100≈0.010). Preview==export via seed.
- **LUT:** ship parametric **1D curves + 3×3 matrix** (fast, adjustable) + a **33³ `.cube` trilinear** path (≈0.7–1.8 s/12 MP single-thread, tileable; dither output). 33³ is the sweet spot.
- **Top 3 shippable sources:** spectral_film_lut (MIT, generator), ComfyUI-Darkroom (MIT, curves+35 .cube), Film-Luts (MIT repo, murky data — test only). Everything else worth using is CC-BY-SA / GPL / AGPL → attribution/share-alike or learn-only.
