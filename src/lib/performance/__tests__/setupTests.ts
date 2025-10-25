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

  constructor(dataOrWidth: any, width?: number, height?: number) {
    if (typeof dataOrWidth === 'number') {
      this.width = dataOrWidth;
      this.height = width as number;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = dataOrWidth;
      this.width = width as number;
      this.height = height as number;
    }
  }
}

// @ts-ignore
global.ImageData = MockImageData; 

// Provide at least one trivial test so Jest does not error on empty suite
test('performance setup ready', () => {
  expect(true).toBe(true)
})