import { WorkerMessage, WorkerResponse, EffectParams, FrameGenerationParams } from '../../worker/effectsWorker';

export interface WorkerTask {
  id: string;
  type: 'APPLY_EFFECT' | 'GENERATE_FRAME' | 'OFFSCREEN_RENDER';
  payload: EffectParams | FrameGenerationParams | any;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: number) => void;
}

export interface WorkerInstance {
  worker: Worker;
  busy: boolean;
  id: string;
}

export class WorkerManager {
  private workers: WorkerInstance[] = [];
  private taskQueue: WorkerTask[] = [];
  private activeTasks = new Map<string, WorkerTask>();
  // Track the latest task key per effect so we can drop outdated ones
  private latestTaskKey = new Map<string, string>();
  private maxWorkers: number;
  private workerCreated: number = 0;
  private warmupInterval: NodeJS.Timeout | null = null;
  private lastActivityTime = Date.now();
  private warmWorkers = true;

  constructor(maxWorkers = (typeof navigator !== 'undefined' && (navigator as any).hardwareConcurrency) ? (navigator as any).hardwareConcurrency : 4) {
    this.maxWorkers = Math.min(maxWorkers, 8); // Cap at 8 workers
  }

  /**
   * Initialize the worker pool with pre-warming
   */
  async initialize(): Promise<void> {
    // Pre-warm the worker pool with minimum workers
    const minWorkers = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test')
      ? Math.min(2, this.maxWorkers)
      : Math.min(2, this.maxWorkers);
    const warmupPromises = [];
    
    for (let i = 0; i < minWorkers; i++) {
      warmupPromises.push(this.createWorker());
    }
    
    await Promise.all(warmupPromises);
    
    // Start worker warmup interval
    this.startWarmupInterval();
    
    console.log(`Worker pool initialized with ${minWorkers} pre-warmed workers`);
  }

  /**
   * Start periodic worker warmup
   */
  private startWarmupInterval(): void {
    // Send heartbeat messages every 30 seconds to keep workers warm
    this.warmupInterval = setInterval(() => {
      if (!this.warmWorkers) return;
      
      const now = Date.now();
      const idleTime = now - this.lastActivityTime;
      
      // If idle for more than 60 seconds, reduce to minimum workers
      if (idleTime > 60000 && this.workers.length > 2) {
        const workersToRemove = this.workers.length - 2;
        for (let i = 0; i < workersToRemove; i++) {
          const idleWorker = this.workers.find(w => !w.busy);
          if (idleWorker) {
            this.removeWorker(idleWorker.id);
          }
        }
      }
      
      // Send heartbeat to keep workers responsive
      this.workers.forEach(worker => {
        if (!worker.busy) {
          worker.worker.postMessage({
            id: `heartbeat-${Date.now()}`,
            type: 'HEARTBEAT',
            payload: null
          });
        }
      });
    }, 30000);
  }

  /**
   * Remove a specific worker
   */
  private removeWorker(workerId: string): void {
    const index = this.workers.findIndex(w => w.id === workerId);
    if (index !== -1) {
      const worker = this.workers[index];
      worker.worker.terminate();
      this.workers.splice(index, 1);
      console.log(`Removed idle worker ${workerId}. Pool size: ${this.workers.length}`);
    }
  }

  /**
   * Warm up workers with a test operation
   */
  async warmupWorkers(): Promise<void> {
    const testImageData = new ImageData(100, 100);
    const warmupPromises = this.workers
      .filter(w => !w.busy)
      .map(worker => {
        return new Promise<void>((resolve) => {
          const warmupId = `warmup-${Date.now()}-${Math.random()}`;
          const timeout = setTimeout(() => resolve(), 1000);
          
          worker.worker.postMessage({
            id: warmupId,
            type: 'WARMUP',
            payload: { imageData: testImageData }
          });
          
          const originalHandler = worker.worker.onmessage;
          worker.worker.onmessage = (event) => {
            if (event.data.id === warmupId) {
              clearTimeout(timeout);
              worker.worker.onmessage = originalHandler;
              resolve();
            } else if (originalHandler) {
              originalHandler(event);
            }
          };
        });
      });
    
    await Promise.all(warmupPromises);
  }

