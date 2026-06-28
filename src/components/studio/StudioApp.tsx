'use client';

/**
 * STUDIO — the simplified HAX editor (Jun 2026 redesign).
 * Centered contained photo + ONE always-visible right panel:
 *   Your stack (decomposable) · full Effects menu (collapsible, live previews)
 *   · Looks (multi-layer presets) · Surprise (calm↔wild) + hover-Export.
 * Reuses the existing engine verbatim: store + useEffectLayers + ImageEditor + randomizer.compose.
 * Locked design spec: imager2/design-system/studio/.
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import ImageEditor from '@/components/ImageEditor';
import type { ImageEditorHandle } from '@/components/ImageEditor';
import useEffectLayers from '@/hooks/useEffectLayers';
import type { EffectLayer } from '@/hooks/useEffectLayers';
import { compose } from '@/lib/randomizer/compose';
import { randSeed } from '@/lib/randomizer/seed';
import { effectCategories } from '@/lib/effects/categories';
import { effectsConfig, getEffectSettings } from '@/lib/effects';
import { useEffectPreview } from '@/hooks/useEffectPreview';
import { LOOKS, lookToStackLayers, getLook, type Look } from '@/lib/looks/looks';
import { MOOD_IDS } from '@/lib/randomizer/effectMeta';

const C = {
  void: '#0b0b0c',
  panel: '#0d0d0f',
  ink: '#eceae3',
  dim: '#8b8780',
  spark: '#f53001',
  raise: '#17171a',
  hair: 'rgba(236,234,227,0.09)',
};
const FONT = 'var(--font-hanken), system-ui, sans-serif';

const CSS = `
.haxr{ -webkit-appearance:none; appearance:none; height:4px; border-radius:999px; outline:none; cursor:pointer;
  background:linear-gradient(to right,#f53001 var(--pct,40%),rgba(236,234,227,.12) var(--pct,40%)); }
.haxr::-webkit-slider-thumb{ -webkit-appearance:none; width:13px; height:13px; border-radius:50%; background:#eceae3; box-shadow:0 1px 4px rgba(0,0,0,.55); cursor:pointer; }
.haxr::-moz-range-thumb{ width:13px; height:13px; border:0; border-radius:50%; background:#eceae3; box-shadow:0 1px 4px rgba(0,0,0,.55); cursor:pointer; }
.haxr::-moz-range-track{ height:4px; border-radius:999px; background:transparent; }
.studio-scroll::-webkit-scrollbar{ width:0; height:0; }
.studio-input::placeholder{ color:#8b8780; }
`;

const effectLabel = (id: string): string =>
  (effectsConfig as Record<string, { label?: string }>)?.[id]?.label ?? id;

const ALL = Object.entries(effectCategories).flatMap(([cat, data]) =>
  (data.effects || []).map(id => ({ id, cat }))
);
const CATS = ['Looks', 'All', ...Object.keys(effectCategories)];
const STARTER_LOOKS = ['portra-soft', 'teal-and-orange'];

/* ---------- styled slider (spark fill, ink thumb) ---------- */
function Slider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  useEffect(() => {
    ref.current?.style.setProperty('--pct', `${pct}%`);
  }, [pct]);
  return (
    <input
      ref={ref}
      type="range"
      className="haxr"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      style={{ flex: 1 }}
    />
  );
}

/* ---------- one live-preview tile (lazy via IntersectionObserver) ---------- */
function Tile({
  previewId,
  imageUrl,
  label,
  sublabel,
  applied,
  onClick,
}: {
  previewId: string;
  imageUrl: string | null;
  label: string;
  sublabel?: string;
  applied?: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '160px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const { canvas } = useEffectPreview(visible ? previewId : null, imageUrl, {
    width: 220,
    height: 150,
  });
  useEffect(() => {
    if (canvas) {
      try {
        setSrc(canvas.toDataURL('image/jpeg', 0.7));
      } catch {
        /* tainted — ignore */
      }
    }
  }, [canvas]);

  return (
    <button
      ref={ref}
      onClick={onClick}
      style={{
        display: 'block',
        textAlign: 'left',
        background: 'none',
        border: 0,
        padding: 0,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '3 / 2',
          borderRadius: 10,
          overflow: 'hidden',
          background: C.raise,
          outline: applied ? `2px solid ${C.spark}` : 'none',
        }}
      >
        {src ? (
          <img
            src={src}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : null}
        {applied ? (
          <span
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 17,
              height: 17,
              borderRadius: '50%',
              background: C.spark,
              color: '#fff',
              fontSize: 10,
              lineHeight: '17px',
              textAlign: 'center',
            }}
          >
            ✓
          </span>
        ) : null}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 12,
          color: applied ? C.ink : C.dim,
          fontWeight: applied ? 500 : 400,
        }}
      >
        {label}
      </div>
      {sublabel ? <div style={{ fontSize: 11, color: C.dim, marginTop: 1 }}>{sublabel}</div> : null}
    </button>
  );
}

