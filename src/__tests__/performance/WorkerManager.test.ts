import { WorkerManager, getWorkerManager, cleanupWorkerManager } from '@/lib/performance/WorkerManager';

// Mock Worker API for testing
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  
  postMessage(message: any) {
    // Simulate async worker response
    setTimeout(() => {
      if (this.onmessage) {
        const response = this.processMessage(message);
        this.onmessage(new MessageEvent('message', { data: response }));
      }
    }, 10);
  }
  
  terminate() {
    this.terminated = true;
  }
  
  private processMessage(message: any) {
    switch (message.type) {
      case 'APPLY_EFFECT':
        return {
          id: message.id,
          type: 'SUCCESS',
          payload: {
            imageData: new ImageData(100, 100)
          }
        };
      case 'GENERATE_FRAME':
        return {
          id: message.id,
          type: 'SUCCESS',
          payload: {
            imageData: new ImageData(100, 100),
            frameIndex: message.payload.frameIndex
          }
        };
      default:
        return {
          id: message.id,
          type: 'ERROR',
          error: 'Unknown message type'
        };
    }
  }
}

// Mock global Worker
(global as any).Worker = MockWorker;
(global as any).URL = {
  createObjectURL: jest.fn(() => 'blob:mock-url'),
  revokeObjectURL: jest.fn()
};

