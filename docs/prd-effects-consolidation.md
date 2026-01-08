# PRD: Effects Consolidation

## Status: ✅ COMPLETED (Phase 1 & 2)

## Overview

Consolidate ~103 individual effects into ~53 visible effects with rich preset systems and granular controls. This improves UX by reducing clutter while giving users more control.

### Results Summary

- **Before:** 103 effects in UI
- **After:** 53 effects in UI (49% reduction)
- **Functionality:** 100% preserved via unified presets + legacy aliases
- **New "Studios" category:** 9 unified effects with 50+ presets combined

## Current State

**Total Effects: 103**

### By Category:

- **Adjust (7):** brightness, contrast, saturation, hue, dehaze, relight, colorTemperature
- **Blur & Focus (5):** blur, sharpen, bokeh, depthBlur, tiltShiftMiniature
- **Artistic (37):** unifiedSketch, unifiedPattern, stippling, pencilSketch, watercolor, oilPainting, toon, posterEdges, cutout, stainedGlass, doubleExposure, halftone, crosshatch, dotScreen, crystallize, paperCutArt, retroDithering, advancedDithering, atkinsonDithering, orderedDithering, blueNoiseDithering, halftonePattern, retroPalette, topographicContours, weavePattern, neonGlowEdges, iridescentSheen, chromaticGrain, halationGlow, etchedLines, inkWash, retroRaster, crystalFacet, thermalPalette, paperRelief, inkOutlinePop
- **Color (13):** unifiedMono, blackAndWhite, grayscale, sepia, invert, duotone, gradientMap, toneCurve, cinematicLut, holographicInterference, selectiveColor, colorQuantization, heatmap
- **Distort (9):** pixelate, swirl, kaleidoscope, kaleidoscopeFracture, fisheyeWarp, pixelExplosion, chromaticGlitch, databending, dispersionShatter
- **Simulate (10):** liquidMetal, neuralDream, magneticField, inkBleed, vignette, chromaticAberration, scanLines, scratchedFilm, anaglyph, bioluminescence
- **Overlay (8):** noise, threshold, posterize, oldPhoto, lensFlare, edgeDetection, fractalNoise, circuitBoard
- **Mathematical (3):** mandelbrot, juliaSet, voronoi
- **Other:** glitchArt, rgbShift, pixelSort, asciiArt, mosaic, bloom, unifiedGlow, geometric, cellular, orton, temporalEcho, etc.

---

## Target State: 18 Unified Effects

### 1. **Basic Adjustments** (Keep Separate - 6 effects)

Keep these as individual sliders for quick access:

- Brightness
- Contrast
- Saturation
- Hue
- Color Temperature
- Exposure/Relight

### 2. **Unified Blur** (Consolidate 5 → 1)

**Presets:**

- Gaussian (simple blur)
- Bokeh (lens blur with shape)
- Depth/Tilt-Shift (selective focus)
- Motion (directional blur)
- Radial (zoom blur)

**Controls:**

- Radius/Amount (0-50)
- Preset selector (0-4)
- Focus Point X/Y (for depth modes)
- Bokeh Shape (circle, hexagon, star)
- Angle (for motion/radial)

**Removes:** blur, bokeh, depthBlur, tiltShiftMiniature

### 3. **Unified Sharpen** (Consolidate 2 → 1)

**Presets:**

- Basic Sharpen
- Unsharp Mask
- Smart Sharpen (edge-aware)
- High Pass

**Controls:**

- Amount (0-200%)
- Radius (0.5-10)
- Threshold (0-255)
- Edge Protection (0-1)

**Removes:** sharpen, smartSharpen

### 4. **Unified Sketch** ✅ EXISTS - Expand

**Presets:**

- Pencil
- Crosshatch
- Etched Lines
- Ink Wash
- Bold Outline
- Charcoal
- Conte Crayon

**Controls:**

- Style selector (0-6)
- Line Weight (1-10)
- Density (0-1)
- Contrast (0.5-2)
- Paper Texture (0-1)
- Invert (toggle)

**Removes:** pencilSketch, crosshatch, etchedLines, inkWash, inkOutlinePop

### 5. **Unified Pattern** ✅ EXISTS - Expand

