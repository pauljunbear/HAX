## Relevant Files

- `src/components/GenerativeOverlay.tsx` – ❌ **REMOVED** - Particle overlays caused browser freezing
- `src/components/ImageEditor.tsx` – ✅ Enhanced with multi-layer animation export support
- `src/lib/animationRenderer.ts` – ✅ Enhanced with multi-layer support for GIF/MP4/WebM exports
- `src/components/ThreeDEffectsCanvas.tsx` – ❌ **REMOVED** - 3D effects had poor UX and no practical value
- `src/lib/export/videoExporter.ts` – ✅ Implemented WebM/MP4 export via ffmpeg-wasm
- `src/lib/performance/WorkerManager.ts` – ✅ Dynamic worker pool with pre-warming for CPU-intensive effects
- `src/lib/performance/EffectPreviewCache.ts` – ✅ Thumbnail caching system for fast previews
- `src/lib/performance/progressiveRenderer.ts` – ✅ Progressive rendering (low-res → high-res)
- `src/lib/webgl/WebGLRenderer.ts` – ✅ PixiJS-based GPU acceleration for effects
- `src/lib/effects/fractalEffects.ts` – ✅ Mandelbrot and Julia set fractal generators
- `src/lib/accessibility.ts` – ✅ ARIA labels and keyboard navigation utilities
- `src/components/SkipToContent.tsx` – ✅ Accessibility skip link component
- `src/components/VirtualScroll.tsx` – ✅ Virtual scrolling for performance optimization
- `.github/workflows/ci.yml` – ✅ Comprehensive CI/CD pipeline with 9 jobs
- `public/effectsWorker.js` – ✅ Web Worker for offloading heavy computations
- `tests/` (various) – Unit tests for new components and utilities

### Notes

- Unit tests should live next to their source files (e.g., `GenerativeOverlay.test.tsx`).
- Run all tests via `npx jest`.

## Tasks

- [x] 1.0 Add Generative Artistic Overlays ⚠️ **REMOVED DUE TO PERFORMANCE ISSUES**
  - [x] 1.1 Evaluate and select a library for overlays (p5.js vs. tsParticles) with performance benchmark
  - [x] 1.2 ~~Create `GenerativeOverlay.tsx`~~ **DISABLED** - Caused browser freezing and poor UX
  - [x] 1.3 ~~Extend `effectsConfig` and `effectCategories`~~ **REMOVED** - Generative Overlay category disabled
  - [x] 1.4 ~~Add parameter controls~~ **REMOVED** - No longer accessible in UI
  - [x] 1.5 ~~Support overlay visibility~~ **REMOVED** - Effects return null
  - [x] 1.6 ~~Ensure overlays are rasterised~~ **REMOVED** - No overlay compositing  
  - [x] 1.7 ~~Write unit tests~~ **OBSOLETE** - Component no longer used

- [x] 2.0 Integrate 3D Effects with Three.js/R3F ⚠️ **REMOVED DUE TO POOR USER EXPERIENCE**
  - [x] 2.1 ~~Scaffold `ThreeDEffectsCanvas.tsx`~~ **REMOVED** - 3D effects deemed gimmicky and not useful
  - [x] 2.2 ~~Map uploaded image as texture onto 3D objects~~ **REMOVED** - Effects were weird and uninteresting
  - [x] 2.3 ~~Implement tilt/parallax 3D effect~~ **REMOVED** - No practical value for image editing
  - [x] 2.4 ~~Add 3D effect definition to effectsConfig~~ **DISABLED** - Effects return null
  - [x] 2.5 ~~Provide UI controls for 3D parameters~~ **REMOVED** - No longer accessible in UI
  - [x] 2.6 ~~Add WebGL fallback~~ **OBSOLETE** - No 3D rendering needed
  - [x] 2.7 ~~Include 3D scene in export pipeline~~ **REMOVED** - No 3D compositing
  - [x] 2.8 ~~Unit tests for 3D effects~~ **OBSOLETE** - Components no longer used

