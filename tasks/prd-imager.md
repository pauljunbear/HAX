# Imager – Product Requirements Document (PRD)

## 1. Introduction / Overview
Imager is a web-based image editor that aggregates a curated collection of high-quality, creative visual effects into a single, fast, and beautifully designed tool. It solves the problem of creative effects being scattered across multiple apps by allowing users to upload an image, apply one-click artistic effects (including animated effects), layer multiple effects, and export the final asset in its original resolution as a static image or an animated GIF (with future support for video). The experience is designed to be instant, fun, and mobile-friendly, enabling rapid creative expression without the complexity of traditional tools like Photoshop.

## 2. Goals
1. Provide an intuitive interface that lets users apply and preview effects in < **300 ms**.
2. Allow users to stack unlimited effects and see the combined result in real time.
3. Support export of edited images at their original resolution without quality loss.
4. Enable export of animated effects as high-quality GIFs (future: MP4/WebM).
5. Maintain < **2 s** initial load time on desktop and mobile networks.
6. Achieve a Net Promoter Score (NPS) ≥ **60** among target users.

## 3. User Stories
* **US-01** – *Upload & Preview*
  *As a content creator, I want to drag-and-drop an image and immediately see it on the canvas so I can start editing without delay.*
* **US-02** – *One-Click Effect*
  *As a casual user, I want to click an effect thumbnail and instantly see it applied so I can experiment quickly.*
* **US-03** – *Layering Effects*
  *As a designer, I want to apply multiple effects in layers so I can create unique combinations.*
* **US-04** – *Adjust Settings*
  *As a power user, I want to tweak effect parameters (e.g., intensity) so I have control over the final look.*
* **US-05** – *History Navigation*
  *As a user, I want unlimited undo/redo so I can freely experiment without losing work.*
* **US-06** – *Export Static*
  *As a social media manager, I want to export my edited image as PNG/JPEG at full resolution so I can post it immediately.*
* **US-07** – *Export Animated*
  *As a creator, I want to export an animated effect as a GIF so I can share dynamic visuals on social channels.*
* **US-08** – *Mobile Editing*
  *As a mobile user, I want a bottom-sheet interface that is easy to use with one hand so I can edit on the go.*

## 4. Functional Requirements
1. **Image Upload** – Drag-and-drop and file-picker upload supporting JPG, PNG, GIF, WebP up to 10 MB.
2. **Real-Time Preview** – Canvas renders changes within 300 ms of user action.
3. **Effect Library**
   1. Categorised and searchable list of curated effects.
   2. Recent effects section remembers last six effects (localStorage).
4. **Effect Application**
   1. Single click to apply an effect.
   2. Ability to adjust effect parameters via sliders.
   3. Support for animated effects.
5. **Layer Management**
   1. Add, reorder, hide/show, and delete layers.
   2. Opacity control per layer.
6. **History Panel** – Unlimited undo/redo with thumbnail timeline.
7. **Export**
   1. Static export: PNG, JPEG (quality slider default 0.9).
   2. Animated export: GIF (24 fps, quality 10) with progress bar.
   3. Preserve original resolution.
8. **Responsive UI** – Desktop sidebar; mobile bottom-sheet with tabs (Effects, Layers, History).
9. **Performance** – Lazy-load heavy libraries; use dynamic imports; keep memory footprint < 200 MB.
10. **PWA Support** – Installable, offline caching of core assets, custom icon, splash.
11. **Accessibility** – ARIA labels, keyboard shortcuts (⌘/Ctrl + K search), focus ring styles.

## 5. Non-Goals (Out of Scope)
* Real-time collaboration or multi-user editing.
* Complex photo retouching (e.g., clone stamp, healing brush).
* Vector graphics editing or drawing tools.
* Cloud storage or user accounts (initial release).
* Video timeline editing (will revisit after static/animated export maturity).

## 6. Design Considerations (Optional)
* Use **Tailwind CSS** with dark theme as default.
* Effects panel should support grid/list toggle; keep touch targets ≥44 px.
* Bottom-sheet on mobile uses 70 vh max height and swipe-to-close gesture.
* Canvas background uses checkerboard to indicate transparency.

## 7. Technical Considerations (Optional)
* **Stack** – Next.js (App Router), TypeScript, React-Konva for canvas, Framer Motion for animation, Tailwind CSS.
* **Effects Pipeline** – Konva built-in filters + custom pixel-manipulation functions; plan to explore **WebGL** shaders for advanced/animated effects.
* **Export** – For static images, render off-screen Konva stage at original size. For GIFs, generate frames with `gif.js`; future video export via ffmpeg-wasm.
* **PWA** – Manifest, service worker for offline usage, disable pull-to-refresh.
* **AI Roadmap** – Use LLM to suggest effect combinations or auto-generate effect stacks based on prompt.

## 8. Success Metrics
| Metric | Target |
| --- | --- |
| Median effect apply latency | < 300 ms |
| Time to first image render | < 2 s on 4G |
| Avg. images exported per session | ≥ 2 |
| Daily returning users | ≥ 25 % |
| Crash-free sessions | ≥ 99 % |
| NPS | ≥ 60 |

## 9. Open Questions
1. Which video formats (MP4, WebM, APNG) should we prioritise after GIF?
2. Do we need a lightweight onboarding tutorial or interactive tour?
3. Should we support user-saved effect presets?
4. What is the minimum device spec we want to guarantee smooth performance on mobile?
5. How will we license or attribute any third-party effect algorithms or shaders?

---
*Last updated: {{DATE}}* 