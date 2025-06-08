import { getWorkerManager } from './WorkerManager';

export interface BatchOperation {
  id: string;
  type: 'EFFECT' | 'TRANSFORM' | 'FILTER' | 'COMPOSITE';
  effectId: string;
  settings: Record<string, number>;
  priority: number; // 1-10, higher = more priority
  dependencies?: string[]; // IDs of operations this depends on
}

export interface BatchLayer {
  id: string;
  imageData: ImageData;
  operations: BatchOperation[];
  blendMode?: string;
  opacity?: number;
}

export interface BatchJob {
  id: string;
  layers: BatchLayer[];
  outputWidth: number;
  outputHeight: number;
  onProgress?: (progress: number) => void;
  onLayerComplete?: (layerId: string, result: ImageData) => void;
}

export interface OptimizedOperation {
  operations: BatchOperation[];
  combinedFunction: (imageData: ImageData) => ImageData;
  estimatedTime: number;
}

export class BatchProcessor {
  private processingQueue: BatchJob[] = [];
  private isProcessing = false;
  private operationCache = new Map<string, ImageData>();
  private optimizationRules = new Map<string, (ops: BatchOperation[]) => BatchOperation[]>();

  constructor() {
    this.initializeOptimizationRules();
  }

  /**
   * Initialize optimization rules for combining operations
   */
  private initializeOptimizationRules(): void {
    // Combine sequential blur operations
    this.optimizationRules.set('blur', (operations: BatchOperation[]) => {
      const blurOps = operations.filter(op => op.effectId === 'blur');
      if (blurOps.length <= 1) return operations;

      // Combine blur radiuses
      const totalBlur = blurOps.reduce((sum, op) => sum + (op.settings.intensity || 0), 0);
      const combinedBlur: BatchOperation = {
        ...blurOps[0],
        settings: { intensity: totalBlur }
      };

      return operations.filter(op => op.effectId !== 'blur').concat([combinedBlur]);
    });

    // Combine color adjustments
    this.optimizationRules.set('color', (operations: BatchOperation[]) => {
      const colorOps = operations.filter(op => 
        ['brightness', 'contrast', 'saturation', 'hue'].includes(op.effectId)
      );
      
      if (colorOps.length <= 1) return operations;

      // Combine all color adjustments into a single operation
      const combinedSettings: Record<string, number> = {};
      colorOps.forEach(op => {
        Object.assign(combinedSettings, op.settings);
      });

      const combinedColorOp: BatchOperation = {
        id: `combined-color-${Date.now()}`,
        type: 'EFFECT',
        effectId: 'colorAdjustment',
        settings: combinedSettings,
        priority: Math.max(...colorOps.map(op => op.priority))
      };

      return operations.filter(op => 
        !['brightness', 'contrast', 'saturation', 'hue'].includes(op.effectId)
      ).concat([combinedColorOp]);
    });

    // Optimize convolution operations
    this.optimizationRules.set('convolution', (operations: BatchOperation[]) => {
      const convOps = operations.filter(op => 
        ['sharpen', 'emboss', 'edgeDetection'].includes(op.effectId)
      );
      
      if (convOps.length <= 1) return operations;

      // These operations can often be combined by merging their kernels
      // For now, we'll just reorder them by computational cost
      const reordered = convOps.sort((a, b) => {
        const costs = { sharpen: 1, emboss: 2, edgeDetection: 3 };
        return (costs[a.effectId as keyof typeof costs] || 0) - 
               (costs[b.effectId as keyof typeof costs] || 0);
      });

      return operations.filter(op => 
        !['sharpen', 'emboss', 'edgeDetection'].includes(op.effectId)
      ).concat(reordered);
    });
  }

