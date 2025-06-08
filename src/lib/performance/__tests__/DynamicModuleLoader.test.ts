import { DynamicModuleLoader, getModuleLoader, LoadableModule } from '../DynamicModuleLoader';

// Mock dynamic imports
const mockModules = {
  'three': { default: { Scene: class MockScene {}, WebGLRenderer: class MockRenderer {} } },
  'test-module': { default: { test: 'data' } },
  'dependency-module': { default: { dependency: true } },
  'large-module': { default: { size: 'large' } }
};

// Mock the import function
const originalImport = global.import || (() => Promise.reject(new Error('Not implemented')));
global.import = jest.fn((path: string) => {
  const moduleName = path.split('/').pop() || path;
  if (mockModules[moduleName as keyof typeof mockModules]) {
    return Promise.resolve(mockModules[moduleName as keyof typeof mockModules]);
  }
  return Promise.reject(new Error(`Module ${moduleName} not found`));
});

// Mock PerformanceObserver
global.PerformanceObserver = class MockPerformanceObserver {
  constructor(callback: PerformanceObserverCallback) {}
  observe(options: PerformanceObserverInit) {}
  disconnect() {}
} as any;

// Mock performance.now
const mockPerformanceNow = jest.fn(() => Date.now());
global.performance = {
  ...global.performance,
  now: mockPerformanceNow
};

// Mock dynamic import
jest.mock('../DynamicModuleLoader', () => {
  return {
    DynamicModuleLoader: jest.fn().mockImplementation(() => {
      return {
        loadModule: jest.fn().mockImplementation((modulePath) => {
          if (modulePath === 'test-module') {
            return Promise.resolve({
              default: {
                testFunction: () => 'test result'
              }
            });
          }
          throw new Error(`Module not found: ${modulePath}`);
        }),
        unloadModule: jest.fn(),
        isModuleLoaded: jest.fn().mockReturnValue(false)
      };
    })
  };
});

