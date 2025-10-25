// Mock ImageData for tests
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

test('effects setup ready', () => {
  expect(true).toBe(true)
})