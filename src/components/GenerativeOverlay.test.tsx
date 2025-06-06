import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import GenerativeOverlay from './GenerativeOverlay';

// Mock tsParticles
jest.mock('tsparticles-engine', () => ({
  tsParticles: {
    load: jest.fn(() => Promise.resolve({
      destroy: jest.fn(),
      refresh: jest.fn(),
      pause: jest.fn(),
      play: jest.fn(),
    })),
  },
}));

jest.mock('tsparticles-slim', () => ({
  loadSlim: jest.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe('GenerativeOverlay', () => {
  const defaultProps = {
    id: 'test-overlay',
    effectType: 'stars' as const,
    visible: true,
    opacity: 0.6,
    particleCount: 50,
    color: '#ffffff',
    speed: 1,
    interactive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders overlay container when visible', () => {
    render(<GenerativeOverlay {...defaultProps} />);
    
    const container = screen.getByTestId('generative-overlay-test-overlay');
    expect(container).toBeInTheDocument();
    expect(container).toHaveClass('opacity-100');
  });

  it('hides overlay when visible is false', () => {
    render(<GenerativeOverlay {...defaultProps} visible={false} />);
    
    const container = screen.getByTestId('generative-overlay-test-overlay');
    expect(container).toHaveClass('opacity-0', 'pointer-events-none');
  });

  it('applies correct opacity styles', () => {
    render(<GenerativeOverlay {...defaultProps} opacity={0.8} />);
    
    const container = screen.getByTestId('generative-overlay-test-overlay');
    expect(container).toHaveStyle({ '--overlay-opacity': '0.8' });
  });

  it('applies correct z-index when provided', () => {
    render(<GenerativeOverlay {...defaultProps} zIndex={25} />);
    
    const container = screen.getByTestId('generative-overlay-test-overlay');
    expect(container).toHaveStyle({ zIndex: '25' });
  });

  it('applies additional className when provided', () => {
    render(<GenerativeOverlay {...defaultProps} className="custom-class" />);
    
    const container = screen.getByTestId('generative-overlay-test-overlay');
    expect(container).toHaveClass('custom-class');
  });

  describe('Effect Types', () => {
    const effectTypes = ['stars', 'bubbles', 'network', 'snow', 'confetti', 'fireflies'] as const;

    effectTypes.forEach(effectType => {
      it(`renders ${effectType} effect with correct configuration`, async () => {
        const { tsParticles } = await import('tsparticles-engine');
        
        render(<GenerativeOverlay {...defaultProps} effectType={effectType} />);
        
        await waitFor(() => {
          expect(tsParticles.load).toHaveBeenCalledWith(
            expect.stringContaining('test-overlay'),
            expect.objectContaining({
              particles: expect.objectContaining({
                number: expect.objectContaining({
                  value: defaultProps.particleCount,
                }),
                color: expect.objectContaining({
                  value: defaultProps.color,
                }),
                opacity: expect.objectContaining({
                  value: defaultProps.opacity,
                }),
              }),
            })
          );
        });
      });
    });
  });

  describe('Settings Persistence', () => {
    it('updates particle count when prop changes', async () => {
      const { rerender } = render(<GenerativeOverlay {...defaultProps} particleCount={30} />);
      const { tsParticles } = await import('tsparticles-engine');
      
      // Change particle count
      rerender(<GenerativeOverlay {...defaultProps} particleCount={80} />);
      
      await waitFor(() => {
        expect(tsParticles.load).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            particles: expect.objectContaining({
              number: expect.objectContaining({
                value: 80,
              }),
            }),
          })
        );
      });
    });

    it('updates color when prop changes', async () => {
      const { rerender } = render(<GenerativeOverlay {...defaultProps} color="#ff0000" />);
      const { tsParticles } = await import('tsparticles-engine');
      
      // Change color
      rerender(<GenerativeOverlay {...defaultProps} color="#00ff00" />);
      
      await waitFor(() => {
        expect(tsParticles.load).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            particles: expect.objectContaining({
              color: expect.objectContaining({
                value: '#00ff00',
              }),
            }),
          })
        );
      });
    });

    it('updates speed when prop changes', async () => {
      const { rerender } = render(<GenerativeOverlay {...defaultProps} speed={1} />);
      const { tsParticles } = await import('tsparticles-engine');
      
      // Change speed
      rerender(<GenerativeOverlay {...defaultProps} speed={2.5} />);
      
      await waitFor(() => {
        expect(tsParticles.load).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            particles: expect.objectContaining({
              move: expect.objectContaining({
                speed: expect.any(Number), // Speed is calculated differently per effect
              }),
            }),
          })
        );
      });
    });

    it('updates interactivity when prop changes', async () => {
      const { rerender } = render(<GenerativeOverlay {...defaultProps} interactive={true} />);
      const { tsParticles } = await import('tsparticles-engine');
      
      // Change interactivity
      rerender(<GenerativeOverlay {...defaultProps} interactive={false} />);
      
      await waitFor(() => {
        expect(tsParticles.load).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            interactivity: expect.objectContaining({
              detectsOn: 'canvas',
              events: expect.objectContaining({
                onHover: expect.objectContaining({
                  enable: false,
                }),
                onClick: expect.objectContaining({
                  enable: false,
                }),
              }),
            }),
          })
        );
      });
    });
  });

  describe('Effect Type Changes', () => {
    it('recreates particles when effect type changes', async () => {
      const { rerender } = render(<GenerativeOverlay {...defaultProps} effectType="stars" />);
      const { tsParticles } = await import('tsparticles-engine');
      
      // Change effect type
      rerender(<GenerativeOverlay {...defaultProps} effectType="bubbles" />);
      
      await waitFor(() => {
        expect(tsParticles.load).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Cleanup', () => {
    it('destroys particles instance on unmount', async () => {
      const mockDestroy = jest.fn();
      const { tsParticles } = await import('tsparticles-engine');
      (tsParticles.load as jest.Mock).mockResolvedValue({
        destroy: mockDestroy,
        refresh: jest.fn(),
        pause: jest.fn(),
        play: jest.fn(),
      });
      
      const { unmount } = render(<GenerativeOverlay {...defaultProps} />);
      
      await waitFor(() => {
        expect(tsParticles.load).toHaveBeenCalled();
      });
      
      unmount();
      
      expect(mockDestroy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles tsParticles load failure gracefully', async () => {
      const { tsParticles } = await import('tsparticles-engine');
      (tsParticles.load as jest.Mock).mockRejectedValue(new Error('Failed to load'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      render(<GenerativeOverlay {...defaultProps} />);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error loading tsParticles:',
          expect.any(Error)
        );
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('has appropriate ARIA attributes', () => {
      render(<GenerativeOverlay {...defaultProps} />);
      
      const container = screen.getByTestId('generative-overlay-test-overlay');
      expect(container).toHaveAttribute('role', 'img');
      expect(container).toHaveAttribute('aria-label', 'Decorative stars overlay effect');
    });

    it('can be hidden from screen readers when not interactive', () => {
      render(<GenerativeOverlay {...defaultProps} interactive={false} />);
      
      const container = screen.getByTestId('generative-overlay-test-overlay');
      expect(container).toHaveAttribute('aria-hidden', 'true');
    });
  });
}); 