- [x] 3.0 Enhance Export Pipeline (Video & High-quality Animation)
  - [x] 3.1 Add ffmpeg-wasm and create `videoExporter.ts` utility
  - [x] 3.2 Capture animation frames and pipe to ffmpeg for WebM/MP4 export
  - [x] 3.3 Extend export dialog UI to include video format options and quality slider
  - [x] 3.4 Improve GIF generation quality and file-size balance
  - [x] 3.5 Add cancel button and progress feedback for long exports
  - [x] 3.6 Unit tests for `videoExporter` and updated export dialog logic

- [x] 4.0 Performance Optimisation (Web Workers, OffscreenCanvas, Code-Splitting)
  - [x] 4.1 Create `effectsWorker.ts` to run heavy pixel manipulations off the main thread
  - [x] 4.2 Refactor custom filter logic to execute inside the worker and postMessage results
  - [x] 4.3 Use `OffscreenCanvas` where supported for worker-side rendering
  - [x] 4.4 Implement dynamic imports/code-splitting for rarely used effect modules (e.g., Three.js bundle)
  - [x] 4.5 Add performance metrics collection (TTI, effect latency) and log to console/devtools overlay
  - [x] 4.6 Write unit tests or benchmarks for worker vs. main-thread performance

- [x] 5.0 Accessibility & Onboarding Improvements
  - [x] 5.1 Audit existing components for ARIA roles, labels, and keyboard navigation gaps
  - [x] 5.2 Ensure color contrast meets WCAG AA for both light and dark themes
  - [x] 5.4 Add focus-ring styling and skip-to-content link
  - [ ] 5.5 Create Cypress E2E tests for accessibility flows and onboarding tour

- [x] 6.0 Testing & CI/CD Pipeline Setup
  - [x] 6.1 Expand Jest configuration to collect coverage for new directories (`src/lib`, `src/worker`)
  - [ ] 6.2 Add unit tests for all new components, hooks, and utilities
  - [x] 6.3 Configure GitHub Actions workflow: install, lint, test, build
  - [x] 6.4 Add ESLint + Prettier checks in CI and pre-commit hook (husky)
  - [x] 6.5 Ensure Vercel Preview deploy passes all checks before merging to main

- [x] 8.0 Performance Optimization with WebGL & Smart Caching
  - [x] 8.1 Implement WebGL renderer using PixiJS for GPU-accelerated effects
  - [x] 8.2 Add multi-layer caching: localStorage for effect results, memory cache for Konva nodes
  - [x] 8.3 Implement worker pool warming and reuse
  - [x] 8.4 Add progressive rendering (low-res preview → full-res)
  - [x] 8.5 Virtual scrolling for effects panel (render only visible items)
  - [x] 8.6 Debouncing and throttling for slider changes with preview quality adjustments
  - [ ] 8.7 Add performance benchmarks and optimization recommendations

- [x] 9.0 Mathematical & Fractal Effects
  - [x] 9.1 Implement Mandelbrot/Julia set fractal generators
  - [x] 9.2 Create reaction-diffusion pattern effect (Turing patterns)
  - [x] 9.3 Add Voronoi/Delaunay tessellation effects
  - [x] 9.4 Implement flow field particle effects
  - [x] 9.5 Add fractal displacement mapping for psychedelic effects
  - [x] 9.6 Create mathematical animation presets for each effect
  - [ ] 9.7 Unit tests for mathematical computations and rendering

- [ ] 10.0 Phase 1: Quick UI/UX Wins
  - [x] 10.1 Implement effect hover previews
  - [x] 10.2 Add before/after split view with draggable divider
  - [ ] 10.3 Create Orton Effect (dreamy glow)
  - [ ] 10.4 Create Light Leak effect
  - [ ] 10.5 Implement Smart Sharpen effect
  - [ ] 10.6 Implement Clarity enhancement effect

- [ ] 11.0 Phase 2: Enhanced UX & Professional Tools
  - [ ] 11.1 Add touch gestures for mobile (pinch zoom, rotate)
  - [ ] 11.2 Implement custom presets system
  - [ ] 11.3 Create HDR Tone Mapping effect
  - [ ] 11.4 Implement Advanced Color Grading
  - [ ] 11.5 Add export presets for social platforms
  - [ ] 11.6 Create magnetic sliders with haptic feedback 