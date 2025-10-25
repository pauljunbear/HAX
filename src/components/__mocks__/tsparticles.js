// Mock tsParticles
import React from 'react'
// Note: we require the engine mock dynamically to avoid symbol redeclarations

export const tsParticles = {
  load: jest.fn().mockResolvedValue({
    destroy: jest.fn(),
    refresh: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
  }),
  loadJSON: jest.fn().mockResolvedValue({}),
  setOnClickHandler: jest.fn(),
};

// Mock Particles component for React
export const Particles = ({ id, init, loaded, options, ...props }) => {
  // Call init callback
  try { init && init({}); } catch {}

  // Create a simple container stub
  const container = {
    destroy: jest.fn(),
    refresh: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
  }

  // Trigger engine load with provided options (what tests assert)
  try {
    const engine = require('tsparticles-engine').tsParticles
    if (engine && engine.load) {
      const p = engine.load(id, options)
      if (p && typeof p.then === 'function') {
        p.then((inst) => { try { loaded && loaded(inst); } catch {} })
         .catch((err) => { try { console.error('Error loading tsParticles:', err) } catch {} })
      } else {
        try { loaded && loaded(container) } catch {}
      }
    }
  } catch {}

  return React.createElement('div', {
    'data-testid': 'particles-container',
    id: id,
    ...props
  });
};

export default Particles;