/**
 * Smart Randomizer — mood-seeded constrained-stack composer.
 *
 * compose(seed, mood, locked, wildness) -> ordered recipe. Picks at most one
 * effect per canonical slot (so stacks stay sparse and never pile up), weights
 * choices by the mood, draws intensities from a Gaussian envelope with one
 * power-law "hero", binds colour-aware effects to one OKLCH palette, respects
 * locked layers absolutely, and emits in canonical render order. Fully
 * deterministic from the seed (reproducible, shareable).
 */
import { makeRng } from './seed';
import { makePalette, type Palette } from './palette';
import { EFFECT_META, RANDOMIZER_EFFECT_IDS, SLOT_ORDER, MOODS, type Slot } from './effectMeta';

export interface RecipeLayer {
  effectId: string;
  settings: Record<string, number>;
  opacity: number;
  locked: boolean;
}
export interface Recipe {
  layers: RecipeLayer[];
  seed: string;
  moodId: string;
  palette: Palette;
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
// Box–Muller standard normal from a uniform PRNG.
function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function slotOf(effectId: string): Slot {
  return EFFECT_META[effectId]?.slot ?? 'frame';
}

export function compose(
  seed: string,
  moodId: string,
  locked: RecipeLayer[],
  wildness: number
): Recipe {
  const rng = makeRng(seed);
  const mood = MOODS[moodId] || MOODS.faded;
  const baseHue = mood.hue[0] + rng() * (mood.hue[1] - mood.hue[0]);
  const palette = makePalette(baseHue, mood.scheme, rng);
  const W = clamp(wildness, 0, 1);
  const target = 3 + Math.round(W * 3); // 3..6 fresh layers

  const lockedSlots = new Set<Slot>(locked.map(l => slotOf(l.effectId)));
  // Cross-slot exclusions (EFFECT_META.excl). Declared on the earlier-slot effect
  // and filtered forward in SLOT_ORDER, so a film grade (own grain) suppresses a
  // later extra-grain texture. Seeded from locked layers too.
  const excludedIds = new Set<string>();
  for (const l of locked) (EFFECT_META[l.effectId]?.excl || []).forEach(e => excludedIds.add(e));
  const picks: Array<{ effectId: string; t: number; opacity: number; hero?: boolean }> = [];

  for (const slot of SLOT_ORDER) {
    if (picks.length >= target) break;
    if (lockedSlots.has(slot)) continue; // a locked layer owns this slot
    const pool = RANDOMIZER_EFFECT_IDS.filter(
      id => EFFECT_META[id].slot === slot && !excludedIds.has(id)
    );
    if (!pool.length) continue;
    const prefSum = pool.reduce((s, id) => s + (mood.prefer[id] || 0), 0);
    const slotOdds = Math.min(0.95, (prefSum > 0 ? 0.6 : 0.12) + W * 0.3);
    if (rng() > slotOdds) continue;
    const weights = pool.map(id => (mood.prefer[id] || 0.0001) + W * 0.15 * EFFECT_META[id].weight);
    const totalW = weights.reduce((a, b) => a + b, 0);
    let r = rng() * totalW;
    let pick = pool[0];
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        pick = pool[i];
        break;
      }
    }
    const t = clamp(mood.mean + gaussian(rng) * mood.sigma * (0.7 + W * 0.8), 0.12, 0.95);
    picks.push({ effectId: pick, t, opacity: 1 });
    (EFFECT_META[pick].excl || []).forEach(e => excludedIds.add(e));
  }

  // Promote exactly one fresh layer to "hero" (one loud gesture + quiet support).
  if (picks.length) {
    const hero = picks[Math.floor(rng() * picks.length)];
    hero.t = clamp(hero.t + 0.3 + W * 0.2, 0, 0.98);
    hero.hero = true;
  }
  // Heaviness budget: if both a stylize and a glitch landed, soften the glitch
  // so the subject survives.
  const hasStylize = picks.some(p => EFFECT_META[p.effectId].slot === 'stylize');
  if (hasStylize)
    picks.filter(p => EFFECT_META[p.effectId].slot === 'glitch').forEach(p => (p.opacity = 0.6));

  const composed: RecipeLayer[] = picks.map(p => ({
    effectId: p.effectId,
    settings: EFFECT_META[p.effectId].settings(p.t, palette, rng),
    opacity: p.opacity,
    locked: false,
  }));

  const all = [...locked, ...composed];
  all.sort(
    (a, b) => SLOT_ORDER.indexOf(slotOf(a.effectId)) - SLOT_ORDER.indexOf(slotOf(b.effectId))
  );
  return { layers: all, seed, moodId, palette };
}