**Presets:**

- Halftone Dots
- Screen
- Stipple
- Weave
- Circuit
- Cellular/Voronoi
- Mosaic

**Controls:**

- Pattern selector (0-6)
- Size (2-50)
- Density (0-1)
- Angle (0-90)
- Color Mode (B&W / Color)
- Randomness (0-1)

**Removes:** halftone, dotScreen, stippling, weavePattern, cellular, voronoi, mosaic, circuitBoard

### 6. **Unified Glow** ✅ EXISTS - Expand

**Presets:**

- Bloom (bright areas glow)
- Dreamy/Orton (soft romantic)
- Neon (edge glow with color)
- Bioluminescence (organic glow)
- Halation (film highlight bleed)
- Lens Flare

**Controls:**

- Preset selector (0-5)
- Intensity (0-1)
- Radius (1-50)
- Threshold (0-1)
- Color Shift (0-1)
- Blend Mode (screen/add/overlay)

**Removes:** bloom, neonGlowEdges, halationGlow, bioluminescence, orton, lensFlare

### 7. **Unified Dithering** (Consolidate 8 → 1)

**Presets:**

- Floyd-Steinberg
- Atkinson (Mac classic)
- Ordered/Bayer (geometric)
- Stucki (high quality)
- Sierra
- Blue Noise (organic)

**Palette Options:**

- B&W (1-bit)
- Grayscale (2-8 levels)
- Custom Levels (2-256)
- Game Boy
- CGA
- EGA
- C64
- NES
- Macintosh

**Controls:**

- Algorithm selector (0-5)
- Palette selector (0-8)
- Color Levels (2-256)
- Threshold (0-1)
- Pattern Scale (1-8)
- Contrast Boost (0-2)

**Removes:** retroDithering, advancedDithering, atkinsonDithering, orderedDithering, blueNoiseDithering, halftonePattern, retroPalette, colorQuantization

### 8. **Unified Glitch** (Consolidate 7 → 1)

**Presets:**

- RGB Shift
- Chromatic Aberration
- Scanlines
- VHS/Analog
- Digital Corruption
- Databend
- Pixel Sort

**Controls:**

- Style selector (0-6)
- Intensity (0-1)
- Offset/Shift (0-50px)
- Direction (horizontal/vertical/both)
- Block Size (for corruption)
- Randomness (0-1)
- Color Channels (R/G/B toggles)

**Removes:** glitchArt, chromaticGlitch, rgbShift, databending, pixelSort, chromaticAberration, scanLines

### 9. **Unified Vintage** (Consolidate 6 → 1)

**Presets:**

- Sepia
- Old Photo
- Faded Film
- Cross Process
- Scratched Film
- Instant/Polaroid

**Controls:**

- Style selector (0-5)
- Intensity (0-1)
- Vignette (0-1)
- Grain/Noise (0-1)
- Scratches (0-1)
- Color Fade (0-1)
- Warmth (cool-warm)

**Removes:** sepia, oldPhoto, scratchedFilm, retroRaster, cinematicLut, vignette

### 10. **Unified Mono** ✅ EXISTS - Expand

**Presets:**

- Grayscale (luminance)
- B&W High Contrast
- Duotone
- Gradient Map
- Infrared
- Cyanotype

**Controls:**

- Style selector (0-5)
- Contrast (0.5-2)
- Brightness (-50 to +50)
- Shadow Color (for duotone)
- Highlight Color (for duotone)
- Gradient (for gradient map)

**Removes:** grayscale, blackAndWhite, duotone, gradientMap, heatmap, thermalPalette

### 11. **Unified Warp** (Consolidate 8 → 1)

**Presets:**

- Pixelate
- Swirl
- Kaleidoscope
- Fisheye
- Spherize
- Pinch/Bulge
- Wave/Ripple
- Shatter

**Controls:**

- Style selector (0-7)
- Amount/Intensity (0-1)
- Center X/Y (0-1)
- Segments (for kaleidoscope: 2-16)
- Radius (for localized effects)
- Direction (CW/CCW)

**Removes:** pixelate, swirl, kaleidoscope, kaleidoscopeFracture, fisheyeWarp, pixelExplosion, dispersionShatter, geometric

