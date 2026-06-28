'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { effectsConfig, getEffectCategory } from '@/lib/effects';
import {
  Layers,
  FileImage,
  Film,
  Monitor,
  X,
  Plus,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EffectLayer {
  id: string;
  effectId: string;
  settings: Record<string, number>;
  visible: boolean;
  opacity?: number;
  locked?: boolean;
}

interface SettingDef {
  id: string;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
  step: number;
  description?: string;
  group?: string;
}

interface AppleControlsPanelProps {
  activeEffect?: string | null;
  effectLayers?: EffectLayer[];
  effectSettings?: Record<string, number>;
  onSettingChange?: (settingName: string, value: number) => void;
  onLayerSettingChange?: (layerId: string, settingName: string, value: number) => void;
  onLayerOpacityChange?: (layerId: string, opacity: number) => void;
  onExport?: (format: string, quality?: number) => void;
  onEstimateFileSize?: (format: 'png' | 'jpeg', quality?: number) => Promise<number>;
  onResetSettings?: () => void;
  onClearAllEffects?: () => void;
  onRemoveEffect?: (layerId: string) => void;
  onToggleLayerLock?: (layerId: string) => void;
  onSetActiveLayer?: (layerId: string) => void;
  onToggleLayerVisibility?: (layerId: string) => void;
  onReorderLayers?: (fromIndex: number, toIndex: number) => void;
  onNewImage?: () => void;
  hasImage?: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
}

const PRESET_KEYS = new Set(['preset', 'style']);

// Custom Hex Color Input
const HexColorInput: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
}> = ({ label, value, onChange }) => {
  const decimalToHex = (d: number): string =>
    '#' + (d >>> 0).toString(16).padStart(6, '0').slice(-6);
  const hexToDecimal = (hex: string): number => parseInt(hex.replace('#', ''), 16);
  const [hexValue, setHexValue] = useState(decimalToHex(value));

  useEffect(() => {
    setHexValue(decimalToHex(value));
  }, [value]);

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
        <span className="text-[11px] font-mono text-muted-foreground">
          {hexValue.toUpperCase()}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={hexValue}
          onChange={e => {
            setHexValue(e.target.value);
            onChange(hexToDecimal(e.target.value));
          }}
          className="w-9 h-8 rounded-md cursor-pointer bg-transparent border border-border"
        />
        <input
          type="text"
          value={hexValue}
          onChange={e => {
            setHexValue(e.target.value);
            if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) onChange(hexToDecimal(e.target.value));
          }}
          placeholder="#000000"
          className="flex-1 px-2.5 py-1.5 text-xs rounded-md bg-muted/40 border border-border text-foreground focus:border-ring outline-none font-mono"
        />
      </div>
    </div>
  );
};

