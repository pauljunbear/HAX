// Mock Worker
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage(data: any) {
    // Simulate worker response
    if (this.onmessage) {
      const mockImageData = new ImageData(100, 100);
      this.onmessage(new MessageEvent('message', {
        data: {
          type: 'result',
          result: mockImageData
        }
      }));
    }
  }
  terminate() {}
}

// @ts-ignore
global.Worker = MockWorker;

// Mock ImageData
class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

// @ts-ignore
global.ImageData = MockImageData; 