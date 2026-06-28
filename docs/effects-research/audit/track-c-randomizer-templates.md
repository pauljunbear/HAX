# Track C — "Surprise Me" Randomizer + Templates/Presets Audit

Scope: the combined-effect surfaces — the **Smart Randomizer** ("Surprise me" / "Reroll"), the **moods**, the **unified-studio presets**, and whether any curated **templates/looks** exist. Sources read in full: `src/lib/randomizer/{compose,effectMeta,palette,seed}.ts`, `RandomizerBar.tsx`, `EditorApp.tsx` wiring, `studio/StudioApp.tsx`.

## What exists today

### 1. The Smart Randomizer (`compose.ts`) — GENUINELY GOOD

This is **not** a dumb `Math.random()` filter roulette. It's a constrained-stack composer:

- **Slot model**: 8 canonical render slots (`warp → tone → grade → stylize → texture → glow → glitch → frame`). At most ONE effect per slot, so stacks stay sparse and read as deliberate, and they always emit in correct render order.
- **Mood-weighted choice**: 8 moods (`faded, neon, riso, dreamy, noir, acid, sun, cyber`) are named probability distributions (`prefer` weights) over effects + a hue range + a color scheme + an intensity mean/sigma.
- **Intensity envelope**: each effect's single 0..1 intensity `t` is drawn from a Gaussian (`mean + gaussian()*sigma`), widened by "wildness". Then exactly **one layer is promoted to "hero"** (boosted intensity) → one loud gesture + quiet support. Smart.
- **Heaviness budget**: if both a stylize and a glitch land, the glitch opacity is auto-softened so the subject survives. Smart.
- **Color coherence**: a single OKLCH palette (`makePalette`, real OKLab→sRGB math) feeds every color-aware effect (duotone, gradientMap) so a random grade reads as one decision, not fighting hues.
- **Deterministic**: everything flows from a seeded PRNG (`mulberry32(xmur3(seed))`); the 6-char seed is shown and reproduces the look. `randSeed()` uses `Math.random()` exactly once to pick the seed.
- **Locks**: locked layers own their slot and survive a reroll.
- **Wildness** re-shapes the CURRENT seed live as you drag (no undo churn).

**Verdict: the LOGIC is a strength — keep it.** The problem is its _vocabulary_, not its brain.

### 2. Unified-studio "presets"

Each `unified*` effect (Film, Glow, Glitch, Vintage, Warp, Mono, Print, Sketch, Pattern, Blur, Dithering) has a `preset` index selecting a named sub-look (e.g. unifiedFilm preset 0..5 = Portra/Cinestill/Gold/Fuji/Ilford/Kodachrome). These are per-effect dropdowns inside the controls panel — NOT a cross-effect concept.

### 3. Templates / curated "Looks" — **DO NOT EXIST**

There is no gallery of named, one-click, reproducible multi-layer looks. The closest things are the abstract _moods_ (distributions, not fixed recipes) and the per-effect _presets_. A designer cannot pick "give me the Kodachrome-summer look" as a starting point and then tweak.

## Gaps / problems (ranked by impact)

1. **Coverage gap — the randomizer can't reach the app's best looks.** `EFFECT_META` defines only **~31 effect IDs**, but the catalog has **~110**. Entire high-value families never appear in "Surprise me":

   - **`unifiedFilm` (ALL film stocks) — absent.** The film looks Paul cares most about are never composed.
   - Painterly: `watercolor`, `oilPainting`, `toon`, `posterEdges`, `cutout`, `stainedGlass` — absent.
   - `unifiedPrint` (riso/newsprint/linocut/screenprint/letterpress) — absent.
   - `cinematicLut`, `selectiveColor`, most `Special FX` — absent.
     So the randomizer draws from a thin slice and the moods feel same-ish.

2. **No curated Looks/templates** (the "templates" the user asked about). Deterministic seeds make this trivial to build: a Look = `{seed, moodId, wildness}` OR an explicit layer recipe. One click to apply, fully editable afterward (stack stays decomposable / non-destructive). This is the single highest-value _product_ addition for "a set of interesting filters I can cycle through."

3. **Moods cluster around soft-vintage.** `faded / sun / noir / dreamy` overlap heavily. Missing distinct registers: clean-editorial, teal-orange cinematic, infrared/surreal, print/riso-poster, darkroom B&W, Y2K-chrome, dreamy-pastel (Pro 400H). Once film + print + painterly are in the meta, moods can diversify.

4. **`excl` (cross-effect exclusions) declared but NOT enforced.** `EffectMeta.excl?: string[]` exists in the interface but `compose.ts` never reads it. So mutually-bad combinations aren't actually prevented (the slot model prevents _most_ pile-ups, but not semantic clashes).

5. **Grain is the cosmetic `noise`, not film grain.** The randomizer's texture slot uses `noise` (uniform unseeded-ish white noise). Once a real seeded film-grain effect ships, wire it in.

6. **Hero can land on a weak slot.** The hero is chosen uniformly among picks; if it lands on `tone` or `frame` the "loud gesture" is muted. Minor: bias hero selection toward `grade/stylize/glow/glitch` slots.

## Recommendations (Track C)

- **R-C1 (high): Build a "Looks" gallery** — ~12–16 curated, named, one-click recipes spanning registers (film, cinematic, print, painterly, glitch, mono, dreamy). Store as explicit recipes (or seed+mood+wildness). Reuse `compose`/stack infra; remain fully editable after apply. This is the "templates" deliverable.
- **R-C2 (high): Expand `EFFECT_META`** to cover the high-value families — add film stocks (grade slot), print + painterly (stylize/grade), a few Special FX as hero gestures. Immediately enriches "Surprise me".
- **R-C3 (med): Wire real grain + halation** into film-bearing looks once those ship.
- **R-C4 (med): Add 3–4 new moods** once coverage expands (cinematic teal-orange, riso-poster, darkroom B&W, pastel).
- **R-C5 (low): Enforce `excl`; bias hero to strong slots.**

## Stale prior docs (supersede in final dossier)

- `docs/new-effects-brainstorm.md` — ranks **film emulation + B&W LAST (Phase 4)**, and is dominated by out-of-scope features for a client-side Konva pixel editor (AI background removal, AI upscaling, content-aware fill, healing brush). Misaligned with the actual goal. **Supersede.**
- `docs/library-evaluation.md` — recommends **tsParticles**, which was **purged** in the recent dead-code cleanup. **Stale/contradicted.**

## Note: two editor surfaces

- `/` → `EditorApp.tsx` (full editor: EffectsBrowser + ControlsPanel + RandomizerBar).
- `/studio` → `StudioApp.tsx` ("simplified HAX editor, Jun 2026 redesign", design spec locked in `design-system/studio/` — **leave alone**).
  Both reuse the SAME engine (`effects.ts`, `randomizer.compose`, `useEffectLayers`). **All effect-engine + randomizer-meta work benefits both surfaces** — do it in the shared layer, don't touch `design-system/`.
