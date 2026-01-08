# Imager – Product Requirements Document (PRD)

## 1. Introduction / Overview

Imager is a web-based image editor that aggregates a curated collection of high-quality, creative visual effects into a single, fast, and beautifully designed tool. It solves the problem of creative effects being scattered across multiple apps by allowing users to upload an image, apply one-click artistic effects (including animated effects), layer multiple effects, and export the final asset in its original resolution as a static image or an animated GIF/MP4/WebM. The experience is designed to be instant, fun, and mobile-friendly, enabling rapid creative expression without the complexity of traditional tools like Photoshop.

## 2. Goals

1. Provide an intuitive interface that lets users apply and preview effects in < **300 ms**.
2. Allow users to stack unlimited effects and see the combined result in real time.
3. Support export of edited images at their original resolution without quality loss.
4. Enable export of animated effects as high-quality GIFs, MP4, and WebM videos.
5. Maintain < **2 s** initial load time on desktop and mobile networks.
6. Achieve a Net Promoter Score (NPS) ≥ **60** among target users.
7. Provide professional-grade photo editing capabilities while maintaining simplicity.

## 3. User Stories

- **US-01** – _Upload & Preview_
  _As a content creator, I want to drag-and-drop an image and immediately see it on the canvas so I can start editing without delay._
- **US-02** – _One-Click Effect_
  _As a casual user, I want to click an effect thumbnail and instantly see it applied so I can experiment quickly._
- **US-03** – _Layering Effects_
  _As a designer, I want to apply multiple effects in layers so I can create unique combinations._
- **US-04** – _Adjust Settings_
  _As a power user, I want to tweak effect parameters (e.g., intensity) so I have control over the final look._
- **US-05** – _History Navigation_
  _As a user, I want unlimited undo/redo so I can freely experiment without losing work._
- **US-06** – _Export Static_
  _As a social media manager, I want to export my edited image as PNG/JPEG at full resolution so I can post it immediately._
- **US-07** – _Export Animated_
  _As a creator, I want to export an animated effect as a GIF/MP4/WebM so I can share dynamic visuals on any platform._
- **US-08** – _Mobile Editing_
  _As a mobile user, I want touch gestures and a responsive interface so I can edit professionally on my phone._
- **US-09** – _Save Presets_
  _As a professional photographer, I want to save my custom effect combinations so I can apply consistent styles across multiple images._
- **US-10** – _Compare Edits_
  _As an editor, I want to see before/after views so I can assess the impact of my edits._

## 4. Functional Requirements

1. **Image Upload** – Drag-and-drop and file-picker upload supporting JPG, PNG, GIF, WebP up to 10 MB.
2. **Real-Time Preview** – Canvas renders changes within 300 ms of user action with progressive rendering (low-res → high-res).
3. **Effect Library**
   1. Categorised and searchable list of 50+ curated effects.
   2. Recent effects section remembers last six effects (localStorage).
   3. Virtual scrolling for performance with large effect lists.
   4. Hover previews showing effect applied to current image.
4. **Effect Application**
   1. Single click to apply an effect.
   2. Ability to adjust effect parameters via sliders with real-time feedback.
   3. Support for animated effects with customizable animation presets.
   4. Mathematical effects including fractals, reaction-diffusion, flow fields.
5. **Layer Management**
   1. Add, reorder, hide/show, and delete layers.
   2. Opacity control per layer.
   3. Blend mode selection per layer.
6. **History Panel** – Unlimited undo/redo with thumbnail timeline.
7. **Export**
   1. Static export: PNG, JPEG (quality slider default 0.9).
   2. Animated export: GIF (optimized), MP4, WebM with quality/size options.
   3. Export presets for common platforms (Instagram, Twitter, etc.).
   4. Preserve original resolution and metadata.
8. **Professional Tools**
   1. Before/after split view with draggable divider.
   2. Custom preset saving and management.
   3. Advanced color grading with highlights/midtones/shadows.
   4. Smart sharpening and clarity adjustments.
   5. HDR tone mapping for dynamic range enhancement.
9. **Mobile Experience**
   1. Touch gestures: pinch to zoom, two-finger rotate.
   2. Bottom-sheet interface with smooth animations.
   3. Haptic feedback for value snapping.
   4. Adaptive UI based on screen size.
10. **Performance**
    1. WebGL/GPU acceleration via PixiJS for compatible effects.
    2. Worker pool with pre-warming for CPU-intensive operations.
    3. Progressive rendering with smooth transitions.
    4. Effect preview caching system.
    5. Virtual scrolling for large UI lists.
11. **Accessibility** – WCAG AA compliance, ARIA labels, keyboard navigation, screen reader support, focus management.

## 5. Non-Goals (Out of Scope)

- Real-time collaboration or multi-user editing.
- Complex photo retouching (e.g., clone stamp, healing brush, liquify).
- Vector graphics editing or drawing tools.
- Cloud storage or user accounts (initial release).
- RAW photo processing or color management profiles.
- AI-powered automatic editing (reserved for future phases).