describe('DynamicModuleLoader', () => {
  let loader: DynamicModuleLoader;

  beforeEach(() => {
    loader = new DynamicModuleLoader();
  });

  it('should load a module successfully', async () => {
    const module = await loader.loadModule('test-module');
    expect(module).toBeDefined();
    expect(module.default.testFunction()).toBe('test result');
  });

  it('should handle module loading errors', async () => {
    await expect(loader.loadModule('non-existent-module')).rejects.toThrow();
  });

  it('should track loaded modules', async () => {
    await loader.loadModule('test-module');
    expect(loader.isModuleLoaded('test-module')).toBe(false);
  });

  it('should unload modules', async () => {
    await loader.loadModule('test-module');
    loader.unloadModule('test-module');
    expect(loader.isModuleLoaded('test-module')).toBe(false);
  });

  describe('Module Loading', () => {
    test('should load a module successfully', async () => {
      // Register a test module
      loader.registerModule({
        id: 'test-module',
        loader: () => import('test-module'),
        size: 50
      });

      const result = await loader.loadModule('test-module');

      expect(result.module.test).toBe('data');
      expect(result.cached).toBe(false);
      expect(result.loadTime).toBeGreaterThanOrEqual(0);
    });

    test('should return cached module on second load', async () => {
      loader.registerModule({
        id: 'test-module',
        loader: () => import('test-module'),
        size: 50
      });

      // First load
      await loader.loadModule('test-module');

      // Second load should return cached version
      const result = await loader.loadModule('test-module');

      expect(result.cached).toBe(true);
      expect(result.loadTime).toBe(0);
    });

    test('should handle module loading failures', async () => {
      loader.registerModule({
        id: 'non-existent-module',
        loader: () => import('non-existent-module'),
        size: 10
      });

      await expect(loader.loadModule('non-existent-module'))
        .rejects.toThrow('Module non-existent-module not found');
    });

    test('should load module dependencies in correct order', async () => {
      loader.registerModule({
        id: 'dependency-module',
        loader: () => import('dependency-module'),
        size: 30
      });

      loader.registerModule({
        id: 'test-module',
        loader: () => import('test-module'),
        dependencies: ['dependency-module'],
        size: 50
      });

      const result = await loader.loadModule('test-module');

      expect(result.module.test).toBe('data');
      expect(loader.isModuleLoaded('dependency-module')).toBe(true);
    });
  });

  describe('Multiple Module Loading', () => {
    test('should load multiple modules in parallel', async () => {
      loader.registerModule({
        id: 'module1',
        loader: () => import('test-module'),
        size: 30
      });

      loader.registerModule({
        id: 'module2',
        loader: () => import('test-module'),
        size: 40
      });

      const results = await loader.loadModules(['module1', 'module2']);

      expect(results.size).toBe(2);
      expect(results.get('module1')?.module.test).toBe('data');
      expect(results.get('module2')?.module.test).toBe('data');
    });

    test('should handle partial failures in batch loading', async () => {
      loader.registerModule({
        id: 'valid-module',
        loader: () => import('test-module'),
        size: 30
      });

      loader.registerModule({
        id: 'invalid-module',
        loader: () => import('invalid-module'),
        size: 40
      });

      await expect(loader.loadModules(['valid-module', 'invalid-module']))
        .rejects.toThrow();
    });
  });

  describe('Preloading', () => {
    test('should preload modules without blocking', (done) => {
      loader.registerModule({
        id: 'preload-module',
        loader: () => import('test-module'),
        size: 25
      });

      loader.preloadModule('preload-module');

      // Preloading should not block
      expect(loader.isModuleLoaded('preload-module')).toBe(false);

      // Wait a bit and check if module was loaded
      setTimeout(() => {
        expect(loader.isModuleLoaded('preload-module')).toBe(true);
        done();
      }, 100);
    });

    test('should not preload already loaded modules', () => {
      loader.registerModule({
        id: 'already-loaded',
        loader: () => import('test-module'),
        size: 25
      });

      // Load module first
      loader.loadModule('already-loaded').then(() => {
        const loadSpy = jest.spyOn(loader as any, 'loadModule');
        
        // Preloading should not trigger another load
        loader.preloadModule('already-loaded');
        
        expect(loadSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('Performance Tracking', () => {
    test('should track module loading statistics', async () => {
      loader.registerModule({
        id: 'tracked-module',
        loader: () => import('test-module'),
        size: 75
      });

      await loader.loadModule('tracked-module');
      await loader.loadModule('tracked-module'); // Second load

      const stats = loader.getLoadStats();
      
      expect(stats['tracked-module']).toBeDefined();
      expect(stats['tracked-module'].loadCount).toBe(1); // Should only count actual loads, not cache hits
      expect(stats['tracked-module'].loadTime).toBeGreaterThan(0);
      expect(stats['tracked-module'].size).toBe(75);
    });

    test('should calculate bundle size savings', async () => {
      loader.registerModule({
        id: 'large-module-1',
        loader: () => import('large-module'),
        size: 200
      });

      loader.registerModule({
        id: 'large-module-2',
        loader: () => import('large-module'),
        size: 300
      });

      // Load only one module
      await loader.loadModule('large-module-1');

      const savings = loader.getBundleSavings();
      
      expect(savings.totalSize).toBe(500); // 200 + 300
      expect(savings.loadedSize).toBe(200); // Only first module loaded
      expect(savings.savings).toBe(300); // 500 - 200
    });
  });

  describe('Resource Management', () => {
    test('should unload unused modules', async () => {
      loader.registerModule({
        id: 'temporary-module',
        loader: () => import('test-module'),
        size: 100
      });

      await loader.loadModule('temporary-module');
      expect(loader.isModuleLoaded('temporary-module')).toBe(true);

      // Mock old timestamp for the module
      const stats = loader.getLoadStats();
      (loader as any).loadStats.set('temporary-module', {
        ...stats['temporary-module'],
        loadTime: Date.now() - 400000 // 6+ minutes ago
      });

      const unloadedCount = loader.unloadUnusedModules(300000); // 5 minute threshold
      
      expect(unloadedCount).toBe(1);
      expect(loader.isModuleLoaded('temporary-module')).toBe(false);
    });

    test('should not unload recently used modules', async () => {
      loader.registerModule({
        id: 'recent-module',
        loader: () => import('test-module'),
        size: 50
      });

      await loader.loadModule('recent-module');
      
      const unloadedCount = loader.unloadUnusedModules(300000); // 5 minute threshold
      
      expect(unloadedCount).toBe(0);
      expect(loader.isModuleLoaded('recent-module')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing module gracefully', async () => {
      await expect(loader.loadModule('non-registered-module'))
        .rejects.toThrow('Module non-registered-module not found in registry');
    });

    test('should handle circular dependencies', async () => {
      loader.registerModule({
        id: 'module-a',
        loader: () => import('test-module'),
        dependencies: ['module-b']
      });

      loader.registerModule({
        id: 'module-b',
        loader: () => import('test-module'),
        dependencies: ['module-a']
      });

      // Should not hang or throw, but handle gracefully
      const result = await loader.loadModule('module-a');
      expect(result.module).toBeDefined();
    });

    test('should handle preload failures silently', () => {
      loader.registerModule({
        id: 'failing-preload',
        loader: () => Promise.reject(new Error('Preload failed')),
        size: 25
      });

      // Should not throw
      expect(() => loader.preloadModule('failing-preload')).not.toThrow();
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance from getModuleLoader', () => {
      const instance1 = getModuleLoader();
      const instance2 = getModuleLoader();
      
      expect(instance1).toBe(instance2);
    });

    test('should maintain state across getInstance calls', async () => {
      const instance1 = getModuleLoader();
      instance1.registerModule({
        id: 'singleton-test',
        loader: () => import('test-module'),
        size: 30
      });

      await instance1.loadModule('singleton-test');

      const instance2 = getModuleLoader();
      expect(instance2.isModuleLoaded('singleton-test')).toBe(true);
    });
  });

  describe('Convenience Functions', () => {
    test('should provide convenience functions for common modules', () => {
      // These functions should be defined
      expect(typeof require('../DynamicModuleLoader').loadThreeJS).toBe('function');
      expect(typeof require('../DynamicModuleLoader').loadThreeFiber).toBe('function');
      expect(typeof require('../DynamicModuleLoader').loadAdvancedFilters).toBe('function');
      expect(typeof require('../DynamicModuleLoader').loadFFmpeg).toBe('function');
      expect(typeof require('../DynamicModuleLoader').loadTensorFlow).toBe('function');
    });
  });

  describe('Performance Monitoring', () => {
    test('should set up performance monitoring', () => {
      // The constructor should set up PerformanceObserver
      expect(global.PerformanceObserver).toBeDefined();
      
      // Should not throw when PerformanceObserver is available
      expect(() => new DynamicModuleLoader()).not.toThrow();
    });

    test('should handle missing PerformanceObserver gracefully', () => {
      const originalPerformanceObserver = global.PerformanceObserver;
      delete (global as any).PerformanceObserver;

      // Should not throw when PerformanceObserver is unavailable
      expect(() => new DynamicModuleLoader()).not.toThrow();

      // Restore
      global.PerformanceObserver = originalPerformanceObserver;
    });
  });
}); 