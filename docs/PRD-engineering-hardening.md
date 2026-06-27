# PRD — HAX Engineering Hardening

**Status:** In progress (branch `engineering-hardening`)

> **Progress log**
>
> - ✅ Checkpoint 1 (verified: `tsc` clean · `jest` 162 passed/0 failed · `next build` succeeds):
>   WS-1.1 color-space.ts (+7 tests) · WS-1.2 clampByte round · WS-1.3 saturation /100 ·
>   WS-1.4 exposure linear · WS-1.5 color-temp linear+luminance (+test) ·
>   WS-2.1 fastBoxBlur boundary [#1 bug] (+flat-field regression test) · WS-2.2 stackBlur radius ·
>   WS-2.6 radial trig · WS-3.3 Bayer DC-bias · WS-3.6 glitch OOB bug · WS-3.7 glitch seeding (+determinism test).
> - 🔎 Finding: WS-2.4 (smart-sharpen) & WS-2.5 (clarity) target the **dead modular layer**, not production → folded into WS-6.
> - ⏸ Staged (need a Float32 linear-blur path + visual regression): WS-2.3 bloom/glow linear, WS-3.2 dither-in-linear.
> - ✅ Checkpoint 2 (verified: `tsc` clean · `jest` 173 passed/0 failed · `next build` succeeds):
>   WS-4.1 preview pixelRatio cap · WS-4.2 collapsed 3x load renders · WS-4.3 BufferPool clear-flag (+test) ·
>   WS-5.1 GIF quality invert · WS-5.2 GIF dither key · WS-5.3 GIF transparency type ·
>   WS-5.4 video colour tags · WS-5.5 video even-dim guard · WS-5.7 honest GIF/WEBM disabled state.
>   Refactor: pure `export/exportHelpers.ts` (testable, no ffmpeg/gif.js import) (+6 tests). Test count 143 -> 179.
> - ✅ Checkpoint 3 (verified: `tsc` clean · `jest` 180 passed/0 failed · `next build` succeeds):
>   GOLDEN-IMAGE HARNESS (90 effects snapshotted; RNG-pinned) — the regression net for visual changes ·
>   Float32 linear-light blur path (`gaussianBlurLinear`/`separableGaussianBlurF32`) + WS-2.3 (bloom, unifiedGlow,
>   orton, film-halation, halationGlow, neonGlowEdges, bioluminescence → linear) (+edge-midpoint test) ·
>   WS-3.1 error diffusion → single full-precision (Float32) helper for Floyd/Atkinson/Stucki/Sierra (+conservation test) ·
>   WS-3.4 blue-noise honest relabel ("Gradient Noise") · WS-3.5 chromatic aberration sub-pixel/bilinear (+test) ·
>   WS-6 cleanup: deleted 8 orphan components + `src/types/effects.ts` (EffectLayer type moved to useEffectLayers),
>   removed site-wide COEP/COOP headers, corrected stale CLAUDE.md. Harness proved each change touched ONLY its
>   intended effects (no collateral). Test count 143 → 180.
> - ⏸ STAGED (intentionally not shipped blind — need a stylistic decision or visual regression the harness can't cover):
>   WS-3.2 dither-in-linear (changes retro/multi-level palette look) · WS-1.6 saturation pivot (film emulation
>   intentionally deviates; audit-downgraded to low) · WS-4.4 layer caching (rewrites ImageEditor compositing; needs
>   visual check of stacked effects) · WS-5.6 SVG colour tracing (low; SVG export path) · WS-6.x modular-dir purge
>   (effectsUtils/index/dead modular effect files + their tests — dead-code-eliminated already; removal needs test handling).
> - ⏭ WS-7 (GPU path, worker pipeline, full per-effect registry) — large, requires the screenshot-diff harness; not started.
>   **Author:** Engineering audit synthesis (45-agent audit, 38 findings, 35 verified)
>   **Baseline (pre-work):** `tsc --noEmit` clean · `jest` 14 suites / 143 passed / 27 skipped / 0 failed
>   **Scope:** Code, engineering, and performance improvements only (the **engineering** audit). The UX/UI "moves" (Looks Deck, Effect Chip) are a separate design track and are **out of scope** here.

---

## 1. Problem

HAX renders correctly but is mathematically and architecturally soft underneath. Three classes of debt:

1. **Mathematical correctness** — effects operate on gamma-encoded sRGB where physics needs linear light; a box-blur boundary bug biases the brightness of _every_ blur; the saturation control is exponential and unusable past ±5; error diffusion clips in an 8-bit buffer; several effects are non-deterministic (preview ≠ export). Outputs look "off" in ways users feel but can't name.
2. **Performance** — every effect is per-pixel JS on the main thread; the full effect stack recomputes on every slider tick; the live preview renders at 2–4× the needed pixels; the GPU and Web-Worker paths exist but are dead code.
3. **Consistency / rot** — a 12,824-line monolith behind a 116-case switch; three competing `EffectConfig` type definitions (one silently dead-broken); a duplicate modular dir that drifts; ~40% installed-but-unwired tech; export encoders that are buggy _and_ unwired; site-wide COEP headers for a feature that never runs.

## 2. Goals / Non-goals

**Goals**

- G1 — Every effect produces mathematically correct output (linear-light where required, luminance-correct, no boundary/clamp artifacts).
- G2 — Interactive editing is materially faster: no full-stack recompute per tick, no over-resolution preview, no redundant renders.
- G3 — One source of truth for effect utilities and types; the dead/drifting layers removed.
- G4 — The export path is either correct or honestly disabled — no silent no-ops, no color shifts, no crashes.
- G5 — **No regressions:** the full test suite stays green, typecheck stays clean, the production build succeeds, and new behavior is covered by new tests.

**Non-goals (this PRD)**

- UX feature-wiring (undo, before/after, zoom, Effect Chip, Looks Deck) — design track.
- Visual restyle / token-system reconciliation — design track (noted as dependency for the design moves).

## 3. Workstreams

Each item: **Finding → Change → Files → Test.** Severity is post-verification. Effort S/M/L.

### WS-1 · Color-space & math foundation _(unblocks WS-2, WS-3)_

The keystone: build the shared helpers several fixes depend on, then route the gamma-incorrect operations through them.

| ID  | Fix                                                                                                                                                          | Sev | Eff |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | --- |
| 1.1 | New `src/lib/effects/color-space.ts`: 256-entry `srgbToLinear`/`linearToSrgb` byte LUTs, `makeByteLUT(fn)`, `mulberry32(seed)` seeded PRNG, `clampByteRound` | —   | S   |
| 1.2 | `clampByte` rounds instead of `\| 0` truncation (kills downward bias) — `effects.ts:107`                                                                     | low | S   |
| 1.3 | Saturation slider `/10` → `/100` so +100 = ~2× not 1024× — `effects.ts:387`                                                                                  | med | S   |
| 1.4 | Exposure in linear light (precomputed byte LUT `out[c]=encode(decode(c)·2^stops)`) — `effects.ts:4651`                                                       | med | M   |
| 1.5 | Color temperature: gains in linear light + luminance renormalization — `effects.ts:2931`                                                                     | med | M   |
| 1.6 | Saturation pivots on `getLuminance` not `(r+g+b)/3` at the genuine sites (4814/4911/4857/11549; **not** 2062 — that's halftone dot sizing)                   | low | S   |

**Tests:** `color-space.test.ts` — LUT round-trip monotonic & ≤1 LSB error; exposure +1 stop maps mid-gray 128→~176 (not 255); saturation map +100→2×, 0→1×; temperature warm preserves mean luminance on a gray ramp; clampByte rounds half-up.

### WS-2 · Spatial / convolution correctness & speed

| ID  | Fix                                                                                                                                                                                   | Sev      | Eff |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --- |
| 2.1 | **`fastBoxBlur` boundary bug** — drop the 4 `if` guards so the clamped remove/add always run (fixes a uniform brightness bias on every blur r>3) — `OptimizedBlur.ts:207,215,253,262` | **high** | S   |
| 2.2 | `stackBlur` box radius from σ=radius/3 (Kovesi/Wells `w=√(4r²/9+1)`) — removes 1.7× over-blur + r=3 discontinuity — `OptimizedBlur.ts:288`                                            | med      | S   |
| 2.3 | Bloom / Unified-Glow / halation / Orton: blur + composite in linear light — `effects.ts:1546,1651,270,4766`                                                                           | med      | M   |
| 2.4 | Smart Sharpen: separable 1D Gaussian sized to 3σ (was 2D O(n·k²), ~2× oversized) — `smartSharpenEffect.ts:39`                                                                         | med      | M   |
| 2.5 | Clarity: high-pass from luminance (not red only) + signed zero-centered weight — `clarityEffect.ts:120`                                                                               | low      | S   |
| 2.6 | Radial blur: hoist `cos/sin` out of the sample loop — `effects.ts:4124`                                                                                                               | med      | S   |

**Tests:** flat-field invariance (blur of a constant image == constant, ±1 LSB) — _this is the regression test for 2.1_; impulse-response σ continuity across r=3→4 for 2.2; separable == reference 2D within tolerance for 2.4.

### WS-3 · Quantization / dithering / glitch correctness

| ID  | Fix                                                                                                                                              | Sev | Eff |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --- | --- |
| 3.1 | Error diffusion into a `Float32` buffer (no 8-bit clamp loss) — `effects.ts:11972` + kernels                                                     | med | M   |
| 3.2 | Dither/quantize in linear light via the WS-1 LUTs — `effects.ts:11881`                                                                           | med | M   |
| 3.3 | Ordered Bayer: normalize `(M+0.5)/n²` (fix DC bias) + scale amplitude to the quant step — `effects.ts:12053`                                     | med | S   |
| 3.4 | "Blue noise" is IGN — ship a tileable void-and-cluster LUT **or** rename honestly — `effects.ts:12221`                                           | med | M   |
| 3.5 | Chromatic aberration: fractional offsets + bilinear sampling (fixes dead lower-half of slider) — `effects.ts:1869`                               | low | M   |
| 3.6 | Glitch color-shift **OOB read** — index `tempRow` by relative row (`(y-startY)`), not absolute `y` (NaN→0 after first block) — `effects.ts:2321` | med | S   |
| 3.7 | Seed all stochastic effects (glitch/VHS/databend/grain) with a `seed` param + `mulberry32` so preview == export — `effects.ts:2310` + sites      | med | M   |

**Tests:** Floyd-Steinberg total error conservation on a ramp; Bayer matrix mean == 0.5; glitch determinism (same seed → byte-identical output); chromatic AA sub-pixel produces non-zero shift at amount 0.3.

### WS-4 · Render-pipeline performance

| ID  | Fix                                                                                                                                                                       | Sev  | Eff |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --- |
| 4.1 | Cap interactive `pixelRatio` (`min(dpr,1.5)`); reserve true DPR for settle/export — `ImageEditor.tsx:591`                                                                 | med  | S   |
| 4.2 | Collapse the 3 redundant full renders on image load to one scheduler — `ImageEditor.tsx:555`                                                                              | med  | S   |
| 4.3 | `BufferPool.acquire(size,{clear=false})` option; skip `fill(0)` when fully overwritten; route raw-`new Uint8ClampedArray` hot sites through the pool — `BufferPool.ts:28` | med  | M   |
| 4.4 | **Layer caching** — cache cumulative processed buffers by prefix hash `hash(layer[0..k])`; on a change at k, reuse 0..k-1, re-run k..N — `ImageEditor.tsx:300`            | high | M   |

**Tests:** `BufferPool` returns non-zeroed buffer when `clear:false` and zeroed when `clear:true`; layer-cache prefix reuse returns cached buffer for unchanged prefixes (unit on the cache keying). Manual: dev-server frame-time before/after on a 4-effect stack.

### WS-5 · Export correctness _(fix the latent bugs; make unwired paths honest)_

| ID  | Fix                                                                                                                                                                   | Sev | Eff |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| 5.1 | GIF quality scale: invert mapping (gif.js quality = sample interval, lower=better) — `animationRenderer.ts:228`                                                       | med | S   |
| 5.2 | GIF dither: wrong key `dithering` → `dither` with a real value — `animationRenderer.ts:235`                                                                           | med | S   |
| 5.3 | GIF transparency: fix always-0 flag + use an integer color sentinel + pre-fill cleared pixels — `animationRenderer.ts:236`                                            | med | M   |
| 5.4 | Video color: tag `-colorspace/-color_primaries/-color_trc bt709 -color_range tv` + matching scale — `videoExporter.ts:212`                                            | med | M   |
| 5.5 | Video odd-dimensions: `scale=trunc(iw/2)*2:trunc(ih/2)*2`; drop unconditional `-s` rescale — `videoExporter.ts:181`                                                   | med | S   |
| 5.6 | SVG traced "color" mode: per-color masks (not palette-by-path-index) **or** honestly restrict to silhouette — `svgExport.ts:119`                                      | low | M   |
| 5.7 | UI honesty: GIF/WEBM buttons get a real disabled state until 5.1–5.5 are wired (no silent `console.warn` no-op) — `ImageEditor.tsx:371`, `AppleControlsPanel.tsx:824` | med | S   |

**Tests:** extend `gifOptimizer.test.ts` — quality mapping is inverted (q10→sample1); dither key is `dither`. Video: build the ffmpeg arg array and assert color/scale flags present; odd-dim input produces an even-scale filter.

### WS-6 · Architecture & cleanup

| ID  | Fix                                                                                                                                                                                                            | Sev | Eff |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| 6.1 | Consolidate helpers: one home (`effects/utils.ts` or new `color-space.ts`), import into `effects.ts`, delete the inline duplicates                                                                             | med | M   |
| 6.2 | Delete the dead/drifting modular layer: `src/types/effects.ts`, `src/lib/effects/effectsUtils.ts` (calls a non-existent `.apply()`)                                                                            | low | S   |
| 6.3 | Delete orphan components (0 importers): `ControlPanel, EffectLayers(component), LayersPanel, HistoryPanel, QuickEffectsBar, EffectHoverPreview, ThemeToggle, BootScreen` — preserve any still-imported _types_ | —   | S   |
| 6.4 | Remove dead Zustand store fields (`activeEffect/effectSettings/history`) once HistoryPanel is gone — `store.ts`                                                                                                | low | S   |
| 6.5 | Drop site-wide COEP/COOP headers (ffmpeg SharedArrayBuffer never runs) — `next.config.js:42`                                                                                                                   | med | S   |
| 6.6 | Fix stale `CLAUDE.md` (ignoreBuildErrors, line count, effect counts, imHAX/HAX)                                                                                                                                | low | S   |
| 6.7 | Standardize control units on the descriptor (`{range,unit,toEngine}`); normalize `intensity` to one convention                                                                                                 | med | M   |

### WS-7 · Staged (require visual-regression infra — NOT done blind)

These are the biggest levers but cannot be done responsibly without a per-effect screenshot-diff harness across 100+ effects. **Recommended next, behind a flag, with the harness.**

- **GPU path** — revive `WebGLRenderer` (Pixi) for pixel-parallel effects (blur/bright/contrast/sat/hue/pixelate), Konva fallback for the rest. 10–100× on large images.
- **Worker pipeline** — run heavy CPU kernels off-thread via `WorkerManager` + transferable `ImageData`. _Depends on the registry refactor (kernels as pure importable fns)._
- **Full monolith → per-effect registry** — one module per effect (descriptor + kernel + self-register), switch → `Map` lookup. Do via codemod + per-effect golden tests; it unblocks GPU/worker and per-effect testing.

## 4. Test & verification plan

**Gates (must pass before each checkpoint commit):**

1. `npx tsc --noEmit` — clean.
2. `npx jest --ci` — all green (no reduction from baseline 143 passed).
3. `npm run build` — succeeds (eslint + TS run in build; `ignoreBuildErrors:false`).
4. New unit tests for every correctness fix (golden/numeric assertions, listed per workstream).
5. Manual smoke on `localhost:3000`: load image → apply blur/saturation/exposure/dither/glitch/bloom → confirm visually sane + (glitch) preview==export.

**New test files:** `effects/__tests__/colorSpace.test.ts`, `performance/__tests__/optimizedBlur.test.ts`, `effects/__tests__/ditherMath.test.ts`, `effects/__tests__/determinism.test.ts`; extend `gifOptimizer.test.ts`, add `export/videoExporter.test.ts`.

**Regression guard for the headline bug (2.1):** a flat-field blur invariance test that fails on `main` and passes after the fix — proof the fix is real.

## 5. Sequencing & rollout

1. WS-1 (foundation) → 2. WS-2 → 3. WS-3 → 4. WS-4 → 5. WS-5 → 6. WS-6 cleanup.

- Verify gates after each workstream; keep the branch always-green.
- Commit at verified workstream checkpoints **only when Paul authorizes** (per workflow rules).
- WS-7 staged as a follow-on with the screenshot-diff harness.

## 6. Risks

- **Monolith edits** — precise, line-anchored edits; every change covered by a test; full suite re-run per workstream.
- **Linear-light shifts the look** of exposure/bloom/dither — intended (correct), but visible; flag in the changelog so it's not mistaken for a regression.
- **Export fixes touch unwired code** — paired with WS-5.7 (honest disabled state) so we don't ship half-wired encoders.