/* ---------- a layer row in "Your stack" (decomposable: click → its controls) ---------- */
function StackRow({
  layer,
  active,
  onSelect,
  onRemove,
  onSetting,
}: {
  layer: EffectLayer;
  active: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onSetting: (settingId: string, value: number) => void;
}) {
  const settings = useMemo(() => getEffectSettings(layer.effectId), [layer.effectId]);
  return (
    <div style={{ padding: '9px 0', borderTop: `1px solid ${C.hair}` }}>
      <div
        onClick={onSelect}
        style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}
      >
        <span
          style={{
            color: C.dim,
            fontSize: 10,
            width: 10,
            transition: 'transform .15s',
            transform: active ? 'rotate(90deg)' : 'none',
          }}
        >
          ▸
        </span>
        <span style={{ flex: 1, fontWeight: 500, fontSize: 14, color: C.ink }}>
          {effectLabel(layer.effectId)}
        </span>
        <span
          onClick={e => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove"
          style={{ color: C.dim, fontSize: 13, padding: '0 4px', cursor: 'pointer' }}
        >
          ✕
        </span>
      </div>
      {active && settings.length > 0 ? (
        <div
          style={{ margin: '9px 0 4px 19px', paddingLeft: 13, borderLeft: `1px solid ${C.hair}` }}
        >
          {settings.map(s => (
            <div
              key={s.id}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '5px 0' }}
            >
              <span style={{ fontSize: 12.5, color: C.ink, width: 92, flex: '0 0 auto' }}>
                {s.label}
              </span>
              <Slider
                min={s.min}
                max={s.max}
                step={s.step}
                value={layer.settings[s.id] ?? s.defaultValue}
                onChange={v => onSetting(s.id, v)}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- a curated Look (multi-layer recipe) — name + blurb, no fake single-effect preview ---------- */
function LookCard({ look, onApply }: { look: Look; onApply: (l: Look) => void }) {
  return (
    <button
      onClick={() => onApply(look)}
      title={look.blurb}
      style={{
        textAlign: 'left',
        background: C.raise,
        border: 0,
        borderRadius: 10,
        padding: '12px 14px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>{look.name}</span>
      <span style={{ fontSize: 12, color: C.dim, lineHeight: 1.45 }}>{look.blurb}</span>
    </button>
  );
}

export default function StudioApp() {
  const selectedImage = useAppStore(state => state.selectedImage);
  const setSelectedImage = useAppStore(state => state.setSelectedImage);

  const {
    layers,
    activeLayerId,
    addLayer,
    removeLayer,
    setActiveLayer,
    updateLayerSettings,
    clearLayers,
    setStack,
  } = useEffectLayers();

  const imageEditorRef = useRef<ImageEditorHandle | null>(null);
  const appliedIds = useMemo(() => new Set(layers.map(l => l.effectId)), [layers]);

  const [query, setQuery] = useState('');
  const [chip, setChip] = useState(() =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('tab') === 'looks'
      ? 'Looks'
      : 'All'
  );
  const [fxCollapsed, setFxCollapsed] = useState(false);
  const [wildness, setWildness] = useState(0.42);
  const [moodId, setMoodId] = useState('faded');
  const [seed, setSeed] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [comparing, setComparing] = useState(false);

  /* image load */
  const handleImageUpload = useCallback(
    (file: File) => {
      clearLayers();
      const reader = new FileReader();
      reader.onload = e => {
        const url = e.target?.result as string;
        if (url?.startsWith('data:image/')) setSelectedImage(url);
      };
      reader.readAsDataURL(file);
    },
    [clearLayers, setSelectedImage]
  );
  const pickImage = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleImageUpload(file);
    };
    input.click();
  }, [handleImageUpload]);

  /* atomic effect: toggle add/remove, instant */
  const toggleEffect = useCallback(
    (effectId: string) => {
      const existing = layers.find(l => l.effectId === effectId);
      if (existing) removeLayer(existing.id);
      else addLayer(effectId);
    },
    [layers, addLayer, removeLayer]
  );

  /* a Look replaces the stack with its decomposable layers (real curated recipes from looks.ts) */
  const applyLook = useCallback(
    (look: Look) => {
      setSeed('');
      setStack(lookToStackLayers(look));
    },
    [setStack]
  );

  /* Surprise (mood + calm↔wild) */
  const handleSurprise = useCallback(() => {
    const s = randSeed();
    setSeed(s);
    setStack(compose(s, moodId, [], wildness).layers);
  }, [moodId, wildness, setStack]);
  const handleMood = useCallback(
    (id: string) => {
      setMoodId(id);
      if (layers.length) {
        const s = randSeed();
        setSeed(s);
        setStack(compose(s, id, [], wildness).layers);
      }
    },
    [layers.length, wildness, setStack]
  );
  const handleWildness = useCallback(
    (w: number) => {
      setWildness(w);
      if (seed && layers.length) setStack(compose(seed, moodId, [], w).layers);
    },
    [seed, moodId, layers.length, setStack]
  );

  /* export */
  const handleExport = useCallback((format: 'png' | 'jpeg') => {
    imageEditorRef.current?.exportImage({ format, quality: 0.95 });
    setShowExport(false);
  }, []);

  /* dev-only: /studio?demo loads a sample + a couple effects (StrictMode-guarded). */
  const demoRan = useRef(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const demo = new URLSearchParams(window.location.search).get('demo');
    if (demo === null) return;
    if (selectedImage || demoRan.current) return;
    demoRan.current = true;
    fetch('/studio-sample.jpg')
      .then(r => r.blob())
      .then(b => {
        const fr = new FileReader();
        fr.onload = () => {
          setSelectedImage(fr.result as string);
          if (demo.startsWith('look:')) {
            const look = getLook(demo.slice(5));
            if (look) setTimeout(() => applyLook(look), 60);
          } else if (demo !== 'blank')
            setTimeout(() => {
              addLayer('unifiedVintage');
              addLayer('noise');
            }, 60);
        };
        fr.readAsDataURL(b);
      })
      .catch(() => {});
  }, []);

  const filteredEffects = useMemo(
    () =>
      ALL.filter(e => chip === 'All' || e.cat === chip).filter(
        e => !query || effectLabel(e.id).toLowerCase().includes(query.toLowerCase())
      ),
    [chip, query]
  );
  const filteredLooks = useMemo(() => {
    const q = query.toLowerCase();
    return LOOKS.filter(
      l => !q || l.name.toLowerCase().includes(q) || l.tags.some(t => t.includes(q))
    );
  }, [query]);
  const totalCount = ALL.length;

  /* ---------- intro / upload ---------- */
  if (!selectedImage) {
    return (
      <div
        style={{
          height: '100vh',
          background: C.void,
          color: C.ink,
          fontFamily: FONT,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 26,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 76, letterSpacing: '-0.04em' }}>
          HAX<span style={{ color: C.spark }}>.</span>
        </div>
        <div style={{ fontSize: 13, color: C.dim }}>real-time image effects</div>
        <button
          onClick={pickImage}
          style={{
            marginTop: 6,
            background: C.spark,
            color: C.ink,
            border: 0,
            borderRadius: 12,
            padding: '12px 24px',
            fontSize: 15,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          Choose Image
        </button>
      </div>
    );
  }

  /* ---------- editor ---------- */
  return (
    <div
      style={{
        height: '100vh',
        background: C.void,
        color: C.ink,
        fontFamily: FONT,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* topbar */}
      <header
        style={{
          height: 54,
          flex: '0 0 54px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 22px',
          position: 'relative',
          zIndex: 40,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 21, letterSpacing: '-0.03em' }}>
          HAX<span style={{ color: C.spark }}>.</span>
        </div>
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => setShowExport(true)}
          onMouseLeave={() => setShowExport(false)}
        >
          <button
            style={{
              background: 'none',
              border: 0,
              color: C.ink,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              padding: '8px 14px',
              borderRadius: 10,
              fontFamily: FONT,
            }}
          >
            Export
          </button>
          {showExport ? (
            <div
              style={{
                position: 'absolute',
                top: 40,
                right: 0,
                width: 226,
                background: '#141416',
                border: `1px solid ${C.hair}`,
                borderRadius: 10,
                padding: 7,
                boxShadow: '0 18px 50px rgba(0,0,0,.6)',
              }}
            >
              <div onClick={() => handleExport('png')} style={popOpt}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>PNG</span>
                <span style={{ fontSize: 11, color: C.dim }}>lossless</span>
              </div>
              <div onClick={() => handleExport('jpeg')} style={popOpt}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>JPEG</span>
                <span style={{ fontSize: 11, color: C.dim }}>smaller file</span>
              </div>
              <div
                style={{
                  padding: '9px 11px 4px',
                  marginTop: 4,
                  borderTop: `1px solid ${C.hair}`,
                  fontSize: 11,
                  color: C.dim,
                }}
              >
                highest resolution
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* centered contained canvas */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 36px',
          }}
          onPointerDown={() => layers.length && setComparing(true)}
          onPointerUp={() => setComparing(false)}
          onPointerLeave={() => setComparing(false)}
        >
          <ImageEditor
            ref={imageEditorRef}
            selectedImage={selectedImage}
            effectLayers={comparing ? [] : layers}
            hideExport
          />
          {layers.length > 0 ? (
            <div
              style={{
                position: 'absolute',
                bottom: 18,
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: 11,
                color: C.dim,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {comparing ? 'Original' : 'Hold to compare'}
            </div>
          ) : null}
        </div>

        {/* the one control panel */}
        <aside
          style={{
            flex: '0 0 392px',
            background: C.panel,
            borderLeft: `1px solid ${C.hair}`,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          {/* Your stack — sizes to its layers (own scroll past the cap); fills all
              remaining space only when the Effects menu is collapsed. */}
          <div
            className="studio-scroll"
            style={{
              flex: fxCollapsed ? '1 1 auto' : '0 0 auto',
              maxHeight: fxCollapsed ? 'none' : '54%',
              overflow: 'auto',
              padding: '18px 20px 12px',
              borderBottom: `1px solid ${C.hair}`,
              minHeight: 96,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 8,
              }}
            >
              <span style={{ fontWeight: 500, fontSize: 12, color: C.dim }}>Your stack</span>
              <span style={{ fontSize: 11, color: C.dim }}>
                {layers.length === 0
                  ? 'empty'
                  : `${layers.length} effect${layers.length > 1 ? 's' : ''}`}
              </span>
            </div>
            {layers.length === 0 ? (
              <div style={{ padding: '2px 0 4px' }}>
                <div style={{ fontSize: 13, color: C.dim, marginBottom: 9 }}>
                  Start with a look —
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {STARTER_LOOKS.map(id => {
                    const look = getLook(id);
                    return look ? (
                      <button
                        key={id}
                        onClick={() => applyLook(look)}
                        title={look.blurb}
                        style={starterChip}
                      >
                        {look.name}
                      </button>
                    ) : null;
                  })}
                  <button onClick={handleSurprise} style={{ ...starterChip, background: C.spark }}>
                    Surprise me
                  </button>
                </div>
              </div>
            ) : (
              layers.map(layer => (
                <StackRow
                  key={layer.id}
                  layer={layer}
                  active={layer.id === activeLayerId}
                  onSelect={() => setActiveLayer(layer.id === activeLayerId ? '' : layer.id)}
                  onRemove={() => removeLayer(layer.id)}
                  onSetting={(sid, v) => updateLayerSettings(layer.id, sid, v)}
                />
              ))
            )}
          </div>

          {/* Effects + Looks menu (collapsible) */}
          <div
            style={{
              flex: fxCollapsed ? '0 0 auto' : '1 1 auto',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              padding: '13px 20px 0',
            }}
          >
            <div
              onClick={() => setFxCollapsed(c => !c)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontWeight: 500, fontSize: 12, color: C.dim }}>
                <span
                  style={{
                    display: 'inline-block',
                    marginRight: 7,
                    transform: fxCollapsed ? 'none' : 'rotate(90deg)',
                    transition: 'transform .15s',
                  }}
                >
                  ▸
                </span>
                {chip === 'Looks' ? 'Looks' : 'Effects'}
              </span>
              <span style={{ fontSize: 11, color: C.dim }}>
                {chip === 'Looks' ? LOOKS.length : totalCount}
              </span>
            </div>
            {!fxCollapsed ? (
              <div
                style={{
                  flex: '1 1 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  marginTop: 11,
                }}
              >
                <input
                  className="studio-input"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={chip === 'Looks' ? 'Search looks' : `Search ${totalCount} effects`}
                  style={{
                    background: C.raise,
                    border: 0,
                    outline: 'none',
                    borderRadius: 10,
                    padding: '0 12px',
                    height: 34,
                    color: C.ink,
                    fontSize: 13,
                    marginBottom: 11,
                    fontFamily: FONT,
                  }}
                />
                <div
                  className="studio-scroll"
                  style={{
                    display: 'flex',
                    gap: 6,
                    overflowX: 'auto',
                    marginBottom: 13,
                    paddingBottom: 2,
                  }}
                >
                  {CATS.map(c => (
                    <button
                      key={c}
                      onClick={() => setChip(c)}
                      style={{
                        flex: '0 0 auto',
                        fontSize: 12,
                        fontWeight: 500,
                        fontFamily: FONT,
                        color: chip === c ? C.ink : C.dim,
                        background: chip === c ? C.raise : 'none',
                        border: 0,
                        borderRadius: 999,
                        padding: '7px 11px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div
                  className="studio-scroll"
                  style={{
                    flex: 1,
                    overflow: 'auto',
                    display: 'grid',
                    gridTemplateColumns: chip === 'Looks' ? '1fr' : '1fr 1fr',
                    gap: 11,
                    paddingBottom: 12,
                    alignContent: 'start',
                  }}
                >
                  {chip === 'Looks'
                    ? filteredLooks.map(look => (
                        <LookCard key={look.id} look={look} onApply={applyLook} />
                      ))
                    : filteredEffects.map(e => (
                        <Tile
                          key={e.id}
                          previewId={e.id}
                          imageUrl={selectedImage}
                          label={effectLabel(e.id)}
                          applied={appliedIds.has(e.id)}
                          onClick={() => toggleEffect(e.id)}
                        />
                      ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Compose footer — mood + Surprise + calm↔wild */}
          <div
            style={{
              flex: '0 0 auto',
              borderTop: `1px solid ${C.hair}`,
              padding: '12px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 11,
            }}
          >
            <div className="studio-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {MOOD_IDS.map(m => (
                <button key={m} onClick={() => handleMood(m)} style={moodChipStyle(m === moodId)}>
                  {cap(m)}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <button
                onClick={handleSurprise}
                style={{
                  flex: '0 0 auto',
                  background: C.spark,
                  color: C.ink,
                  border: 0,
                  borderRadius: 10,
                  height: 36,
                  padding: '0 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: FONT,
                  boxShadow: '0 4px 16px rgba(245,48,1,.22)',
                }}
              >
                Surprise
              </button>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontSize: 11, color: C.dim }}>calm</span>
                <Slider min={0} max={1} step={0.01} value={wildness} onChange={handleWildness} />
                <span style={{ fontSize: 11, color: C.dim }}>wild</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

const popOpt: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '9px 11px',
  borderRadius: 8,
  cursor: 'pointer',
};

const starterChip: React.CSSProperties = {
  background: C.raise,
  color: C.ink,
  border: 0,
  borderRadius: 10,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: FONT,
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function moodChipStyle(active: boolean): React.CSSProperties {
  return {
    flex: '0 0 auto',
    fontSize: 12,
    fontWeight: 500,
    fontFamily: FONT,
    color: active ? C.ink : C.dim,
    background: active ? C.raise : 'none',
    border: 0,
    borderRadius: 999,
    padding: '6px 11px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}
