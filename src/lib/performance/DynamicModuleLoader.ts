/**
 * Dynamic Module Loader - Implements code-splitting for heavy modules
 * Loads modules only when needed to reduce initial bundle size
 */

export interface ModuleLoadResult<T = any> {
  module: T;
  loadTime: number;
  cached: boolean;
}

export interface LoadableModule {
  id: string;
  loader: () => Promise<any>;
  dependencies?: string[];
  preload?: boolean;
  size?: number; // Estimated size in KB
}

export class DynamicModuleLoader {
  private moduleCache = new Map<string, any>();
  private loadingPromises = new Map<string, Promise<any>>();
  private loadStats = new Map<string, { loadTime: number; loadCount: number }>();

  // Module registry with lazy loading definitions
  private modules: Map<string, LoadableModule> = new Map([
    // Three.js modules - Heavy 3D library
    [
      'three',
      {
        id: 'three',
        loader: () => import('three'),
        size: 580, // ~580KB
        preload: false,
      },
    ],

    [
      'three-fiber',
      {
        id: 'three-fiber',
        loader: () => import('@react-three/fiber'),
        dependencies: ['three'],
        size: 120, // ~120KB
        preload: false,
      },
    ],

    [
      'three-drei',
      {
        id: 'three-drei',
        loader: () => import('@react-three/drei'),
        dependencies: ['three', 'three-fiber'],
        size: 200, // ~200KB
        preload: false,
      },
    ],

    // Advanced image processing modules
    [
      'advanced-filters',
      {
        id: 'advanced-filters',
        loader: () => import('../effects/advancedFilters'),
        size: 85, // ~85KB
        preload: false,
      },
    ],

    [
      'ai-effects',
      {
        id: 'ai-effects',
        loader: () => import('../effects/aiEffects'),
        size: 150, // ~150KB
        preload: false,
      },
    ],

    // Video processing
    [
      'ffmpeg-wasm',
      {
        id: 'ffmpeg-wasm',
        loader: () => import('@ffmpeg/ffmpeg'),
        size: 340, // ~340KB
        preload: false,
      },
    ],

    // Particle systems
    [
      'tsparticles',
      {
        id: 'tsparticles',
        loader: () => import('tsparticles-engine'),
        size: 180, // ~180KB
        preload: false,
      },
    ],

    // Advanced export formats
    [
      'gif-encoder',
      {
        id: 'gif-encoder',
        loader: () => import('../export/gifEncoder'),
        size: 45, // ~45KB
        preload: false,
      },
    ],

    // Performance profiling tools
    [
      'performance-profiler',
      {
        id: 'performance-profiler',
        loader: () => import('./PerformanceProfiler'),
        size: 25, // ~25KB
        preload: false,
      },
    ],

    // Accessibility tools
    [
      'accessibility-tools',
      {
        id: 'accessibility-tools',
        loader: () => import('../accessibility/AccessibilityTools'),
        size: 35, // ~35KB
        preload: false,
      },
    ],

    // Machine learning models
    [
      'tensorflow',
      {
        id: 'tensorflow',
        loader: () => import('@tensorflow/tfjs'),
        size: 450, // ~450KB
        preload: false,
      },
    ],

    // Advanced color spaces
    [
      'color-spaces',
      {
        id: 'color-spaces',
        loader: () => import('../color/advancedColorSpaces'),
        size: 60, // ~60KB
        preload: false,
      },
    ],
  ]);

  constructor() {
    // Preload critical modules that are likely to be used
    this.preloadCriticalModules();

    // Set up performance monitoring
    this.setupPerformanceMonitoring();
  }

  /**
   * Load a module dynamically
   */
  async loadModule<T = any>(moduleId: string): Promise<ModuleLoadResult<T>> {
    const startTime = performance.now();

    // Check cache first
    if (this.moduleCache.has(moduleId)) {
      return {
        module: this.moduleCache.get(moduleId),
        loadTime: 0,
        cached: true,
      };
    }

    // Check if already loading
    if (this.loadingPromises.has(moduleId)) {
      const loadedModule = await this.loadingPromises.get(moduleId);
      return {
        module: loadedModule,
        loadTime: performance.now() - startTime,
        cached: false,
      };
    }

    const moduleConfig = this.modules.get(moduleId);
    if (!moduleConfig) {
      throw new Error(`Module ${moduleId} not found in registry`);
    }

    // Load dependencies first
    if (moduleConfig.dependencies) {
      await Promise.all(moduleConfig.dependencies.map(dep => this.loadModule(dep)));
    }

    // Start loading
    const loadPromise = this.loadModuleInternal(moduleConfig);
    this.loadingPromises.set(moduleId, loadPromise);

    try {
      const loadedModule = await loadPromise;
      const loadTime = performance.now() - startTime;

      // Cache the module
      this.moduleCache.set(moduleId, loadedModule);
      this.loadingPromises.delete(moduleId);

      // Update stats
      this.updateLoadStats(moduleId, loadTime);

      console.log(`Module ${moduleId} loaded in ${loadTime.toFixed(2)}ms`);

      return {
        module: loadedModule,
        loadTime,
        cached: false,
      };
    } catch (error) {
      this.loadingPromises.delete(moduleId);
      console.error(`Failed to load module ${moduleId}:`, error);
      throw error;
    }
  }

  /**
   * Load multiple modules in parallel
   */
  async loadModules<T = any>(moduleIds: string[]): Promise<Map<string, ModuleLoadResult<T>>> {
    const results = new Map<string, ModuleLoadResult<T>>();

    const loadPromises = moduleIds.map(async moduleId => {
      try {
        const result = await this.loadModule<T>(moduleId);
        results.set(moduleId, result);
      } catch (error) {
        console.error(`Failed to load module ${moduleId}:`, error);
        throw error;
      }
    });

    await Promise.all(loadPromises);
    return results;
  }

