// Mock tsParticles
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
  return React.createElement('div', {
    'data-testid': 'particles-container',
    id: id,
    ...props
  });
};

export default {
  tsParticles,
  Particles,
}; 