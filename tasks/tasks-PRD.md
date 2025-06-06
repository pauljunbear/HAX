## Relevant Files

- `src/components/GenerativeOverlay.tsx` – New component for procedural or particle-based overlays (p5.js / tsParticles).
- `src/components/GenerativeOverlay.tsx` – ✅ Implemented tsParticles-based overlay component with 6 effect types (stars, bubbles, network, snow, confetti, fireflies).
- `src/components/ImageEditor.tsx` – ✅ Enhanced with overlay export compositing for static PNG/JPEG exports.
- `src/lib/animationRenderer.ts` – ✅ Updated to include simplified overlay rendering in animated GIF exports.
- `src/components/ThreeDEffectsCanvas.tsx` – React Three Fiber canvas for 3D image-mapped effects.
- `src/lib/export/videoExporter.ts` – Utility to export animations to WebM/MP4 via ffmpeg-wasm.
- `src/worker/effectsWorker.ts` – Web Worker to offload heavy pixel operations and keep UI responsive.
- `public/manifest.json` – PWA manifest; will be updated to improve offline caching.
- `tests/` (various) – Jest/RTL test suites covering new functionality.
- `tasks/1.1-library-evaluation.md` – Comprehensive evaluation comparing p5.js vs tsParticles for generative overlays.

### Notes

- Unit tests should live next to their source files (e.g., `GenerativeOverlay.test.tsx`).
- Run all tests via `npx jest`.

## Tasks

- [x] 1.0 Add Generative Artistic Overlays
  - [x] 1.1 Evaluate and select a library for overlays (p5.js vs. tsParticles) with performance benchmark
  - [x] 1.2 Create `GenerativeOverlay.tsx` that renders an overlay layer on top of the existing Konva canvas
  - [x] 1.3 Extend `effectsConfig` and `effectCategories` to include "Generative Overlay" effects with default settings
  - [x] 1.4 Add parameter controls (e.g., particle count, color, speed) to `ControlPanelV3`
  - [x] 1.5 Support overlay visibility, ordering, and opacity in `EffectLayers`
  - [x] 1.6 Ensure overlays are rasterised during static export and frame capture for GIF/video export
  - [x] 1.7 Write unit tests for overlay rendering and settings persistence

- [x] 2.0 Integrate 3D Effects with Three.js/R3F
  - [x] 2.1 Scaffold `ThreeDEffectsCanvas.tsx` using React Three Fiber
  - [x] 2.2 Map uploaded image as texture onto a 3D plane and cube with basic orbit controls
  - [x] 2.3 Implement a tilt/parallax 3D effect controlled by mouse/touch
  - [x] 2.4 Add effect definition and settings (depth, rotation speed) to `effectsConfig`
  - [x] 2.5 Provide UI controls in `ControlPanelV3` for 3D effect parameters
  - [x] 2.6 Add fallback to 2D canvas on devices without WebGL support
  - [x] 2.7 Include 3D scene rendering in export pipeline (using `three-canvas-screenshot` or WebGL render target)
  - [x] 2.8 Unit tests for 3D effect component mounting and fallback logic

- [x] 2.0 Integrate 3D Effects with Three.js/R3F

- [ ] 3.0 Enhance Export Pipeline (Video & High-quality Animation)
  - [ ] 3.1 Add ffmpeg-wasm and create `videoExporter.ts` utility
  - [ ] 3.2 Capture animation frames and pipe to ffmpeg for WebM/MP4 export
  - [ ] 3.3 Extend export dialog UI to include video format options and quality slider
  - [ ] 3.4 Improve GIF generation quality and file-size balance
  - [ ] 3.5 Add cancel button and progress feedback for long exports
  - [ ] 3.6 Unit tests for `videoExporter` and updated export dialog logic

- [ ] 4.0 Performance Optimisation (Web Workers, OffscreenCanvas, Code-Splitting)
  - [ ] 4.1 Create `effectsWorker.ts` to run heavy pixel manipulations off the main thread
  - [ ] 4.2 Refactor custom filter logic to execute inside the worker and postMessage results
  - [ ] 4.3 Use `OffscreenCanvas` where supported for worker-side rendering
  - [ ] 4.4 Implement dynamic imports/code-splitting for rarely used effect modules (e.g., Three.js bundle)
  - [ ] 4.5 Add performance metrics collection (TTI, effect latency) and log to console/devtools overlay
  - [ ] 4.6 Write unit tests or benchmarks for worker vs. main-thread performance

- [ ] 5.0 Accessibility & Onboarding Improvements
  - [ ] 5.1 Audit existing components for ARIA roles, labels, and keyboard navigation gaps
  - [ ] 5.2 Ensure color contrast meets WCAG AA for both light and dark themes
  - [ ] 5.3 Implement an optional onboarding tour (e.g., `react-joyride`) highlighting key controls
  - [ ] 5.4 Add focus-ring styling and skip-to-content link
  - [ ] 5.5 Create Cypress E2E tests for accessibility flows and onboarding tour

- [ ] 6.0 Testing & CI/CD Pipeline Setup
  - [ ] 6.1 Expand Jest configuration to collect coverage for new directories (`src/lib`, `src/worker`)
  - [ ] 6.2 Add unit tests for all new components, hooks, and utilities
  - [ ] 6.3 Configure GitHub Actions workflow: install, lint, test, build
  - [ ] 6.4 Add ESLint + Prettier checks in CI and pre-commit hook (husky)
  - [ ] 6.5 Ensure Vercel Preview deploy passes all checks before merging to main

- [ ] 7.0 AI-Driven Effect Suggestions
  - [ ] 7.1 Research suitable LLM APIs (OpenAI, huggingface) and cost considerations
  - [ ] 7.2 Design prompt schema to request effect stack suggestions based on user intent
  - [ ] 7.3 Create API route `api/suggestEffects` that calls the LLM with current image metadata
  - [ ] 7.4 Build UI modal allowing users to input prompt and preview suggested effect stack
  - [ ] 7.5 Implement parser that converts LLM response into effect layer actions and applies them
  - [ ] 7.6 Rate-limit API usage and handle errors gracefully
  - [ ] 7.7 Unit tests for suggestion API handler and parser logic 