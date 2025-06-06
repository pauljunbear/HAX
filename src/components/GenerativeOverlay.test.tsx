import React from 'react';
import { render, screen } from '@testing-library/react';
import GenerativeOverlay from './GenerativeOverlay';

// Mock tsParticles since it uses canvas and WebGL
jest.mock('@tsparticles/react', () => {
  return function MockParticles({ id, options }: any) {
    return (
      <div data-testid={`particles-${id}`} data-options={JSON.stringify(options)}>
        Mock Particles Component
      </div>
    );
  };
});

jest.mock('tsparticles-slim', () => ({
  loadSlim: jest.fn().mockResolvedValue(undefined),
}));

describe('GenerativeOverlay', () => {
  it('renders when visible is true', () => {
    render(
      <GenerativeOverlay
        id="test-overlay"
        effectType="stars"
        visible={true}
        opacity={0.6}
        particleCount={50}
        color="#ffffff"
        speed={1}
        interactive={true}
      />
    );

    expect(screen.getByTestId('particles-test-overlay')).toBeInTheDocument();
  });

  it('does not render when visible is false', () => {
    render(
      <GenerativeOverlay
        id="test-overlay"
        effectType="stars"
        visible={false}
        opacity={0.6}
        particleCount={50}
        color="#ffffff"
        speed={1}
        interactive={true}
      />
    );

    expect(screen.queryByTestId('particles-test-overlay')).not.toBeInTheDocument();
  });

  it('applies correct effect type configuration', () => {
    render(
      <GenerativeOverlay
        id="test-overlay"
        effectType="bubbles"
        visible={true}
        opacity={0.6}
        particleCount={50}
        color="#ffffff"
        speed={1}
        interactive={true}
      />
    );

    const particlesElement = screen.getByTestId('particles-test-overlay');
    const options = JSON.parse(particlesElement.getAttribute('data-options') || '{}');
    
    // Check that bubbles effect has upward movement
    expect(options.particles.move.direction).toBe('top');
    expect(options.particles.shape.type).toBe('circle');
  });

  it('applies custom particle count', () => {
    const customCount = 100;
    render(
      <GenerativeOverlay
        id="test-overlay"
        effectType="stars"
        visible={true}
        opacity={0.6}
        particleCount={customCount}
        color="#ffffff"
        speed={1}
        interactive={true}
      />
    );

    const particlesElement = screen.getByTestId('particles-test-overlay');
    const options = JSON.parse(particlesElement.getAttribute('data-options') || '{}');
    
    expect(options.particles.number.value).toBe(customCount);
  });

  it('applies custom color', () => {
    const customColor = '#ff0000';
    render(
      <GenerativeOverlay
        id="test-overlay"
        effectType="stars"
        visible={true}
        opacity={0.6}
        particleCount={50}
        color={customColor}
        speed={1}
        interactive={true}
      />
    );

    const particlesElement = screen.getByTestId('particles-test-overlay');
    const options = JSON.parse(particlesElement.getAttribute('data-options') || '{}');
    
    expect(options.particles.color.value).toBe(customColor);
  });

  it('configures different effect types correctly', () => {
    const effectTypes: Array<'stars' | 'bubbles' | 'network' | 'snow' | 'confetti' | 'fireflies'> = 
      ['stars', 'bubbles', 'network', 'snow', 'confetti', 'fireflies'];

    effectTypes.forEach((effectType) => {
      const { rerender } = render(
        <GenerativeOverlay
          id="test-overlay"
          effectType={effectType}
          visible={true}
          opacity={0.6}
          particleCount={50}
          color="#ffffff"
          speed={1}
          interactive={true}
        />
      );

      const particlesElement = screen.getByTestId('particles-test-overlay');
      const options = JSON.parse(particlesElement.getAttribute('data-options') || '{}');

      // Each effect type should have unique configuration
      expect(options.particles).toBeDefined();
      expect(options.particles.shape).toBeDefined();
      
      // Cleanup for next iteration
      rerender(<div />);
    });
  });

  it('applies default props when not specified', () => {
    render(<GenerativeOverlay />);

    expect(screen.getByTestId('particles-generative-overlay')).toBeInTheDocument();
  });
}); 