  /**
   * Add a batch job to the processing queue
   */
  async addJob(job: BatchJob): Promise<ImageData[]> {
    return new Promise((resolve, reject) => {
      const jobWithResolvers = {
        ...job,
        resolve,
        reject
      };
      
      this.processingQueue.push(jobWithResolvers as any);
      
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the queue of batch jobs
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) return;

    this.isProcessing = true;

    try {
      while (this.processingQueue.length > 0) {
        const job = this.processingQueue.shift()!;
        await this.processBatchJob(job);
      }
    } catch (error) {
      console.error('Batch processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single batch job
   */
  private async processBatchJob(job: BatchJob & { resolve: Function; reject: Function }): Promise<void> {
    try {
      const results: ImageData[] = [];
      const totalLayers = job.layers.length;
      let completedLayers = 0;

      // Process each layer
      for (const layer of job.layers) {
        try {
          const optimizedOps = this.optimizeOperations(layer.operations);
          const layerResult = await this.processLayer(layer, optimizedOps);
          
          results.push(layerResult);
          completedLayers++;

          // Report progress
          const progress = completedLayers / totalLayers;
          if (job.onProgress) {
            job.onProgress(progress);
          }

          if (job.onLayerComplete) {
            job.onLayerComplete(layer.id, layerResult);
          }

        } catch (layerError) {
          console.error(`Error processing layer ${layer.id}:`, layerError);
          // Add original image data as fallback
          results.push(layer.imageData);
          completedLayers++;
        }
      }

      job.resolve(results);

    } catch (error) {
      job.reject(error);
    }
  }

  /**
   * Optimize operations for a layer
   */
  private optimizeOperations(operations: BatchOperation[]): BatchOperation[] {
    let optimized = [...operations];

    // Sort by priority first
    optimized.sort((a, b) => b.priority - a.priority);

    // Apply optimization rules
    for (const [ruleType, rule] of this.optimizationRules.entries()) {
      optimized = rule(optimized);
    }

    // Handle dependencies
    optimized = this.resolveDependencies(optimized);

    return optimized;
  }

  /**
   * Resolve operation dependencies
   */
  private resolveDependencies(operations: BatchOperation[]): BatchOperation[] {
    const resolved: BatchOperation[] = [];
    const remaining = [...operations];
    const resolvedIds = new Set<string>();

    while (remaining.length > 0) {
      const canResolve = remaining.filter(op => 
        !op.dependencies || op.dependencies.every(dep => resolvedIds.has(dep))
      );

      if (canResolve.length === 0) {
        // Circular dependency or missing dependency
        console.warn('Circular dependency detected, adding remaining operations');
        resolved.push(...remaining);
        break;
      }

      // Add resolvable operations
      canResolve.forEach(op => {
        resolved.push(op);
        resolvedIds.add(op.id);
        const index = remaining.indexOf(op);
        remaining.splice(index, 1);
      });
    }

    return resolved;
  }

  /**
   * Process a single layer with optimized operations
   */
  private async processLayer(layer: BatchLayer, operations: BatchOperation[]): Promise<ImageData> {
    let currentImageData = layer.imageData;
    const workerManager = await getWorkerManager();

    // Check cache for layer operations
    const layerCacheKey = this.generateCacheKey(layer.id, operations);
    if (this.operationCache.has(layerCacheKey)) {
      return this.operationCache.get(layerCacheKey)!;
    }

    // Group operations that can be processed together
    const groupedOps = this.groupCompatibleOperations(operations);

    for (const group of groupedOps) {
      if (group.length === 1) {
        // Single operation
        const op = group[0];
        currentImageData = await this.applySingleOperation(currentImageData, op, workerManager);
      } else {
        // Multiple compatible operations
        currentImageData = await this.applyMultipleOperations(currentImageData, group, workerManager);
      }
    }

    // Apply layer blend mode and opacity
    if (layer.blendMode || layer.opacity !== undefined) {
      currentImageData = this.applyLayerProperties(currentImageData, layer);
    }

    // Cache the result
    this.operationCache.set(layerCacheKey, currentImageData);

    // Clean cache if it gets too large
    if (this.operationCache.size > 50) {
      const firstKey = this.operationCache.keys().next().value;
      this.operationCache.delete(firstKey);
    }

    return currentImageData;
  }

  /**
   * Group operations that can be processed together efficiently
   */
  private groupCompatibleOperations(operations: BatchOperation[]): BatchOperation[][] {
    const groups: BatchOperation[][] = [];
    const processed = new Set<string>();

    for (const operation of operations) {
      if (processed.has(operation.id)) continue;

      const compatibleGroup = [operation];
      processed.add(operation.id);

      // Find other operations that can be combined with this one
      for (const otherOp of operations) {
        if (processed.has(otherOp.id)) continue;
        
        if (this.areOperationsCompatible(operation, otherOp)) {
          compatibleGroup.push(otherOp);
          processed.add(otherOp.id);
        }
      }

      groups.push(compatibleGroup);
    }

    return groups;
  }

  /**
   * Check if two operations can be combined efficiently
   */
  private areOperationsCompatible(op1: BatchOperation, op2: BatchOperation): boolean {
    // Color adjustments can often be combined
    const colorEffects = ['brightness', 'contrast', 'saturation', 'hue'];
    if (colorEffects.includes(op1.effectId) && colorEffects.includes(op2.effectId)) {
      return true;
    }

    // Similar convolution operations
    const convolutionEffects = ['sharpen', 'blur', 'emboss'];
    if (convolutionEffects.includes(op1.effectId) && convolutionEffects.includes(op2.effectId)) {
      return false; // These should be separate for quality
    }

    // Pixel-level operations can sometimes be combined
    const pixelEffects = ['noise', 'grain', 'vignette'];
    if (pixelEffects.includes(op1.effectId) && pixelEffects.includes(op2.effectId)) {
      return true;
    }

    return false;
  }

  /**
   * Apply a single operation
   */
  private async applySingleOperation(
    imageData: ImageData, 
    operation: BatchOperation, 
    workerManager: any
  ): Promise<ImageData> {
    // Check individual operation cache
    const opCacheKey = this.generateOperationCacheKey(imageData, operation);
    if (this.operationCache.has(opCacheKey)) {
      return this.operationCache.get(opCacheKey)!;
    }

    let result: ImageData;

    try {
      // Use worker for heavy operations
      if (this.isHeavyOperation(operation)) {
        result = await workerManager.applyEffect(
          operation.effectId,
          operation.settings,
          imageData
        );
      } else {
        // Process lightweight operations on main thread
        result = await this.applyLightweightOperation(imageData, operation);
      }
    } catch (error) {
      console.error(`Error applying operation ${operation.id}:`, error);
      result = imageData; // Fallback to original
    }

    this.operationCache.set(opCacheKey, result);
    return result;
  }

  /**
   * Apply multiple compatible operations in a single pass
   */
  private async applyMultipleOperations(
    imageData: ImageData, 
    operations: BatchOperation[], 
    workerManager: any
  ): Promise<ImageData> {
    // For now, apply operations sequentially
    // In a more advanced implementation, we could combine them into a single shader/filter
    let result = imageData;
    
    for (const operation of operations) {
      result = await this.applySingleOperation(result, operation, workerManager);
    }

    return result;
  }

  /**
   * Apply lightweight operations on the main thread
   */
  private async applyLightweightOperation(
    imageData: ImageData, 
    operation: BatchOperation
  ): Promise<ImageData> {
    const { data, width, height } = imageData;
    const result = new ImageData(new Uint8ClampedArray(data), width, height);
    const resultData = result.data;

    switch (operation.effectId) {
      case 'brightness':
        const brightness = operation.settings.intensity || 0;
        for (let i = 0; i < resultData.length; i += 4) {
          resultData[i] = Math.max(0, Math.min(255, resultData[i] + brightness));
          resultData[i + 1] = Math.max(0, Math.min(255, resultData[i + 1] + brightness));
          resultData[i + 2] = Math.max(0, Math.min(255, resultData[i + 2] + brightness));
        }
        break;

      case 'contrast':
        const contrast = operation.settings.intensity || 1;
        for (let i = 0; i < resultData.length; i += 4) {
          resultData[i] = Math.max(0, Math.min(255, (resultData[i] - 128) * contrast + 128));
          resultData[i + 1] = Math.max(0, Math.min(255, (resultData[i + 1] - 128) * contrast + 128));
          resultData[i + 2] = Math.max(0, Math.min(255, (resultData[i + 2] - 128) * contrast + 128));
        }
        break;

      case 'opacity':
        const opacity = operation.settings.intensity || 1;
        for (let i = 3; i < resultData.length; i += 4) {
          resultData[i] = Math.max(0, Math.min(255, resultData[i] * opacity));
        }
        break;

      default:
        // For unknown operations, return original
        return imageData;
    }

    return result;
  }

  /**
   * Apply layer blend mode and opacity
   */
  private applyLayerProperties(imageData: ImageData, layer: BatchLayer): ImageData {
    const result = new ImageData(
      new Uint8ClampedArray(imageData.data), 
      imageData.width, 
      imageData.height
    );

    // Apply opacity
    if (layer.opacity !== undefined && layer.opacity !== 1) {
      const data = result.data;
      for (let i = 3; i < data.length; i += 4) {
        data[i] = Math.round(data[i] * layer.opacity);
      }
    }

    // TODO: Implement blend modes (normal, multiply, screen, overlay, etc.)
    // This would require a base layer to blend with

    return result;
  }

  /**
   * Check if an operation is computationally heavy
   */
  private isHeavyOperation(operation: BatchOperation): boolean {
    const heavyOperations = ['blur', 'oilPainting', 'edgeDetection', 'emboss', 'noise'];
    return heavyOperations.includes(operation.effectId);
  }

  /**
   * Generate cache key for layer operations
   */
  private generateCacheKey(layerId: string, operations: BatchOperation[]): string {
    const opsString = operations
      .map(op => `${op.effectId}:${JSON.stringify(op.settings)}`)
      .join('|');
    return `${layerId}:${opsString}`;
  }

  /**
   * Generate cache key for individual operation
   */
  private generateOperationCacheKey(imageData: ImageData, operation: BatchOperation): string {
    // Use image data hash + operation hash
    const imageHash = this.hashImageData(imageData);
    const opHash = `${operation.effectId}:${JSON.stringify(operation.settings)}`;
    return `${imageHash}:${opHash}`;
  }

  /**
   * Simple hash function for ImageData
   */
  private hashImageData(imageData: ImageData): string {
    const { width, height, data } = imageData;
    // Sample a few pixels for performance
    const samples = [];
    const step = Math.max(1, Math.floor(data.length / 1000));
    
    for (let i = 0; i < data.length; i += step) {
      samples.push(data[i]);
    }
    
    return `${width}x${height}:${samples.join(',')}`;
  }

  /**
   * Create a simple batch job for applying multiple effects
   */
  createSimpleJob(
    imageData: ImageData,
    effects: Array<{ effectId: string; settings: Record<string, number> }>,
    onProgress?: (progress: number) => void
  ): BatchJob {
    const operations: BatchOperation[] = effects.map((effect, index) => ({
      id: `op-${index}`,
      type: 'EFFECT',
      effectId: effect.effectId,
      settings: effect.settings,
      priority: effects.length - index // Later effects have lower priority
    }));

    return {
      id: `job-${Date.now()}`,
      layers: [{
        id: 'main',
        imageData,
        operations
      }],
      outputWidth: imageData.width,
      outputHeight: imageData.height,
      onProgress
    };
  }

  /**
   * Clear operation cache
   */
  clearCache(): void {
    this.operationCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; memoryUsage: number } {
    const size = this.operationCache.size;
    let memoryUsage = 0;
    
    for (const imageData of this.operationCache.values()) {
      memoryUsage += imageData.data.length * 4; // 4 bytes per pixel
    }
    
    return {
      size,
      memoryUsage: memoryUsage / 1024 / 1024 // MB
    };
  }
} 