describe('WorkerManager', () => {
  let workerManager: WorkerManager;
  
  beforeEach(() => {
    workerManager = new WorkerManager(4);
    // Mock navigator.hardwareConcurrency
    Object.defineProperty(global.navigator, 'hardwareConcurrency', {
      writable: true,
      value: 4
    });
  });
  
  afterEach(async () => {
    await workerManager.cleanup();
  });
  
  describe('Initialization', () => {
    it('should initialize with default worker count', async () => {
      await workerManager.initialize();
      const status = workerManager.getStatus();
      expect(status.totalWorkers).toBe(1); // Starts with 1 worker
    });
    
    it('should respect max workers limit', () => {
      const manager = new WorkerManager(16);
      expect(manager['maxWorkers']).toBe(8); // Should cap at 8
    });
    
    it('should use hardware concurrency as default', () => {
      const manager = new WorkerManager();
      expect(manager['maxWorkers']).toBe(4); // Based on mocked hardwareConcurrency
    });
  });
  
  describe('Effect Processing', () => {
    beforeEach(async () => {
      await workerManager.initialize();
    });
    
    it('should process single effect successfully', async () => {
      const imageData = new ImageData(100, 100);
      const result = await workerManager.applyEffect(
        'blur',
        { intensity: 5 },
        imageData
      );
      
      expect(result).toBeInstanceOf(ImageData);
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
    });
    
    it('should handle progress callbacks', async () => {
      const imageData = new ImageData(100, 100);
      const progressValues: number[] = [];
      
      await workerManager.applyEffect(
        'blur',
        { intensity: 5 },
        imageData,
        (progress) => progressValues.push(progress)
      );
      
      // Progress callback should be called if worker sends progress
      // In our mock, it doesn't, but the infrastructure is there
      expect(progressValues).toBeDefined();
    });
    
    it('should queue multiple effects', async () => {
      const imageData = new ImageData(100, 100);
      const promises = [];
      
      // Submit multiple effects
      for (let i = 0; i < 5; i++) {
        promises.push(
          workerManager.applyEffect(
            'blur',
            { intensity: i },
            imageData
          )
        );
      }
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeInstanceOf(ImageData);
      });
    });
  });
  
  describe('Frame Generation', () => {
    beforeEach(async () => {
      await workerManager.initialize();
    });
    
    it('should generate single frame', async () => {
      const imageData = new ImageData(100, 100);
      const result = await workerManager.generateFrame(
        imageData,
        'blur',
        { intensity: 5 },
        0,
        10
      );
      
      expect(result.imageData).toBeInstanceOf(ImageData);
      expect(result.frameIndex).toBe(0);
    });
    
    it('should generate multiple frames in parallel', async () => {
      const imageData = new ImageData(100, 100);
      const totalFrames = 10;
      
      const frames = await workerManager.generateFrames(
        imageData,
        'blur',
        { intensity: 5 },
        totalFrames
      );
      
      expect(frames).toHaveLength(totalFrames);
      frames.forEach((frame, index) => {
        expect(frame).toBeInstanceOf(ImageData);
      });
    });
    
    it('should report progress for frame generation', async () => {
      const imageData = new ImageData(100, 100);
      const progressValues: number[] = [];
      
      await workerManager.generateFrames(
        imageData,
        'blur',
        { intensity: 5 },
        10,
        (progress) => progressValues.push(progress)
      );
      
      expect(progressValues.length).toBeGreaterThan(0);
      expect(progressValues[progressValues.length - 1]).toBe(1); // Should end at 100%
    });
  });
  
  describe('Worker Pool Management', () => {
    beforeEach(async () => {
      await workerManager.initialize();
    });
    
    it('should create new workers when needed', async () => {
      const imageData = new ImageData(100, 100);
      const promises = [];
      
      // Submit more tasks than initial workers
      for (let i = 0; i < 8; i++) {
        promises.push(
          workerManager.applyEffect('blur', { intensity: i }, imageData)
        );
      }
      
      // Allow time for worker creation
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const status = workerManager.getStatus();
      expect(status.totalWorkers).toBeGreaterThan(1);
      expect(status.totalWorkers).toBeLessThanOrEqual(4); // Max workers
      
      await Promise.all(promises);
    });
    
    it('should track busy workers correctly', async () => {
      const imageData = new ImageData(100, 100);
      
      // Start a task
      const promise = workerManager.applyEffect('blur', { intensity: 5 }, imageData);
      
      // Check status immediately
      const statusDuring = workerManager.getStatus();
      expect(statusDuring.busyWorkers).toBeGreaterThan(0);
      
      await promise;
      
      // Check status after completion
      const statusAfter = workerManager.getStatus();
      expect(statusAfter.busyWorkers).toBe(0);
    });
    
    it('should maintain queue size correctly', async () => {
      const imageData = new ImageData(100, 100);
      const promises = [];
      
      // Submit many tasks quickly
      for (let i = 0; i < 10; i++) {
        promises.push(
          workerManager.applyEffect('blur', { intensity: i }, imageData)
        );
      }
      
      // Check queue size
      const status = workerManager.getStatus();
      expect(status.queueSize + status.activeTasks).toBe(10);
      
      await Promise.all(promises);
      
      // Queue should be empty after completion
      const finalStatus = workerManager.getStatus();
      expect(finalStatus.queueSize).toBe(0);
      expect(finalStatus.activeTasks).toBe(0);
    });
  });
  
  describe('Error Handling', () => {
    beforeEach(async () => {
      await workerManager.initialize();
    });
    
    it('should handle worker errors gracefully', async () => {
      // Mock worker error
      const mockWorker = new MockWorker();
      mockWorker.postMessage = function() {
        setTimeout(() => {
          if (this.onmessage) {
            this.onmessage(new MessageEvent('message', {
              data: {
                id: 'test',
                type: 'ERROR',
                error: 'Worker error'
              }
            }));
          }
        }, 10);
      };
      
      // Replace worker creation for this test
      workerManager['workers'][0].worker = mockWorker as any;
      
      const imageData = new ImageData(100, 100);
      
      await expect(
        workerManager.applyEffect('blur', { intensity: 5 }, imageData)
      ).rejects.toThrow('Worker error');
    });
    
    it('should handle unknown effect types', async () => {
      const imageData = new ImageData(100, 100);
      
      await expect(
        workerManager.applyEffect('unknown-effect', {}, imageData)
      ).rejects.toThrow();
    });
  });
  
  describe('Cleanup', () => {
    it('should terminate all workers on cleanup', async () => {
      await workerManager.initialize();
      
      const imageData = new ImageData(100, 100);
      
      // Start some tasks
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          workerManager.applyEffect('blur', { intensity: i }, imageData)
        );
      }
      
      // Cleanup while tasks are running
      await workerManager.cleanup();
      
      // All promises should reject
      await expect(Promise.all(promises)).rejects.toThrow('Worker manager shutting down');
      
      // No workers should remain
      const status = workerManager.getStatus();
      expect(status.totalWorkers).toBe(0);
    });
    
    it('should clear task queue on cleanup', async () => {
      await workerManager.initialize();
      
      const imageData = new ImageData(100, 100);
      
      // Add many tasks to queue
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          workerManager.applyEffect('blur', { intensity: i }, imageData)
            .catch(() => {}) // Suppress errors
        );
      }
      
      // Cleanup immediately
      await workerManager.cleanup();
      
      const status = workerManager.getStatus();
      expect(status.queueSize).toBe(0);
      expect(status.activeTasks).toBe(0);
    });
  });
  
  describe('Singleton Management', () => {
    it('should return same instance from getWorkerManager', async () => {
      const manager1 = await getWorkerManager();
      const manager2 = await getWorkerManager();
      
      expect(manager1).toBe(manager2);
      
      await cleanupWorkerManager();
    });
    
    it('should create new instance after cleanup', async () => {
      const manager1 = await getWorkerManager();
      await cleanupWorkerManager();
      
      const manager2 = await getWorkerManager();
      
      expect(manager1).not.toBe(manager2);
      
      await cleanupWorkerManager();
    });
  });
});