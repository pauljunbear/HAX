# CLAUDE.md - imHAX Operating System

> This file is the central knowledge base for Claude Code when working on imHAX.
> Update this file whenever patterns, conventions, or architecture changes.

## Project Identity

**Name:** imHAX (HAX - Real-time Image Effects)
**Type:** Client-side image editing web application
**Purpose:** Apply real-time artistic effects and filters to images
**Status:** Production-ready, deployed on Vercel

## Quick Start

```bash
# Development
npm run dev          # Start dev server at localhost:3000

# Testing
npm test             # Run Jest unit tests
npm run test:e2e     # Run Cypress E2E tests

# Build & Deploy
npm run build        # Production build
npm run deploy       # Deploy to Vercel (use deploy.sh)

# Code Quality
npm run lint         # ESLint check
npm run format       # Prettier format
npm run type-check   # TypeScript check
```

## Tech Stack

| Layer     | Technology                   |
| --------- | ---------------------------- |
| Framework | Next.js 14 (App Router)      |
| UI        | React 18, Tailwind CSS       |
| Canvas    | Konva.js, react-konva        |
| 3D        | Three.js, @react-three/fiber |
| State     | Zustand                      |
| Animation | Framer Motion                |
| Video/GIF | FFmpeg WASM, gif.js          |
| Testing   | Jest, Cypress                |

## Architecture Overview

```
imager2/
├── src/
│   ├── app/                 # Next.js pages & API routes
│   │   ├── layout.tsx       # Root layout with theme init
│   │   ├── page.tsx         # Home page (loads EditorApp)
│   │   └── api/route.js     # Minimal API endpoint
│   │
│   ├── components/          # React components (47 files)
│   │   ├── EditorApp.tsx    # Main orchestrator
│   │   ├── ImageEditor.tsx  # Konva canvas editor
│   │   ├── AppleStyleLayout.tsx  # Main UI layout
│   │   ├── AppleEffectsBrowser.tsx  # Effect selection
│   │   ├── AppleControlsPanel.tsx   # Settings sliders
│   │   ├── EffectLayers.tsx # Layer stack UI
│   │   └── ui/              # Primitives (slider, tabs, tooltip)
│   │
│   ├── hooks/               # Custom React hooks
│   │   ├── useEffectLayers.ts   # Layer management
│   │   ├── useHistory.ts        # Undo/redo
│   │   ├── useKeyboardShortcuts.ts
│   │   └── useImage.ts          # Image loading
│   │
│   ├── lib/                 # Utilities & core logic
│   │   ├── effects.ts       # Main effects engine (9500+ lines)
│   │   ├── store.ts         # Zustand global store
│   │   ├── themes.ts        # Theme system
│   │   ├── effects/         # Modular effects system
│   │   │   ├── index.ts     # Entry point & re-exports
│   │   │   ├── types.ts     # TypeScript interfaces
│   │   │   ├── utils.ts     # Utility functions
│   │   │   ├── categories.ts # Effect categories
│   │   │   ├── legacy.ts    # Legacy effect mappings
│   │   │   ├── konvaLoader.ts # Dynamic Konva loading
│   │   │   └── filters/     # Custom Konva filters
│   │   ├── performance/     # Optimization utilities
│   │   │   ├── BufferPool.ts
│   │   │   ├── WorkerManager.ts
│   │   │   └── OptimizedBlur.ts
│   │   └── export/          # GIF/video export
│   │
│   ├── styles/              # CSS files
│   ├── types/               # TypeScript definitions
│   └── worker/              # Web Worker code
│
├── public/                  # Static assets
│   ├── effectsWorker.js     # Effects Web Worker
│   └── manifest.json        # PWA manifest
│
├── docs/                    # Documentation (consolidated)
└── .claude/                 # Claude Code configuration
    └── commands/            # Slash commands
```

## Data Flow

```
User uploads image
       ↓
EditorApp (state orchestrator)
       ↓
┌──────┴──────┐
│  Zustand    │ ← Global state (selectedImage, activeEffect, settings)
└──────┬──────┘
       ↓
AppleStyleLayout (UI shell)
       ↓
┌──────────────────────────────────────────┐
│  Left Panel    │  Center      │  Right   │
│  EffectsBrowser│  ImageEditor │  Controls│
└──────────────────────────────────────────┘
       ↓
ImageEditor applies effects via Konva filters
       ↓
Export to PNG/JPEG/GIF
```

## Effects System

### How Effects Work

Effects are Konva filter functions defined in `src/lib/effects.ts`. Each effect:

1. Receives `imageData` (Uint8ClampedArray)
2. Manipulates pixel values in-place
3. Gets applied to Konva.Image via `image.filters([filterFn])`

### Effect Categories (8 total)

| Category | Effects                                           |
| -------- | ------------------------------------------------- |
| Adjust   | brightness, contrast, saturation, exposure, gamma |
| Blur     | blur, gaussianBlur, motionBlur, radialBlur        |
| Color    | duotone, grayscale, sepia, invert, posterize      |
| Distort  | pixelate, glitch, wave, spherize                  |
| Stylize  | halftone, dither, ASCII, scanlines                |
| Sharpen  | sharpen, smartSharpen, clarity                    |
| Effects  | lightLeak, orton, vignette, grain                 |
| Math     | fractal, flowField, reactionDiffusion             |

### Adding a New Effect

1. Define effect config in `src/lib/effects.ts`:

```typescript
effectsConfig['myEffect'] = {
  label: 'My Effect',
  category: 'Stylize',
  settings: [
    { id: 'intensity', label: 'Intensity', min: 0, max: 1, defaultValue: 0.5, step: 0.01 },
  ],
};
```

2. Implement the filter function:

