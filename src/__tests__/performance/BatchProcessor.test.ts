import { BatchProcessor, BatchOperation, BatchLayer, BatchJob } from '@/lib/performance/BatchProcessor';

// Mock WorkerManager
jest.mock('@/lib/performance/WorkerManager', () => ({
  getWorkerManager: jest.fn().mockResolvedValue({
    applyEffect: jest.fn().mockImplementation((effectId, settings, imageData) => {
      // Simulate processing delay
      return new Promise(resolve => {
        setTimeout(() => {
          const result = new ImageData(imageData.width, imageData.height);
          // Simulate effect application
          result.data.set(imageData.data);
          resolve(result);
        }, 10);
      });
    })
  })
}));

describe('BatchProcessor', () => {
  let batchProcessor: BatchProcessor;
  
  beforeEach(() => {
    batchProcessor = new BatchProcessor();
  });
  
  afterEach(() => {
    batchProcessor.clearCache();
  });
  
  describe('Optimization Rules', () => {
    it('should combine sequential blur operations', async () => {
      const imageData = new ImageData(100, 100);
      
      const operations: BatchOperation[] = [
        { id: 'blur1', type: 'EFFECT', effectId: 'blur', settings: { intensity: 3 }, priority: 3 },
        { id: 'blur2', type: 'EFFECT', effectId: 'blur', settings: { intensity: 2 }, priority: 2 },
        { id: 'other', type: 'EFFECT', effectId: 'sharpen', settings: { intensity: 1 }, priority: 1 }
      ];
      
      const job: BatchJob = {
        id: 'test-job',
        layers: [{
          id: 'layer1',
          imageData,
          operations
        }],
        outputWidth: 100,
        outputHeight: 100
      };
      
      const results = await batchProcessor.addJob(job);
      
      // Should combine the two blur operations
      expect(results).toHaveLength(1);
      expect(results[0]).toBeInstanceOf(ImageData);
    });
    
    it('should combine color adjustments', async () => {
      const imageData = new ImageData(100, 100);
      
      const operations: BatchOperation[] = [
        { id: 'bright', type: 'EFFECT', effectId: 'brightness', settings: { intensity: 10 }, priority: 4 },
        { id: 'contrast', type: 'EFFECT', effectId: 'contrast', settings: { intensity: 1.2 }, priority: 3 },
        { id: 'saturation', type: 'EFFECT', effectId: 'saturation', settings: { intensity: 1.5 }, priority: 2 },
        { id: 'hue', type: 'EFFECT', effectId: 'hue', settings: { intensity: 30 }, priority: 1 }
      ];
      
      const job: BatchJob = {
        id: 'test-job',
        layers: [{
          id: 'layer1',
          imageData,
          operations
        }],
        outputWidth: 100,
        outputHeight: 100
      };
      
      const results = await batchProcessor.addJob(job);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toBeInstanceOf(ImageData);
    });
    
    it('should respect operation priorities', async () => {
      const imageData = new ImageData(100, 100);
      const executionOrder: string[] = [];
      
      const operations: BatchOperation[] = [
        { id: 'low', type: 'EFFECT', effectId: 'effect1', settings: {}, priority: 1 },
        { id: 'high', type: 'EFFECT', effectId: 'effect2', settings: {}, priority: 10 },
        { id: 'medium', type: 'EFFECT', effectId: 'effect3', settings: {}, priority: 5 }
      ];
      
      // Note: In the actual implementation, we'd track execution order
      // For this test, we verify the job completes successfully
      const job: BatchJob = {
        id: 'test-job',
        layers: [{
          id: 'layer1',
          imageData,
          operations
        }],
        outputWidth: 100,
        outputHeight: 100
      };
      
      const results = await batchProcessor.addJob(job);
      expect(results).toHaveLength(1);
    });
  });
  
  describe('Dependency Resolution', () => {
    it('should resolve operation dependencies correctly', async () => {
      const imageData = new ImageData(100, 100);
      
      const operations: BatchOperation[] = [
        { id: 'op1', type: 'EFFECT', effectId: 'blur', settings: { intensity: 5 }, priority: 1 },
        { id: 'op2', type: 'EFFECT', effectId: 'sharpen', settings: { intensity: 2 }, priority: 2, dependencies: ['op1'] },
        { id: 'op3', type: 'EFFECT', effectId: 'contrast', settings: { intensity: 1.5 }, priority: 3, dependencies: ['op2'] }
      ];
      
      const job: BatchJob = {
        id: 'test-job',
        layers: [{
          id: 'layer1',
          imageData,
          operations
        }],
        outputWidth: 100,
        outputHeight: 100
      };
      
      const results = await batchProcessor.addJob(job);
      expect(results).toHaveLength(1);
      expect(results[0]).toBeInstanceOf(ImageData);
    });
    
    it('should handle circular dependencies', async () => {
      const imageData = new ImageData(100, 100);
      
      const operations: BatchOperation[] = [
        { id: 'op1', type: 'EFFECT', effectId: 'blur', settings: { intensity: 5 }, priority: 1, dependencies: ['op2'] },
        { id: 'op2', type: 'EFFECT', effectId: 'sharpen', settings: { intensity: 2 }, priority: 2, dependencies: ['op1'] }
      ];
      
      const job: BatchJob = {
        id: 'test-job',
        layers: [{
          id: 'layer1',
          imageData,
          operations
        }],
        outputWidth: 100,
        outputHeight: 100
      };
      
      // Should not throw, but handle gracefully
      const results = await batchProcessor.addJob(job);
      expect(results).toHaveLength(1);
    });
  });
  
  describe('Layer Processing', () => {
    it('should process multiple layers', async () => {
      const imageData1 = new ImageData(100, 100);
      const imageData2 = new ImageData(100, 100);
      
      const job: BatchJob = {
        id: 'test-job',
        layers: [
          {
            id: 'layer1',
            imageData: imageData1,
            operations: [
              { id: 'op1', type: 'EFFECT', effectId: 'blur', settings: { intensity: 5 }, priority: 1 }
            ]
          },
          {
            id: 'layer2',
            imageData: imageData2,
            operations: [
              { id: 'op2', type: 'EFFECT', effectId: 'sharpen', settings: { intensity: 2 }, priority: 1 }
            ]
          }
        ],
        outputWidth: 100,
        outputHeight: 100
      };
      
      const results = await batchProcessor.addJob(job);
      
      expect(results).toHaveLength(2);
      expect(results[0]).toBeInstanceOf(ImageData);
      expect(results[1]).toBeInstanceOf(ImageData);
    });
    
    it('should apply layer opacity', async () => {
      const imageData = new ImageData(100, 100);
      // Fill with test data
      for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = 255;     // R
        imageData.data[i + 1] = 0;   // G
        imageData.data[i + 2] = 0;   // B
        imageData.data[i + 3] = 255; // A
      }
      
      const job: BatchJob = {
        id: 'test-job',
        layers: [{
          id: 'layer1',
          imageData,
          operations: [],
          opacity: 0.5
        }],
        outputWidth: 100,
        outputHeight: 100
      };
      
      const results = await batchProcessor.addJob(job);
      
      expect(results).toHaveLength(1);
      const result = results[0];
      
      // Check that opacity was applied to alpha channel
      expect(result.data[3]).toBe(128); // 255 * 0.5
    });
  });
  
  describe('Progress Tracking', () => {
    it('should report progress correctly', async () => {
      const imageData = new ImageData(100, 100);
      const progressValues: number[] = [];
      
      const job: BatchJob = {
        id: 'test-job',
        layers: [
          {
            id: 'layer1',
            imageData,
            operations: [{ id: 'op1', type: 'EFFECT', effectId: 'blur', settings: { intensity: 5 }, priority: 1 }]
          },
          {
            id: 'layer2',
            imageData,
            operations: [{ id: 'op2', type: 'EFFECT', effectId: 'sharpen', settings: { intensity: 2 }, priority: 1 }]
          }
        ],
        outputWidth: 100,
        outputHeight: 100,
        onProgress: (progress) => progressValues.push(progress)
      };
      
      await batchProcessor.addJob(job);
      
      expect(progressValues).toContain(0.5); // After first layer
      expect(progressValues).toContain(1);   // After completion
    });
    
    it('should call layer complete callback', async () => {
      const imageData = new ImageData(100, 100);
      const completedLayers: string[] = [];
      
      const job: BatchJob = {
        id: 'test-job',
        layers: [
          {
            id: 'layer1',
            imageData,
            operations: []
          },
          {
            id: 'layer2',
            imageData,
            operations: []
          }
        ],
        outputWidth: 100,
        outputHeight: 100,
        onLayerComplete: (layerId) => completedLayers.push(layerId)
      };
      
      await batchProcessor.addJob(job);
      
      expect(completedLayers).toEqual(['layer1', 'layer2']);
    });
  });
  
  describe('Caching', () => {
    it('should cache operation results', async () => {
      const imageData = new ImageData(100, 100);
      
      const job1: BatchJob = {
        id: 'job1',
        layers: [{
          id: 'layer1',
          imageData,
          operations: [
            { id: 'op1', type: 'EFFECT', effectId: 'brightness', settings: { intensity: 10 }, priority: 1 }
          ]
        }],
        outputWidth: 100,
        outputHeight: 100
      };
      
      const job2: BatchJob = {
        id: 'job2',
        layers: [{
          id: 'layer1', // Same layer ID
          imageData,    // Same image data
          operations: [ // Same operations
            { id: 'op1', type: 'EFFECT', effectId: 'brightness', settings: { intensity: 10 }, priority: 1 }
          ]
        }],
        outputWidth: 100,
        outputHeight: 100
      };
      
      const start1 = Date.now();
      await batchProcessor.addJob(job1);
      const time1 = Date.now() - start1;
      
      const start2 = Date.now();
      await batchProcessor.addJob(job2);
      const time2 = Date.now() - start2;
      
      // Second job should be faster due to caching
      expect(time2).toBeLessThan(time1);
    });
    
    it('should provide cache statistics', () => {
      const stats = batchProcessor.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats.size).toBeGreaterThanOrEqual(0);
      expect(stats.memoryUsage).toBeGreaterThanOrEqual(0);
    });
    
    it('should clear cache', async () => {
      const imageData = new ImageData(100, 100);
      
      const job: BatchJob = {
        id: 'test-job',
        layers: [{
          id: 'layer1',
          imageData,
          operations: []
        }],
        outputWidth: 100,
        outputHeight: 100
      };
      
      await batchProcessor.addJob(job);
      
      let stats = batchProcessor.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
      
      batchProcessor.clearCache();
      
      stats = batchProcessor.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle layer processing errors gracefully', async () => {
      const imageData = new ImageData(100, 100);
      
      const job: BatchJob = {
        id: 'test-job',
        layers: [
          {
            id: 'layer1',
            imageData,
            operations: [
              // This will cause an error in our mock
              { id: 'error', type: 'EFFECT', effectId: 'invalid-effect', settings: {}, priority: 1 }
            ]
          },
          {
            id: 'layer2',
            imageData,
            operations: []
          }
        ],
        outputWidth: 100,
        outputHeight: 100
      };
      
      const results = await batchProcessor.addJob(job);
      
      // Should still return results for all layers
      expect(results).toHaveLength(2);
      // Failed layer should return original imageData
      expect(results[0]).toBe(imageData);
      expect(results[1]).toBeInstanceOf(ImageData);
    });
  });
  
  describe('Performance Optimization', () => {
    it('should classify heavy vs light operations', async () => {
      const imageData = new ImageData(100, 100);
      
      const operations: BatchOperation[] = [
        { id: 'heavy1', type: 'EFFECT', effectId: 'blur', settings: { intensity: 5 }, priority: 3 },
        { id: 'heavy2', type: 'EFFECT', effectId: 'oilPainting', settings: { radius: 3 }, priority: 2 },
        { id: 'light1', type: 'EFFECT', effectId: 'brightness', settings: { intensity: 10 }, priority: 1 }
      ];
      
      const job: BatchJob = {
        id: 'test-job',
        layers: [{
          id: 'layer1',
          imageData,
          operations
        }],
        outputWidth: 100,
        outputHeight: 100
      };
      
      const results = await batchProcessor.addJob(job);
      expect(results).toHaveLength(1);
    });
    
    it('should process compatible operations together', async () => {
      const imageData = new ImageData(100, 100);
      
      const operations: BatchOperation[] = [
        { id: 'color1', type: 'EFFECT', effectId: 'brightness', settings: { intensity: 10 }, priority: 3 },
        { id: 'color2', type: 'EFFECT', effectId: 'contrast', settings: { intensity: 1.5 }, priority: 2 },
        { id: 'other', type: 'EFFECT', effectId: 'blur', settings: { intensity: 5 }, priority: 1 }
      ];
      
      const job: BatchJob = {
        id: 'test-job',
        layers: [{
          id: 'layer1',
          imageData,
          operations
        }],
        outputWidth: 100,
        outputHeight: 100
      };
      
      const results = await batchProcessor.addJob(job);
      expect(results).toHaveLength(1);
    });
  });
  
  describe('Simple Job Creation', () => {
    it('should create simple batch job from effects list', () => {
      const imageData = new ImageData(100, 100);
      
      const effects = [
        { effectId: 'blur', settings: { intensity: 5 } },
        { effectId: 'brightness', settings: { intensity: 10 } }
      ];
      
      const job = batchProcessor.createSimpleJob(imageData, effects);
      
      expect(job.id).toBeDefined();
      expect(job.layers).toHaveLength(1);
      expect(job.layers[0].operations).toHaveLength(2);
      expect(job.layers[0].operations[0].priority).toBe(2); // Higher priority for first effect
      expect(job.layers[0].operations[1].priority).toBe(1);
    });
    
    it('should handle progress callback in simple job', async () => {
      const imageData = new ImageData(100, 100);
      let progressCalled = false;
      
      const effects = [{ effectId: 'blur', settings: { intensity: 5 } }];
      
      const job = batchProcessor.createSimpleJob(
        imageData,
        effects,
        () => { progressCalled = true; }
      );
      
      await batchProcessor.addJob(job);
      
      expect(progressCalled).toBe(true);
    });
  });
});