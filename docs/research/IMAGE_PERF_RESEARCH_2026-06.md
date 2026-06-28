# HAX / imager2 — Image Performance Research & Roadmap (Jun 2026)

Source: an 8-agent research sweep (7 domain agents + 1 synthesis lead, ~865k tokens)
grounded in this codebase, sweeping web image-editing performance, drag-drop, and
lossless export. **Hard constraint on every recommendation: zero image-quality loss.**

This doc is the durable record so the deferred phases aren't re-researched.

---

## What's already in the engine (do NOT re-propose / re-build)

- Two-pass progressive render (`ImageEditor.tsx`): fast preview at pixelRatio 0.6 (50ms)
  then full at `min(devicePixelRatio, 1.5)` (180ms idle).
- WebGL2 GPU fast-path (`lib/webgl/WebGL2Renderer.ts`) — used only when **every** layer
  is GPU-supported AND opacity===1 (currently 7 trivial colour effects). 1 upload + 1 readback.
- `PrefixRenderCache` / `LayerPipeline` — LRU of cumulative ImageData; editing layer k reuses
  cached prefix [0..k-1].
- Separable Gaussian (`OptimizedBlur.ts`), `BufferPool` (Uint8ClampedArray reuse).
- Konva `listening(false)` + `perfectDrawEnabled(false)` on the Image node.
- Drag-drop onto canvas + clipboard paste + drop overlay (`StudioApp.tsx`) — shipped Jun 2026.

---

## ✅ Phase 1–3 — SHIPPED (branch `studio-land-and-perf`, commit `76a68fe`)

All byte-exact / lossless or correctness; 388 jest tests (incl. `goldenEffects` determinism) green.

1. **Export fidelity fix (was a live quality bug).** The export "fast path" read the on-screen
   filter cache — cached at a _preview_ pixelRatio (≤1.5, or 0.6 mid-drag) — and upscaled it to
   native resolution via `toDataURL({pixelRatio})`. For any photo larger than ~display×1.5
   (i.e. essentially every real upload), exported grain/halation/warps were **bilinearly
   interpolated, not rendered per native pixel** — silently violating zero-degradation. Fix:
   export now **always** re-renders at native resolution off-screen (temp stage, pixelRatio 1).
2. Export via `canvas.toBlob` + object URL (same encoder/pixels) instead of synchronous
   `toDataURL` base64 inflation; revoke after download.
3. Scheduler: distinguish a **discrete** toggle/Look/compare (stack structure changed) from a
   **slider drag** (settings only). Discrete → one full-quality pass ASAP (skips the wasted 0.6
   preview + its low-res "pop", halves cache() calls); drag keeps the 0.6→full two-pass.
4. No-effects / hold-to-compare draws the source **uncached** (`clearCache` + `batchDraw`) —
   pixel-identical to and sharper than a downscaled cache; skips a scene+hit-canvas alloc.
5. Konva micro-wins: `hitCanvasPixelRatio:0.1` (node/layer are non-interactive),
   `draw()`→`batchDraw()`, `transformsEnabled:'position'`, `<Layer listening={false}>`.