```typescript
const myEffectFilter = (imageData: KonvaImageData) => {
  const { data, width, height } = imageData;
  const intensity = this.myEffectIntensity?.() ?? 0.5;

  for (let i = 0; i < data.length; i += 4) {
    // Manipulate data[i] (R), data[i+1] (G), data[i+2] (B), data[i+3] (A)
  }
};
```

3. Add to category in `effectCategories`:

```typescript
effectCategories.Stylize.effects.push('myEffect');
```

## Component Versions (V2/V3 Variants)

Several components have alternative versions for experimentation:

| File                 | Purpose                           |
| -------------------- | --------------------------------- |
| `ControlPanelV2.tsx` | Tab-based category navigation     |
| `ControlPanelV3.tsx` | Virtual scrolling, recent effects |
| `FileUpload 2.tsx`   | Alternative upload UI             |
| `NavBar 2.tsx`       | Alternative navigation            |
| `tooltip 2.tsx`      | Alternative tooltip style         |

**Production uses:** `AppleStyleLayout.tsx` with `AppleEffectsBrowser.tsx` and `AppleControlsPanel.tsx`

## State Management

### Zustand Store (`src/lib/store.ts`)

```typescript
interface AppState {
  selectedImage: string | null; // Base64 image data
  activeEffect: string | null; // Current effect ID
  effectSettings: Record<string, number>; // Slider values
  history: string[]; // Undo stack
  sidebarOpen: boolean; // UI state
}
```

### Local Hooks

- `useEffectLayers` - Layer stack with opacity/visibility
- `useHistory` - Undo/redo with jump-to-state
- `useKeyboardShortcuts` - Keyboard handling

## Theme System

4 themes available, stored in localStorage:

| Theme        | Description            |
| ------------ | ---------------------- |
| `light`      | Light mode             |
| `instrument` | Dark with warm tones   |
| `terminal`   | Monospace/hacker style |
| `studio`     | Default dark mode      |

Toggle with `useTheme()` hook or `ThemeToggle` component.

## Performance Optimizations

### Buffer Pooling (`BufferPool.ts`)

Reuses `Uint8ClampedArray` buffers to reduce GC pressure.

```typescript
const buffer = getBufferPool().acquire(size);
// ... use buffer ...
getBufferPool().release(buffer);
```

### Web Worker Pool (`WorkerManager.ts`)

- 2-8 workers for heavy effects
- Auto-scales based on load
- Task queue with priority

### Progressive Rendering (`ImageEditor.tsx`)

- Fast preview pass (pixelRatio: 0.6, 50ms throttle)
- Full quality pass (device ratio, 180ms idle)

### Optimized Blur (`OptimizedBlur.ts`)

- Separable Gaussian: O(n x 2r) instead of O(n x r^2)
- Kernel caching (max 50 kernels)

## Keyboard Shortcuts

| Shortcut     | Action              |
| ------------ | ------------------- |
| Ctrl+Z       | Undo                |
| Ctrl+Shift+Z | Redo                |
| Ctrl+S       | Save                |
| Ctrl+O       | Open                |
| Ctrl+E       | Export              |
| Ctrl+B       | Before/After toggle |
| Ctrl+R       | Reset               |
| Delete       | Remove effect       |

## Testing

### Unit Tests (Jest)

```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report (80% threshold)
```

### E2E Tests (Cypress)

```bash
npm run test:e2e            # Headless
npm run test:e2e:open       # Interactive
```

### Test Files

- `*.test.tsx` - Component tests
- `cypress/e2e/` - E2E tests (onboarding, accessibility)

## Deployment

### Vercel (Production)

- Auto-deploys on push to `main`
- Config in `vercel.json`
- Project ID: `prj_VlJlQxjVAL7PP6fj96KV2NYhauUi`

### Manual Deploy

```bash
./deploy.sh   # Stages, commits, pushes
```

## Known Issues & Gotchas

### Build Error Suppression

`next.config.js` has `ignoreBuildErrors: true` - TypeScript errors don't block builds.

### SSR & Konva

Konva doesn't support SSR. Use dynamic imports:

```typescript
const loadKonva = async () => {
  if (typeof window === 'undefined') return;
  Konva = await import('konva');
};
```

### FFmpeg WASM Requirements

Needs CORS headers for SharedArrayBuffer:

- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`

### Worker Limitations

- Workers can't access DOM
- Must serialize data for transfer
- Use transferable objects when possible

## Code Style

### ESLint Rules (`.eslintrc.json`)

- TypeScript recommended rules
- React hooks enforced
- `console.log` allowed (for debugging)

### Prettier (`.prettierrc.json`)

- Single quotes
- 100 char line width
- 2 space indent
- Trailing commas (ES5)

### Naming Conventions

- Components: PascalCase (`ImageEditor.tsx`)
- Hooks: camelCase with `use` prefix (`useHistory.ts`)
- Utils: camelCase (`effects.ts`)
- Types: PascalCase (`EffectConfig`)

## Security Notes

- **Client-side only**: Images never leave the browser
- **No authentication**: Not needed for local processing
- **No secrets in repo**: Verified clean
- **Proper .gitignore**: Excludes `.env*.local`, `node_modules`

## Common Tasks

### Add a Component

1. Create in `src/components/`
2. Use TypeScript interfaces for props
3. Export from component file
4. Import where needed

### Add a Hook

1. Create in `src/hooks/`
2. Prefix with `use`
3. Return tuple or object
4. Add tests if complex

### Debug Effects

1. Check browser console for errors
2. Add `console.log` to filter function
3. Verify `imageData` dimensions
4. Check if effect is in `effectCategories`

### Fix Broken Build

```bash
npm run clean        # Clear .next cache
rm -rf node_modules
npm install
npm run build
```

---

_Last updated: January 2026_
_Maintained by: @pauljunbear_