// One control row — slider, named-preset grid, or hex color.
const SettingRow: React.FC<{
  setting: SettingDef;
  value: number;
  presetNames?: string[];
  onChange: (v: number) => void;
}> = ({ setting, value, presetNames, onChange }) => {
  const lower = setting.label.toLowerCase();
  const isHex = lower.includes('color') && lower.includes('hex');
  if (isHex) {
    return <HexColorInput label={setting.label} value={value} onChange={onChange} />;
  }

  const isPreset = PRESET_KEYS.has(setting.id) && !!presetNames && presetNames.length > 0;
  if (isPreset) {
    return (
      <div className="py-1.5" title={setting.description}>
        <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">
          {setting.label}
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {presetNames!.map((name, i) => {
            const active = Math.round(value) === i;
            return (
              <button
                key={name}
                onClick={() => onChange(i)}
                className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-colors text-left truncate"
                style={
                  active
                    ? {
                        color: '#FF6A42',
                        border: '1px solid #F53001',
                        background: 'rgba(245,48,1,.12)',
                      }
                    : {
                        color: '#A8A49A',
                        border: '1px solid rgba(255,255,255,.1)',
                        background: 'rgba(255,255,255,.03)',
                      }
                }
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="py-1.5" title={setting.description}>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] font-medium text-muted-foreground">{setting.label}</label>
        <span className="text-[11px] font-mono text-muted-foreground">
          {value.toFixed(setting.step < 1 ? 2 : 0)}
        </span>
      </div>
      <Slider
        min={setting.min}
        max={setting.max}
        step={setting.step}
        value={[value]}
        onValueChange={v => onChange(v[0])}
        className="w-full"
      />
    </div>
  );
};

// One effect's full control card in the unified stack.
const EffectCard: React.FC<{
  layer: EffectLayer;
  index: number;
  onLayerSettingChange?: (layerId: string, settingName: string, value: number) => void;
  onLayerOpacityChange?: (layerId: string, opacity: number) => void;
  onRemoveEffect?: (layerId: string) => void;
  onToggleLayerLock?: (layerId: string) => void;
  onToggleLayerVisibility?: (layerId: string) => void;
}> = ({
  layer,
  index,
  onLayerSettingChange,
  onLayerOpacityChange,
  onRemoveEffect,
  onToggleLayerLock,
  onToggleLayerVisibility,
}) => {
  const cfg = effectsConfig[layer.effectId];
  const settings = (cfg?.settings as SettingDef[] | undefined) || [];
  const presetNames = (cfg as { presetNames?: string[] } | undefined)?.presetNames;
  const opacity = layer.opacity ?? 1;
  const hidden = layer.visible === false;

  return (
    <div className="glass-card p-3" style={{ opacity: hidden ? 0.5 : 1 }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[10px] font-mono text-muted-foreground w-4 text-center flex-shrink-0"
            title={`Layer ${index + 1}`}
          >
            {index + 1}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate leading-tight">
              {cfg?.label || layer.effectId}
            </h3>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {getEffectCategory(layer.effectId) ?? cfg?.category ?? ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => onToggleLayerVisibility?.(layer.id)}
            className="glass-button p-1.5"
            aria-label={
              hidden ? `Show ${cfg?.label || 'effect'}` : `Hide ${cfg?.label || 'effect'}`
            }
            aria-pressed={!hidden}
            title={hidden ? 'Show' : 'Hide'}
          >
            {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onToggleLayerLock?.(layer.id)}
            className="glass-button p-1.5"
            aria-label={
              layer.locked ? `Unlock ${cfg?.label || 'effect'}` : `Lock ${cfg?.label || 'effect'}`
            }
            aria-pressed={!!layer.locked}
            title={layer.locked ? 'Locked — kept on reroll' : 'Lock this layer'}
            style={layer.locked ? { color: '#F53001' } : undefined}
          >
            {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onRemoveEffect?.(layer.id)}
            className="glass-button p-1.5"
            aria-label={`Remove ${cfg?.label || 'effect'}`}
            title="Remove effect"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Settings */}
      {settings.length > 0 ? (
        settings.map(s => (
          <SettingRow
            key={s.id}
            setting={s}
            value={layer.settings[s.id] ?? s.defaultValue}
            presetNames={presetNames}
            onChange={v => onLayerSettingChange?.(layer.id, s.id, v)}
          />
        ))
      ) : (
        <p className="text-[11px] text-muted-foreground py-1">No adjustable settings.</p>
      )}

      {/* Per-layer opacity + reset */}
      <div className="pt-2 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] font-medium text-muted-foreground">Layer opacity</label>
          <span className="text-[11px] font-mono text-muted-foreground">{opacity.toFixed(2)}</span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[opacity]}
          onValueChange={v => onLayerOpacityChange?.(layer.id, v[0])}
          className="w-full"
        />
        {settings.length > 0 && (
          <button
            onClick={() =>
              settings.forEach(s => onLayerSettingChange?.(layer.id, s.id, s.defaultValue))
            }
            className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset values
          </button>
        )}
      </div>
    </div>
  );
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const AppleControlsPanel: React.FC<AppleControlsPanelProps> = ({
  activeEffect,
  effectLayers = [],
  onLayerSettingChange,
  onLayerOpacityChange,
  onExport,
  onEstimateFileSize,
  onClearAllEffects,
  onRemoveEffect,
  onToggleLayerLock,
  onSetActiveLayer,
  onToggleLayerVisibility,
  onReorderLayers,
  onNewImage,
  hasImage = false,
  isCollapsed,
}) => {
  const [activeTab, setActiveTab] = useState<string>('settings');
  const dragFromIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [jpegQuality, setJpegQuality] = useState(95);
  const [estimatedJpegSize, setEstimatedJpegSize] = useState<number | null>(null);
  const [estimatedPngSize, setEstimatedPngSize] = useState<number | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  useEffect(() => {
    if (activeTab !== 'export' || !hasImage || !onEstimateFileSize) return;
    let cancelled = false;
    (async () => {
      setIsEstimating(true);
      try {
        const [pngSize, jpegSize] = await Promise.all([
          onEstimateFileSize('png'),
          onEstimateFileSize('jpeg', jpegQuality),
        ]);
        if (!cancelled) {
          setEstimatedPngSize(pngSize);
          setEstimatedJpegSize(jpegSize);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setIsEstimating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, hasImage, onEstimateFileSize, jpegQuality]);

  if (isCollapsed) return null;

  const effectCount = effectLayers.length;

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold">Controls</h2>
      </div>

      {/* Tabs */}
      <div className="px-3 pb-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="settings">Effects</TabsTrigger>
            <TabsTrigger value="layers">Order</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="new" onClick={() => onNewImage?.()} className="px-2 flex-shrink-0">
              <Plus className="w-4 h-4" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-6">
        <AnimatePresence mode="wait" initial={false}>
          {/* ===== Unified editable effects stack ===== */}
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              {!hasImage ? (
                <div className="text-center text-xs text-muted-foreground py-12">
                  Upload an image to start
                </div>
              ) : effectCount === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-14 h-14 mx-auto mb-3 flex items-center justify-center liquid-material">
                    <SlidersHorizontal className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm mb-1">No effects yet</p>
                  <p className="text-xs text-muted-foreground max-w-[210px] mx-auto">
                    Tap a preview tile, or hit{' '}
                    <span style={{ color: '#F53001', fontWeight: 600 }}>Surprise me</span> below the
                    canvas. Every effect you add shows up here, editable together.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] text-muted-foreground">
                      {effectCount} effect{effectCount === 1 ? '' : 's'} on this image
                    </span>
                    {effectCount > 1 && (
                      <button
                        onClick={() => onClearAllEffects?.()}
                        className="text-[11px] transition-colors"
                        style={{ color: '#F53001' }}
                        title="Remove all effects"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {effectLayers.map((layer, index) => (
                    <EffectCard
                      key={layer.id}
                      layer={layer}
                      index={index}
                      onLayerSettingChange={onLayerSettingChange}
                      onLayerOpacityChange={onLayerOpacityChange}
                      onRemoveEffect={onRemoveEffect}
                      onToggleLayerLock={onToggleLayerLock}
                      onToggleLayerVisibility={onToggleLayerVisibility}
                    />
                  ))}
                </>
              )}
            </motion.div>
          )}

          {/* ===== Order (drag to reorder) ===== */}
          {activeTab === 'layers' && (
            <motion.div
              key="layers"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {!hasImage ? (
                <div className="text-center text-xs text-muted-foreground py-12">
                  Upload an image to manage layers
                </div>
              ) : effectCount === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-3 flex items-center justify-center liquid-material">
                    <Layers className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <p className="text-sm mb-1">No effect layers yet</p>
                  <p className="text-xs text-muted-foreground">Apply an effect to create a layer</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-muted-foreground mb-1 px-0.5">
                    Drag to reorder the render stack
                  </p>
                  {effectLayers.map((layer, index) => {
                    const cfg = effectsConfig[layer.effectId];
                    const isActive = layer.id === activeEffect;
                    return (
                      <div
                        key={layer.id}
                        onClick={() => onSetActiveLayer?.(layer.id)}
                        draggable={!!onReorderLayers}
                        onDragStart={e => {
                          if (!onReorderLayers) return;
                          dragFromIndexRef.current = index;
                          setDragOverIndex(null);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', layer.id);
                        }}
                        onDragOver={e => {
                          if (!onReorderLayers) return;
                          e.preventDefault();
                          if (dragOverIndex !== index) setDragOverIndex(index);
                        }}
                        onDragLeave={() => {
                          if (!onReorderLayers) return;
                          if (dragOverIndex === index) setDragOverIndex(null);
                        }}
                        onDrop={e => {
                          if (!onReorderLayers) return;
                          e.preventDefault();
                          const fromIndex = dragFromIndexRef.current;
                          dragFromIndexRef.current = null;
                          setDragOverIndex(null);
                          if (fromIndex === null || fromIndex === index) return;
                          onReorderLayers(fromIndex, index);
                        }}
                        onDragEnd={() => {
                          dragFromIndexRef.current = null;
                          setDragOverIndex(null);
                        }}
                        className="glass-card p-3 cursor-grab active:cursor-grabbing flex items-center justify-between"
                        style={
                          dragOverIndex === index
                            ? { boxShadow: 'inset 0 0 0 1px rgba(245,48,1,.5)' }
                            : isActive
                              ? { boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.18)' }
                              : undefined
                        }
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-mono text-muted-foreground w-4 text-center">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-sm font-medium truncate">
                              {cfg?.label || 'Unknown Effect'}
                            </h4>
                            <p className="text-[10px] text-muted-foreground">
                              {getEffectCategory(layer.effectId) ?? cfg?.category ?? ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onToggleLayerVisibility?.(layer.id);
                            }}
                            className="glass-button p-1.5"
                            title={layer.visible === false ? 'Show' : 'Hide'}
                          >
                            {layer.visible === false ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onRemoveEffect?.(layer.id);
                            }}
                            className="glass-button p-1.5"
                            title="Remove"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ===== Export ===== */}
          {activeTab === 'export' && (
            <motion.div
              key="export"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              {/* PNG */}
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-8 h-8 flex items-center justify-center mr-3 liquid-material">
                      <FileImage className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-medium">PNG</div>
                      <div className="text-[10px] text-muted-foreground">
                        Lossless, best quality
                      </div>
                    </div>
                  </div>
                  {estimatedPngSize !== null && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {isEstimating ? '…' : formatFileSize(estimatedPngSize)}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onExport?.('PNG')}
                  disabled={!hasImage}
                  className="w-full py-2 text-xs font-medium glass-button disabled:opacity-50"
                >
                  Export PNG
                </button>
              </div>

              {/* JPEG */}
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-8 h-8 flex items-center justify-center mr-3 liquid-material">
                      <FileImage className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-medium">JPEG</div>
                      <div className="text-[10px] text-muted-foreground">Adjustable quality</div>
                    </div>
                  </div>
                  {estimatedJpegSize !== null && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {isEstimating ? '…' : formatFileSize(estimatedJpegSize)}
                    </span>
                  )}
                </div>
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-muted-foreground">Quality</label>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {jpegQuality}%
                    </span>
                  </div>
                  <Slider
                    min={10}
                    max={100}
                    step={5}
                    value={[jpegQuality]}
                    onValueChange={v => setJpegQuality(v[0])}
                    className="w-full"
                  />
                </div>
                <button
                  onClick={() => onExport?.('JPG', jpegQuality)}
                  disabled={!hasImage}
                  className="w-full py-2 text-xs font-medium glass-button disabled:opacity-50"
                >
                  Export JPEG
                </button>
              </div>

              {/* GIF / WEBM — honestly disabled */}
              <div className="space-y-2">
                {[
                  { type: 'GIF', desc: 'Animated format', icon: Film },
                  { type: 'WEBM', desc: 'Video', icon: Monitor },
                ].map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      disabled
                      title="Animated GIF/WEBM export isn't available yet"
                      aria-disabled="true"
                      className="w-full p-3 text-left glass-card opacity-50 cursor-not-allowed flex items-center"
                    >
                      <div className="w-8 h-8 flex items-center justify-center mr-3 liquid-material">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-medium">{opt.type}</div>
                        <div className="text-[10px] text-muted-foreground">{opt.desc}</div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 glass-badge">Soon</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AppleControlsPanel;