  /**
   * Create a new worker instance
   */
  private async createWorker(): Promise<WorkerInstance> {
    const workerId = `worker-${this.workerCreated++}`;
    
    // Create worker from blob to avoid build issues
    const workerBlob = new Blob([
      `
      // Import the worker script
      importScripts('${window.location.origin}/_next/static/worker/effectsWorker.js');
      `
    ], { type: 'application/javascript' });
    
    const workerUrl = URL.createObjectURL(workerBlob);
    
    let worker: Worker;
    
    try {
      if (typeof Worker === 'undefined') {
        throw new Error('Worker not available');
      }
      // Try to load the external worker file first from public directory
      worker = new Worker('/effectsWorker.js');
    } catch (error) {
      // Fallback: Create inline worker
      const inlineWorkerCode = await this.getInlineWorkerCode();
      const inlineBlob = new Blob([inlineWorkerCode], { type: 'application/javascript' });
      const inlineUrl = URL.createObjectURL(inlineBlob);
      worker = new Worker(inlineUrl);
      URL.revokeObjectURL(inlineUrl);
    }

    const workerInstance: WorkerInstance = {
      worker,
      busy: false,
      id: workerId
    };

    // Set up message handling
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      // Normalize different test mocks that may send { type: 'result', result }
      const data: any = event.data;
      if (data && data.type === 'result' && data.result) {
        this.handleWorkerMessage(workerId, {
          id: data.id,
          type: 'SUCCESS',
          payload: { imageData: data.result, frameIndex: data.frameIndex }
        } as unknown as WorkerResponse);
        return;
      }
      this.handleWorkerMessage(workerId, event.data);
    };

    worker.onerror = (error) => {
      console.error(`Worker ${workerId} error:`, error);
      this.handleWorkerError(workerId, new Error(error.message || 'Worker error'));
    };

    this.workers.push(workerInstance);
    URL.revokeObjectURL(workerUrl);
    