## 6. Design Considerations

- **Visual Design** – Apple-inspired design system with dual-sidebar layout, generous whitespace, and smooth spring animations.
- **Interaction Design** –
  - **Rapid Creative Flow** - One-click effect application with instant visual feedback.
  - **Progressive Disclosure** - Collapsible sidebars to maximize canvas focus.
  - **Contextual Actions** - Export and controls appear only when relevant.
  - **Visual Hierarchy** - Clear primary/secondary button distinction with proper spacing.
  - **Smooth Animations** - 60fps spring physics for panel transitions and interactions.
- **Layout Architecture** –
  - **Left Sidebar (280px)** - Effects browser with search, categories, and favorites.
  - **Right Sidebar (320px)** - Tabbed controls (Settings/Layers/Export/History).
  - **Center Canvas** - Distraction-free editing with responsive behavior.
- **Mobile Design** –
  - Touch targets minimum 44px with gesture support.
  - Bottom sheet interface for mobile controls.
  - Pinch-to-zoom and pan gestures for canvas.
  - Adaptive UI based on screen size and orientation.

## 7. Technical Architecture

- **Stack** – Next.js 14 (App Router), TypeScript, React-Konva for canvas, Framer Motion for animation, Tailwind CSS.
- **Effects Pipeline** –
  - Konva built-in filters for basic effects.
  - Custom pixel manipulation for advanced effects.
  - WebGL/PixiJS for GPU-accelerated effects (<300ms target).
  - Web Workers for CPU-intensive operations.
- **Performance Optimizations** –
  - Worker pool with 2-8 workers based on device capability.
  - Pre-warmed workers with heartbeat keep-alive.
  - Progressive rendering (25% preview → 100% final).
  - LocalStorage and memory caching layers.
  - Virtual scrolling for UI components.
  - Debounced slider updates with preview quality reduction.
- **Mathematical Effects** –
  - GPU-optimized fractal generators (Mandelbrot/Julia).
  - Reaction-diffusion pattern simulation.
  - Voronoi/Delaunay tessellation algorithms.
  - Perlin noise-based flow fields.
  - All with extensive animation support.
- **Export Pipeline** –
  - Static: Off-screen Konva rendering at original resolution.
  - GIF: gif.js with worker-based encoding.
  - Video: ffmpeg-wasm for MP4/WebM with proper codec support.
  - Multi-layer animation compositing.
- **Quality Assurance** –
  - Comprehensive Jest test suite.
  - E2E tests with Cypress.
  - Performance monitoring and benchmarks.
  - Automated CI/CD via GitHub Actions.

## 8. Success Metrics

| Metric                           | Target      | Current                  |
| -------------------------------- | ----------- | ------------------------ |
| Median effect apply latency      | < 300 ms    | ✅ < 300ms (GPU effects) |
| Time to first image render       | < 2 s on 4G | ✅ < 1.5s                |
| Avg. images exported per session | ≥ 2         | TBD                      |
| Daily returning users            | ≥ 25 %      | TBD                      |
| Crash-free sessions              | ≥ 99 %      | ✅ 99.5%                 |
| Effect discovery rate            | ≥ 40%       | TBD                      |
| Mobile usage rate                | ≥ 40%       | TBD                      |
| Custom preset creation rate      | ≥ 20%       | TBD                      |

## 9. Completed Features

- ✅ 50+ effects across 8 categories
- ✅ WebGL GPU acceleration for performance
- ✅ Multi-layer animated export (GIF/MP4/WebM)
- ✅ Mathematical effects (fractals, patterns)
- ✅ Worker pool with pre-warming
- ✅ Progressive rendering system
- ✅ Virtual scrolling for effects panel
- ✅ Effect preview caching
- ✅ Comprehensive accessibility support
- ✅ CI/CD pipeline with 9 automated checks

## 10. Upcoming Features

### Phase 1 (In Progress)

- Effect hover previews
- Before/after split view
- Orton Effect & Light Leak
- Smart Sharpen & Clarity

### Phase 2 (Next)

- Touch gestures for mobile
- Custom presets system
- HDR Tone Mapping & Advanced Color Grading
- Export presets for social platforms

### Phase 3 (Future)

- Batch processing
- Smart crop suggestions
- Professional watermarking
- Content-aware fill

## 11. Lessons Learned

1. **Performance First**: Removed complex particle effects that caused browser freezing.
2. **Practical Value**: Removed 3D effects that were gimmicky with no real editing value.
3. **GPU Acceleration**: Essential for achieving sub-300ms effect application.
4. **Progressive Enhancement**: Low-quality preview → high-quality final improves perceived performance.
5. **Mobile Considerations**: Virtual scrolling and worker management critical for mobile performance.

---

_Last updated: December 2024_
