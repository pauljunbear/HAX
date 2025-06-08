import { Complex, FractalDisplacement } from '../fractalDisplacementEffect';

describe('Fractal Displacement', () => {
  describe('Complex Number Operations', () => {
    it('should perform complex addition', () => {
      const a = new Complex(1, 2);
      const b = new Complex(3, 4);
      const result = a.add(b);
      
      expect(result.real).toBe(4);
      expect(result.imag).toBe(6);
    });

    it('should perform complex multiplication', () => {
      const a = new Complex(1, 2);
      const b = new Complex(3, 4);
      const result = a.multiply(b);
      
      // (1 + 2i)(3 + 4i) = (1×3 - 2×4) + (1×4 + 2×3)i = -5 + 10i
      expect(result.real).toBe(-5);
      expect(result.imag).toBe(10);
    });

    it('should calculate complex magnitude', () => {
      const c = new Complex(3, 4);
      expect(c.magnitude()).toBe(5); // sqrt(3^2 + 4^2) = 5
    });

    it('should calculate complex power', () => {
      const c = new Complex(1, 1);
      const result = c.power(2);
      
      // (1 + i)^2 = 1 + 2i + i^2 = 1 + 2i - 1 = 2i
      expect(result.real).toBeCloseTo(0, 5);
      expect(result.imag).toBeCloseTo(2, 5);
    });
  });

  describe('Newton Fractal', () => {
    it('should converge for points near roots', () => {
      // Test point near root at x=1
      const x = 1.1;
      const y = 0.1;
      const iterations = 10;
      
      const result = FractalDisplacement.newton(x, y, iterations);
      
      // Should move closer to x=1
      expect(Math.abs(result.dx)).toBeLessThan(Math.abs(x - 1));
    });

    it('should provide convergence information', () => {
      const result = FractalDisplacement.newton(0, 0, 10);
      
      expect(result.convergence).toBeGreaterThanOrEqual(0);
      expect(result.convergence).toBeLessThanOrEqual(1);
    });
  });

  describe('Burning Ship Fractal', () => {
    it('should generate displacement values', () => {
      const result = FractalDisplacement.burningShip(0.5, 0.5, 20);
      
      expect(typeof result.dx).toBe('number');
      expect(typeof result.dy).toBe('number');
      expect(typeof result.value).toBe('number');
    });

    it('should handle edge cases', () => {
      const result = FractalDisplacement.burningShip(0, 0, 20);
      
      expect(result.value).toBe(1); // Should escape immediately at origin
      expect(result.dx).toBe(0);
      expect(result.dy).toBe(0);
    });
  });

  describe('Tricorn Fractal', () => {
    it('should generate displacement values', () => {
      const result = FractalDisplacement.tricorn(0.5, 0.5, 20);
      
      expect(typeof result.dx).toBe('number');
      expect(typeof result.dy).toBe('number');
      expect(typeof result.value).toBe('number');
    });

    it('should be symmetric about real axis', () => {
      const result1 = FractalDisplacement.tricorn(0.5, 0.5, 20);
      const result2 = FractalDisplacement.tricorn(0.5, -0.5, 20);
      
      expect(result1.dx).toBe(result2.dx);
      expect(result1.dy).toBe(-result2.dy); // Should be opposite due to conjugate
    });
  });

  describe('Phoenix Fractal', () => {
    it('should generate displacement values', () => {
      const result = FractalDisplacement.phoenix(0.5, 0.5, 0.5626, -0.5, 20);
      
      expect(typeof result.dx).toBe('number');
      expect(typeof result.dy).toBe('number');
      expect(typeof result.value).toBe('number');
    });

    it('should be sensitive to parameters', () => {
      const result1 = FractalDisplacement.phoenix(0.5, 0.5, 0.5626, -0.5, 20);
      const result2 = FractalDisplacement.phoenix(0.5, 0.5, 0.5, -0.5, 20);
      
      // Different parameters should produce different results
      expect(result1.dx).not.toBe(result2.dx);
    });
  });
}); 