  /**
   * Preload a module without waiting
   */
  preloadModule(moduleId: string): void {
    if (!this.moduleCache.has(moduleId) && !this.loadingPromises.has(moduleId)) {
      this.loadModule(moduleId).catch(error => {
        console.warn(`Preload failed for module ${moduleId}:`, error);
      });
    }
  }

  /**
   * Check if a module is loaded
   */
  isModuleLoaded(moduleId: string): boolean {
    return this.moduleCache.has(moduleId);
  }

  /**
   * Get module loading stats
   */
  getLoadStats(): Record<string, { loadTime: number; loadCount: number; size?: number }> {
    const stats: Record<string, { loadTime: number; loadCount: number; size?: number }> = {};

    for (const [moduleId, moduleStats] of this.loadStats.entries()) {
      const moduleConfig = this.modules.get(moduleId);
      stats[moduleId] = {
        ...moduleStats,
        size: moduleConfig?.size,
      };
    }

    return stats;
  }

  /**
   * Get estimated bundle size savings
   */
  getBundleSavings(): { totalSize: number; loadedSize: number; savings: number } {
    let totalSize = 0;
    let loadedSize = 0;

    for (const [moduleId, config] of this.modules.entries()) {
      const size = config.size || 0;
      totalSize += size;

      if (this.moduleCache.has(moduleId)) {
        loadedSize += size;
      }
    }

    return {
      totalSize,
      loadedSize,
      savings: totalSize - loadedSize,
    };
  }

  /**
   * Unload unused modules to free memory
   */
  unloadUnusedModules(unusedThresholdMs: number = 300000): number {
    // 5 minutes
    let unloadedCount = 0;
    const now = Date.now();

    for (const [moduleId] of this.moduleCache.entries()) {
      const stats = this.loadStats.get(moduleId);
      if (stats && now - stats.loadTime > unusedThresholdMs) {
        this.moduleCache.delete(moduleId);
        unloadedCount++;
        console.log(`Unloaded unused module: ${moduleId}`);
      }
    }

    return unloadedCount;
  }

  /**
   * Register a new loadable module
   */
  registerModule(config: LoadableModule): void {
    this.modules.set(config.id, config);
  }

  /**
   * Load module using the configured loader
   */
  private async loadModuleInternal(config: LoadableModule): Promise<any> {
    try {
      const loadedModule = await config.loader();
      return loadedModule.default || loadedModule;
    } catch (error) {
      console.error(`Module loading failed for ${config.id}:`, error);
      throw error;
    }
  }

  /**
   * Preload critical modules
   */
  private preloadCriticalModules(): void {
    // Preload modules marked for preloading
    for (const [moduleId, config] of this.modules.entries()) {
      if (config.preload) {
        this.preloadModule(moduleId);
      }
    }

    // Conditionally preload based on user behavior patterns
    this.conditionalPreload();
  }

  /**
   * Conditional preloading based on likely usage patterns
   */
  private conditionalPreload(): void {
    // Preload Three.js if user has uploaded an image (likely to use 3D effects)
    setTimeout(() => {
      if (this.shouldPreloadThreeJS()) {
        this.preloadModule('three');
      }
    }, 2000); // Wait 2 seconds after app load

    // Preload advanced filters after 10 seconds of interaction
    setTimeout(() => {
      this.preloadModule('advanced-filters');
    }, 10000);
  }

  /**
   * Check if Three.js should be preloaded
   */
  private shouldPreloadThreeJS(): boolean {
    // Check if user has uploaded an image or has shown interest in 3D effects
    const hasImage = document.querySelector('canvas') !== null;
    const hasInteracted = document.querySelector('[data-effect-category="3D"]') !== null;

    return hasImage || hasInteracted;
  }

  /**
   * Update loading statistics
   */
  private updateLoadStats(moduleId: string, loadTime: number): void {
    const existing = this.loadStats.get(moduleId);
    if (existing) {
      existing.loadCount++;
      existing.loadTime = (existing.loadTime + loadTime) / 2; // Average load time
    } else {
      this.loadStats.set(moduleId, { loadTime, loadCount: 1 });
    }
  }

  /**
   * Set up performance monitoring for module loading
   */
  private setupPerformanceMonitoring(): void {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver(list => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            if (entry.name.includes('chunk') || entry.name.includes('module')) {
              console.log(`Dynamic import performance:`, {
                name: entry.name,
                duration: entry.duration,
                startTime: entry.startTime,
              });
            }
          });
        });

        observer.observe({ entryTypes: ['measure', 'navigation'] });
      } catch (error) {
        console.warn('Performance monitoring setup failed:', error);
      }
    }
  }
}

// Singleton instance
let moduleLoaderInstance: DynamicModuleLoader | null = null;

export const getModuleLoader = (): DynamicModuleLoader => {
  if (!moduleLoaderInstance) {
    moduleLoaderInstance = new DynamicModuleLoader();
  }
  return moduleLoaderInstance;
};

// Convenience functions for common modules
export const loadThreeJS = () => getModuleLoader().loadModule('three');
export const loadThreeFiber = () => getModuleLoader().loadModule('three-fiber');
export const loadAdvancedFilters = () => getModuleLoader().loadModule('advanced-filters');
export const loadFFmpeg = () => getModuleLoader().loadModule('ffmpeg-wasm');
export const loadTensorFlow = () => getModuleLoader().loadModule('tensorflow');
