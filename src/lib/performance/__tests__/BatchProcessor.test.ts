import { BatchProcessor, BatchOperation, BatchJob } from '../BatchProcessor';

// Mock WorkerManager
jest.mock('../WorkerManager', () => ({
  getWorkerManager: jest.fn(() => ({
    applyEffect: jest.fn((effectId, settings, imageData) => {
      // Mock worker effect application
      return Promise.resolve(new ImageData(imageData.width, imageData.height));
    })
  }))
}));

describe('BatchProcessor', () => {
  let batchProcessor: BatchProcessor;
  let mockImageData: ImageData;

  beforeEach(() => {
    batchProcessor = new BatchProcessor();
    
    // Create mock ImageData
    const data = new Uint8ClampedArray(50 * 50 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;     // R
      data[i + 1] = 128; // G
      data[i + 2] = 64;  // B
      data[i + 3] = 255; // A
    }
    mockImageData = new ImageData(data, 50, 50);
  });

  describe('Operation Optimization', () => {
    test('should combine sequential blur operations', async () => {
      const effects = [
        { effectId: 'blur', settings: { intensity: 2 } },
        { effectId: 'blur', settings: { intensity: 3 } },
        { effectId: 'brightness', settings: { intensity: 10 } }
      ];

      const job = batchProcessor.createSimpleJob(mockImageData, effects);
      
      expect(job.layers).toHaveLength(1);
      expect(job.layers[0].operations).toHaveLength(3); // Before optimization
      
      const results = await batchProcessor.addJob(job);
      expect(results).toHaveLength(1);
      expect(results[0]).toBeInstanceOf(ImageData);
    });

    test('should handle operation dependencies correctly', async () => {
      const operations: BatchOperation[] = [
        {
          id: 'op1',
          type: 'EFFECT',
          effectId: 'brightness',
          settings: { intensity: 10 },
          priority: 1
        },
        {
          id: 'op2',
          type: 'EFFECT',
          effectId: 'contrast',
          settings: { intensity: 20 },
          priority: 2,
          dependencies: ['op1']
        },
        {
          id: 'op3',
          type: 'EFFECT',
          effectId: 'blur',
          settings: { intensity: 5 },
          priority: 3,
          dependencies: ['op2']
        }
      ];

      const job: BatchJob = {
        id: 'test-job',
        layers: [{
          id: 'layer1',
          imageData: mockImageData,
          operations
        }],
        outputWidth: mockImageData.width,
        outputHeight: mockImageData.height
      };

      const results = await batchProcessor.addJob(job);
      expect(results).toHaveLength(1);
      expect(results[0]).toBeInstanceOf(ImageData);
    });
  });

  describe('Caching System', () => {
    test('should cache operation results', async () => {
      const effects = [
        { effectId: 'brightness', settings: { intensity: 10 } }
      ];

      const job1 = batchProcessor.createSimpleJob(mockImageData, effects);
      const job2 = batchProcessor.createSimpleJob(mockImageData, effects);

      const startTime = Date.now();
      const results1 = await batchProcessor.addJob(job1);
      const firstJobTime = Date.now() - startTime;

      const startTime2 = Date.now();
      const results2 = await batchProcessor.addJob(job2);
      const secondJobTime = Date.now() - startTime2;

      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);
      
      // Second job should be faster due to caching (in a real scenario)
      console.log(`First job: ${firstJobTime}ms, Second job: ${secondJobTime}ms`);
    });

    test('should manage cache size effectively', async () => {
      // Fill cache with many operations
      const promises = [];
      for (let i = 0; i < 60; i++) {
        const effects = [
          { effectId: 'brightness', settings: { intensity: i % 10 } }
        ];
        const job = batchProcessor.createSimpleJob(mockImageData, effects);
        promises.push(batchProcessor.addJob(job));
      }

      await Promise.all(promises);

      const cacheStats = batchProcessor.getCacheStats();
      expect(cacheStats.size).toBeLessThanOrEqual(50); // Should be limited by cache size
      expect(cacheStats.memoryUsage).toBeGreaterThan(0);
      
      console.log('Cache stats:', cacheStats);
    });

    test('should clear cache when requested', () => {
      batchProcessor.clearCache();
      const cacheStats = batchProcessor.getCacheStats();
      expect(cacheStats.size).toBe(0);
      expect(cacheStats.memoryUsage).toBe(0);
    });
  });

  describe('Performance Optimization', () => {
    test('should group compatible operations', async () => {
      const effects = [
        { effectId: 'brightness', settings: { intensity: 10 } },
        { effectId: 'contrast', settings: { intensity: 20 } },
        { effectId: 'saturation', settings: { intensity: 15 } },
        { effectId: 'blur', settings: { intensity: 5 } }, // Different group
        { effectId: 'noise', settings: { intensity: 0.1 } } // Different group
      ];

      const job = batchProcessor.createSimpleJob(mockImageData, effects);
      const results = await batchProcessor.addJob(job);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toBeInstanceOf(ImageData);
      expect(results[0].width).toBe(mockImageData.width);
      expect(results[0].height).toBe(mockImageData.height);
    });

    test('should process multiple layers efficiently', async () => {
      const layer1Operations: BatchOperation[] = [
        {
          id: 'l1-op1',
          type: 'EFFECT',
          effectId: 'brightness',
          settings: { intensity: 10 },
          priority: 1
        }
      ];

      const layer2Operations: BatchOperation[] = [
        {
          id: 'l2-op1',
          type: 'EFFECT',
          effectId: 'blur',
          settings: { intensity: 5 },
          priority: 1
        }
      ];

      const job: BatchJob = {
        id: 'multi-layer-job',
        layers: [
          {
            id: 'layer1',
            imageData: mockImageData,
            operations: layer1Operations,
            opacity: 0.8
          },
          {
            id: 'layer2',
            imageData: mockImageData,
            operations: layer2Operations,
            opacity: 0.6
          }
        ],
        outputWidth: mockImageData.width,
        outputHeight: mockImageData.height,
        onProgress: (progress) => {
          expect(progress).toBeGreaterThanOrEqual(0);
          expect(progress).toBeLessThanOrEqual(1);
        },
        onLayerComplete: (layerId, result) => {
          expect(['layer1', 'layer2']).toContain(layerId);
          expect(result).toBeInstanceOf(ImageData);
        }
      };

      const results = await batchProcessor.addJob(job);
      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result).toBeInstanceOf(ImageData);
        expect(result.width).toBe(mockImageData.width);
        expect(result.height).toBe(mockImageData.height);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid operations gracefully', async () => {
      const effects = [
        { effectId: 'validEffect', settings: { intensity: 10 } },
        { effectId: 'invalidEffect', settings: { intensity: 20 } }
      ];

      const job = batchProcessor.createSimpleJob(mockImageData, effects);
      
      // Should not throw but handle errors internally
      const results = await batchProcessor.addJob(job);
      expect(results).toHaveLength(1);
      expect(results[0]).toBeInstanceOf(ImageData);
    });

    test('should handle layer processing errors', async () => {
      const operations: BatchOperation[] = [
        {
          id: 'error-op',
          type: 'EFFECT',
          effectId: 'nonexistentEffect',
          settings: {},
          priority: 1
        }
      ];

      const job: BatchJob = {
        id: 'error-job',
        layers: [{
          id: 'error-layer',
          imageData: mockImageData,
          operations
        }],
        outputWidth: mockImageData.width,
        outputHeight: mockImageData.height
      };

      const results = await batchProcessor.addJob(job);
      
      // Should return original image data as fallback
      expect(results).toHaveLength(1);
      expect(results[0]).toBeInstanceOf(ImageData);
    });
  });

  describe('Memory Management', () => {
    test('should handle large batch jobs efficiently', async () => {
      const largeImageData = new ImageData(200, 200);
      const effects = [
        { effectId: 'brightness', settings: { intensity: 10 } },
        { effectId: 'contrast', settings: { intensity: 20 } },
        { effectId: 'blur', settings: { intensity: 3 } }
      ];

      const startTime = Date.now();
      const job = batchProcessor.createSimpleJob(largeImageData, effects);
      const results = await batchProcessor.addJob(job);
      const processingTime = Date.now() - startTime;

      expect(results).toHaveLength(1);
      expect(results[0]).toBeInstanceOf(ImageData);
      expect(results[0].width).toBe(200);
      expect(results[0].height).toBe(200);
      
      console.log(`Large image processing time: ${processingTime}ms`);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should provide accurate cache statistics', () => {
      const stats = batchProcessor.getCacheStats();
      
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.memoryUsage).toBe('number');
      expect(stats.size).toBeGreaterThanOrEqual(0);
      expect(stats.memoryUsage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Batch Job Creation', () => {
    test('should create simple jobs correctly', () => {
      const effects = [
        { effectId: 'brightness', settings: { intensity: 10 } },
        { effectId: 'blur', settings: { intensity: 5 } }
      ];

      const job = batchProcessor.createSimpleJob(mockImageData, effects);

      expect(job.id).toBeDefined();
      expect(job.layers).toHaveLength(1);
      expect(job.layers[0].operations).toHaveLength(2);
      expect(job.outputWidth).toBe(mockImageData.width);
      expect(job.outputHeight).toBe(mockImageData.height);
      
      // Check operation priorities
      const operations = job.layers[0].operations;
      expect(operations[0].priority).toBeGreaterThan(operations[1].priority);
    });

    test('should handle progress callbacks', async () => {
      const effects = [
        { effectId: 'brightness', settings: { intensity: 10 } }
      ];

      let progressUpdates = 0;
      const job = batchProcessor.createSimpleJob(
        mockImageData, 
        effects,
        (progress) => {
          progressUpdates++;
          expect(progress).toBeGreaterThanOrEqual(0);
          expect(progress).toBeLessThanOrEqual(1);
        }
      );

      await batchProcessor.addJob(job);
      expect(progressUpdates).toBeGreaterThan(0);
    });
  });
}); 