6. Load via `URL.createObjectURL` instead of FileReader→base64 data URL — kills the ~33% string
   bloat duplicated through the store + every preview tile, plus the encode/re-decode round trip.
   Revoke prior URL on swap/unmount (store doesn't persist the image, so `blob:` is safe).

---

## ⏭ Deferred — the bigger bets (each needs its own determinism gate)

### Phase 4 — the worker pipeline (THE headline lag lever)

Extract a pure, Konva-free pixel-pipeline module mapping a serializable
`LayerSpec{effectId, settings(incl seed), opacity}` → in-place Uint8ClampedArray. The `pro/`,
`film/`, `sampling.ts`, `color-space` code ports directly (already pure `applyX(data,w,h,params)`);
only the ~6 Konva built-ins (Blur/HSL/Contrast/Sepia/Invert/Noise) need tiny pure reimplementations.
Route **both** export and a **single dedicated worker** through this one module so all callers are
byte-identical. Worker owns the rasterized source + the PrefixRenderCache; `renderStack(specs[])`
recomputes only the changed suffix off-thread and returns a **transferable ImageBitmap** →
`node.image(bitmap); node.filters([])` on the main thread (escapes Konva's synchronous `cache()`
filter model). Pair with a rAF latest-wins scheduler.

- **Why:** the CPU-only heavy effects (film substrate, Kuwahara/oilPainting, surfaceBlur, large blur)
  freeze the main thread mid-render today; the 50/180ms debounce only _delays_ the freeze.
- **Guards:** do NOT wire the existing `public/effectsWorker.js` / `src/worker/effectsWorker.ts` as-is —
  its filters are DIFFERENT algorithms (box blur not separable Gaussian; **unseeded** `Math.random`
  noise) and would change pixels + break preview==export. Replace its body with the pure module, keep
  the message shell. Add a CI assertion (extend `goldenEffects`) that worker-rendered == main-thread
  rendered ImageData for a fixed stack+seed. NEVER put BufferPool-pooled buffers in a transfer list
  (transfer detaches → zombie buffer → black frame). Do NOT `transferControlToOffscreen` the visible
  Konva stage (react-konva is DOM/main-thread bound) — OffscreenCanvas only _inside_ the worker.

### Phase 5 — off-main-thread decode

Rewrite `useImage` to decode via `createImageBitmap(blob, {imageOrientation:'from-image',
premultiplyAlpha:'none'})` with an `<img>.decode()` fallback; hand the ImageBitmap straight to Konva.

- **Mandatory guards:** pass `imageOrientation:'from-image'` (else EXIF portrait photos rotate);
  do NOT set `colorSpaceConversion:'none'` (shifts tagged/wide-gamut colour); never `resizeWidth` the
  master (caps export detail). `premultiplyAlpha:'none'` + default colorSpace = byte-identical.

### Phase 6 — GPU coverage (lossless by construction, gated by `/devtest/gpu` ±1 harness)

Enabling pair: (1) allocate ping-pong intermediates as **RGBA16F** (`EXT_color_buffer_float`) so
multi-step linear-light math survives at full precision — keep source upload + readback at 8-bit;
(2) generalize `GpuPass` to N ordered passes with 2+ bound input textures. Then port single-pass
per-pixel colour effects (exposure, colorBalance, channelMixer, splitTone, bleachBypass, threshold,
posterize, colorTemperature, vignette), 256×1 NEAREST **LUT-texture** tone stages (byte-identical to
`buildExposureLUT`/`buildCurveLUT`), the separable Gaussian (backs bloom/glow/orton/halation), and
the bilateral surfaceBlur. Replace the all-or-nothing `allGpu` gate with **longest-GPU-prefix routing**
(+ an `opacity` `mix()` pass). **EXCLUDE seeded-stochastic effects** (film grain, fractalNoise,
chromaticGrain, halation grain) — a shader PRNG can't stay byte-identical to mulberry32; keep them on
CPU/worker. Geometric warps via hardware LINEAR sampling are visually lossless but NOT bit-identical —
verify with a PSNR/visual tolerance, never the byte-exact harness.

### Phase 7 — optional polish

`@jsquash/webp` lossless + `@jsquash/oxipng` (encoded in the worker via
`OffscreenCanvas.convertToBlob`), `showSaveFilePicker` native Save with the anchor-download fallback.
Note: `canvas` `image/webp` at quality 1.0 is **near-lossless lossy** (Chromium 40432361), and
`canvas` can't encode AVIF (silently falls back to PNG) — use jSquash WASM with explicit lossless flags.
jSquash is single-threaded WASM, needs no COOP/COEP (important — this project intentionally removed them).

---

## Do NOT do (would hurt quality or not pay off)

- Don't `imageSmoothingEnabled:false` on `cache()` (the 0.6 preview downscales→upscales → jaggies).
- Don't set `Konva.pixelRatio` globally (leaks into the export temp stage → wrong export resolution),
  and don't `clearBeforeDraw(false)` (letterboxed image → ghost trails on toggle/resize).
- Don't treat `canvas` `image/webp` q=1.0 as lossless; don't route AVIF through canvas.
- Don't tile the pipeline or WASM/SIMD-rewrite the 13k-line engine — uploads are capped at 10MB so
  images fit in memory; tiling neighbour-reading effects (blur/surfaceBlur/halation/warps) seams unless
  you carry overlap halos, and a Rust/WASM port risks float divergence that breaks `goldenEffects`.
- Wide-gamut P3/ICC export preservation: FLAG only — high-risk in a react-konva stack; validate against
  a known P3 reference before building.