### 12. **Unified Color Grade** (Consolidate 5 → 1)

**Presets:**

- Warm/Cool
- Selective Color
- Split Toning
- Color Balance
- Channel Mixer

**Controls:**

- Preset selector (0-4)
- Temperature (-100 to +100)
- Tint (-100 to +100)
- Shadow Hue/Saturation
- Highlight Hue/Saturation
- Vibrance (0-1)

**Removes:** colorTemperature, selectiveColor, toneCurve

### 13. **Unified Stylize** (Artistic effects - Consolidate 8 → 1)

**Presets:**

- Watercolor
- Oil Painting
- Toon/Cartoon
- Poster Edges
- Cutout
- Stained Glass
- Paper Cut
- Crystallize

**Controls:**

- Style selector (0-7)
- Detail Level (1-10)
- Edge Strength (0-1)
- Color Simplification (2-32 colors)
- Smoothness (0-1)

**Removes:** watercolor, oilPainting, toon, posterEdges, cutout, stainedGlass, paperCutArt, crystallize, crystalFacet

### 14. **Unified Texture** (Consolidate 5 → 1)

**Presets:**

- Paper/Canvas
- Film Grain
- Noise
- Fractal
- Topographic

**Controls:**

- Style selector (0-4)
- Intensity (0-1)
- Scale (1-100)
- Color (mono/color)
- Blend Mode

**Removes:** noise, fractalNoise, topographicContours, paperRelief, chromaticGrain

### 15. **Unified Edge** (Consolidate 4 → 1)

**Presets:**

- Edge Detection (Sobel)
- Emboss
- Relief
- Outline Only

**Controls:**

- Style selector (0-3)
- Strength (0-1)
- Thickness (1-5)
- Invert (toggle)
- Color (mono/original)

**Removes:** edgeDetection, posterEdges (edge component)

### 16. **Special Effects** (Keep unique complex effects)

These are unique enough to keep separate:

- Double Exposure
- Anaglyph 3D
- Holographic
- Iridescent
- Liquid Metal
- Neural Dream
- Magnetic Field
- ASCII Art

### 17. **Overlay Effects** (Keep separate)

- Vignette (simple, commonly used)
- Light Leak (if added)

### 18. **3D Effects** (Keep separate - already isolated)

- 3D Plane
- 3D Cube
- 3D Tilt
- 3D Parallax

---

## Implementation Plan

### Phase 1: Core Unified Effects (Priority)

1. ✅ Unified Dithering (already has advancedDithering - consolidate others)
2. Unified Glitch (new)
3. Unified Vintage (new)
4. Unified Warp (new)
5. Unified Blur (new)

### Phase 2: Expand Existing Unified Effects

6. Expand Unified Sketch (add missing styles)
7. Expand Unified Pattern (add missing patterns)
8. Expand Unified Glow (add missing presets)
9. Expand Unified Mono (add missing modes)

### Phase 3: New Unified Effects

10. Unified Stylize (new)
11. Unified Color Grade (new)
12. Unified Texture (new)
13. Unified Edge (new)
14. Unified Sharpen (new)

### Phase 4: Cleanup

15. Remove all redundant individual effects
16. Update effect categories
17. Update UI to show presets nicely
18. Test everything

---

## UI Considerations

### Effect Card Design

Each unified effect should show:

1. **Preset thumbnails** - Visual preview of each preset
2. **Quick preset buttons** - One-click to apply preset
3. **"Customize" toggle** - Reveals advanced controls
4. **Reset button** - Return to preset defaults

### Settings Organization

- **Primary controls** always visible (preset selector, main intensity)
- **Secondary controls** in expandable "Advanced" section
- **Preset-specific controls** only show when relevant

---

## Migration Strategy

1. Keep old effect names as aliases pointing to new unified effects
2. Map old settings to new unified settings
3. Gradually deprecate old effect names
4. Eventually remove aliases after transition period

---

## Success Metrics

- Reduce effect count from 103 to ~18-25
- Each unified effect should have 3-8 presets
- All existing functionality preserved via presets
- Improved discoverability (users find what they need faster)
- Reduced code duplication