    return workerInstance;
  }

  /**
   * Get inline worker code as fallback
   */
  private async getInlineWorkerCode(): Promise<string> {
    return `
    // Inline Web Worker for heavy pixel manipulations
    
    const workerFilters = {
      blur: (imageData, radius) => {
        const { data, width, height } = imageData;
        const output = new ImageData(width, height);
        const outputData = output.data;
        
        for (let i = 3; i < data.length; i += 4) {
          outputData[i] = data[i];
        }
        
        const boxSize = Math.floor(radius) * 2 + 1;
        const half = Math.floor(boxSize / 2);
        
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0, count = 0;
            
            for (let dy = -half; dy <= half; dy++) {
              for (let dx = -half; dx <= half; dx++) {
                const ny = y + dy;
                const nx = x + dx;
                
                if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                  const idx = (ny * width + nx) * 4;
                  r += data[idx];
                  g += data[idx + 1];
                  b += data[idx + 2];
                  count++;
                }
              }
            }
            
            const idx = (y * width + x) * 4;
            outputData[idx] = r / count;
            outputData[idx + 1] = g / count;
            outputData[idx + 2] = b / count;
          }
        }
        
        return output;
      },
      
      noise: (imageData, intensity) => {
        const { data, width, height } = imageData;
        const output = new ImageData(new Uint8ClampedArray(data), width, height);
        const outputData = output.data;
        
        for (let i = 0; i < outputData.length; i += 4) {
          const noise = (Math.random() - 0.5) * intensity * 255;
          outputData[i] = Math.max(0, Math.min(255, outputData[i] + noise));
          outputData[i + 1] = Math.max(0, Math.min(255, outputData[i + 1] + noise));
          outputData[i + 2] = Math.max(0, Math.min(255, outputData[i + 2] + noise));
        }
        
        return output;
      }
    };
    
    self.addEventListener('message', async (event) => {
      const { id, type, payload } = event.data;
      
      try {
        switch (type) {
          case 'APPLY_EFFECT': {
            const { effectId, settings, imageData } = payload;
            
            self.postMessage({
              id,
              type: 'PROGRESS',
              payload: { progress: 0 }
            });
            
            let result;
            if (effectId === 'blur') {
              result = workerFilters.blur(imageData, settings.intensity || 5);
            } else if (effectId === 'noise') {
              result = workerFilters.noise(imageData, settings.intensity || 0.1);
            } else {
              // Fallback - return original
              result = imageData;
            }
            
            self.postMessage({
              id,
              type: 'SUCCESS',
              payload: { imageData: result }
            });
            break;
          }
          
          case 'GENERATE_FRAME': {
            const { imageData, effectId, settings, frameIndex } = payload;
            
            let result;
            if (effectId === 'blur') {
              result = workerFilters.blur(imageData, settings.intensity || 5);
            } else if (effectId === 'noise') {
              result = workerFilters.noise(imageData, settings.intensity || 0.1);
            } else {
              result = imageData;
            }
            
            self.postMessage({
              id,
              type: 'SUCCESS',
              payload: { imageData: result, frameIndex }
            });
            break;
          }
        }
      } catch (error) {
        self.postMessage({
          id,
          type: 'ERROR',
          payload: null,
          error: error.message || 'Unknown error'
        });
      }
    });
    `;
  }

  /**
   * Handle worker messages
   */
  private handleWorkerMessage(workerId: string, response: WorkerResponse): void {
    const task = this.activeTasks.get(response.id);
    if (!task) return;

    switch (response.type) {
      case 'PROGRESS':
        if (task.onProgress) {
          task.onProgress(response.payload.progress);
        }
        break;

      case 'SUCCESS':
        this.activeTasks.delete(response.id);
        this.markWorkerAvailable(workerId);
        task.resolve(response.payload);
        this.processQueue();
        break;

      case 'ERROR':
        this.activeTasks.delete(response.id);
        this.markWorkerAvailable(workerId);
        task.reject(new Error(response.error || 'Worker error'));
        this.processQueue();
        break;
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(workerId: string, error: Error): void {
    // Find and reject all tasks for this worker
    for (const [taskId, task] of this.activeTasks.entries()) {
      const worker = this.workers.find(w => w.id === workerId);
      if (worker) {
        this.activeTasks.delete(taskId);
        task.reject(error);
      }
    }

    // Mark worker as available
    this.markWorkerAvailable(workerId);
    this.processQueue();
  }

  /**
   * Mark worker as available
   */
  private markWorkerAvailable(workerId: string): void {
    const worker = this.workers.find(w => w.id === workerId);
    if (worker) {
      worker.busy = false;
    }
  }

  /**
   * Get an available worker
   */
  private getAvailableWorker(): WorkerInstance | null {
    return this.workers.find(w => !w.busy) || null;
  }

  /**
   * Process the task queue
   */
  private async processQueue(): Promise<void> {
    if (this.taskQueue.length === 0) return;

    // Update last activity time
    this.lastActivityTime = Date.now();

    let worker = this.getAvailableWorker();
    
    // If no workers available, try to create a new one
    if (!worker && this.workers.length < this.maxWorkers) {
      try {
        worker = await this.createWorker();
      } catch (error) {
        console.error('Failed to create worker:', error);
        return;
      }
    }

    if (!worker) return; // All workers busy

    const task = this.taskQueue.shift();
    if (!task) return;

    worker.busy = true;
    this.activeTasks.set(task.id, task);

    const message: WorkerMessage = {
      id: task.id,
      type: task.type,
      payload: task.payload
    };

    worker.worker.postMessage(message);

    // Continue processing if there are more tasks
    if (this.taskQueue.length > 0) {
      setTimeout(() => this.processQueue(), 0);
    }
  }

  /**
   * Apply effect using worker
   */
  async applyEffect(
    effectId: string,
    settings: Record<string, number>,
    imageData: ImageData,
    onProgress?: (progress: number) => void
  ): Promise<ImageData> {
    const taskId = `effect-${Date.now()}-${Math.random()}`;
    // "Latest-wins": compute a key for the kind of effect work
    const key = `${effectId}`;
    // Mark this task as the latest for this key
    this.latestTaskKey.set(key, taskId);

    return new Promise<ImageData>((resolve, reject) => {
      const task: WorkerTask = {
        id: taskId,
        type: 'APPLY_EFFECT',
        payload: {
          effectId,
          settings,
          imageData,
          width: imageData.width,
          height: imageData.height
        },
        resolve: (result) => resolve(result.imageData),
        reject,
        onProgress
      };
      // Drop any queued tasks for the same key that are now outdated
      this.taskQueue = this.taskQueue.filter(t => {
        if (t.type !== 'APPLY_EFFECT') return true;
        // We don't have the key on the task, approximate by effectId on payload
        const sameKey = (t as any).payload?.effectId === effectId;
        // Keep only if it's the latest id
        return !sameKey || this.latestTaskKey.get(key) === t.id;
      });

      this.taskQueue.push(task);
      this.processQueue();
    });
  }

  /**
   * Generate frame using worker
   */
  async generateFrame(
    imageData: ImageData,
    effectId: string,
    settings: Record<string, number>,
    frameIndex: number,
    totalFrames: number
  ): Promise<{ imageData: ImageData; frameIndex: number }> {
    const taskId = `frame-${Date.now()}-${Math.random()}`;

    return new Promise<{ imageData: ImageData; frameIndex: number }>((resolve, reject) => {
      const task: WorkerTask = {
        id: taskId,
        type: 'GENERATE_FRAME',
        payload: {
          imageData,
          effectId,
          settings,
          frameIndex,
          totalFrames,
          width: imageData.width,
          height: imageData.height
        },
        resolve,
        reject
      };

      this.taskQueue.push(task);
      this.processQueue();
    });
  }

  /**
   * Process multiple frames in parallel
   */
  async generateFrames(
    imageData: ImageData,
    effectId: string,
    settings: Record<string, number>,
    totalFrames: number,
    onProgress?: (progress: number) => void
  ): Promise<ImageData[]> {
    const frames: ImageData[] = new Array(totalFrames);
    let completed = 0;

    const promises = Array.from({ length: totalFrames }, (_, index) =>
      this.generateFrame(imageData, effectId, settings, index, totalFrames)
        .then((result) => {
          frames[result.frameIndex] = result.imageData;
          completed++;
          if (onProgress) {
            onProgress(completed / totalFrames);
          }
          return result;
        })
    );

    await Promise.all(promises);
    return frames;
  }

  /**
   * Process multiple operations using OffscreenCanvas optimization
   */
  async processWithOffscreenCanvas(
    imageData: ImageData,
    operations: Array<{ effectId: string; settings: Record<string, number> }>,
    onProgress?: (progress: number) => void
  ): Promise<ImageData> {
    const taskId = `offscreen-${Date.now()}-${Math.random()}`;

    return new Promise<ImageData>((resolve, reject) => {
      const task: WorkerTask = {
        id: taskId,
        type: 'OFFSCREEN_RENDER',
        payload: {
          imageData,
          operations,
          width: imageData.width,
          height: imageData.height
        },
        resolve: (result) => resolve(result.imageData),
        reject,
        onProgress
      };

      this.taskQueue.push(task);
      this.processQueue();
    });
  }

  /**
   * Get worker pool status
   */
  getStatus(): {
    totalWorkers: number;
    busyWorkers: number;
    queueSize: number;
    activeTasks: number;
    idleTime: number;
    maxWorkers: number;
    isWarmedUp: boolean;
  } {
    const busyWorkers = this.workers.filter(w => w.busy).length;
    const now = Date.now();
    
    return {
      totalWorkers: this.workers.length,
      busyWorkers,
      queueSize: this.taskQueue.length,
      activeTasks: this.activeTasks.size,
      idleTime: now - this.lastActivityTime,
      maxWorkers: this.maxWorkers,
      isWarmedUp: this.workers.length >= Math.min(2, this.maxWorkers)
    };
  }

  /**
   * Cleanup and terminate all workers
   */
  async cleanup(): Promise<void> {
    // Stop warmup interval
    if (this.warmupInterval) {
      clearInterval(this.warmupInterval);
      this.warmupInterval = null;
    }
    
    this.warmWorkers = false;

    // Cancel all pending tasks
    for (const task of this.taskQueue) {
      task.reject(new Error('Worker manager shutting down'));
    }
    this.taskQueue.length = 0;

    // Cancel all active tasks
    for (const task of this.activeTasks.values()) {
      task.reject(new Error('Worker manager shutting down'));
    }
    this.activeTasks.clear();

    // Terminate all workers
    for (const workerInstance of this.workers) {
      workerInstance.worker.postMessage({
        id: 'terminate',
        type: 'TERMINATE',
        payload: null
      } as WorkerMessage);
      
      workerInstance.worker.terminate();
    }

    this.workers.length = 0;
  }
}

// Singleton instance for the app
let workerManagerInstance: WorkerManager | null = null;

export const getWorkerManager = async (): Promise<WorkerManager> => {
  if (!workerManagerInstance) {
    workerManagerInstance = new WorkerManager();
    await workerManagerInstance.initialize();
  }
  return workerManagerInstance;
};

export const cleanupWorkerManager = async (): Promise<void> => {
  if (workerManagerInstance) {
    await workerManagerInstance.cleanup();
    workerManagerInstance = null;
  }
}; 