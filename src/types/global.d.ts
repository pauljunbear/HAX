declare module 'gif.js' {
  export default class GIF {
    constructor(options?: any)
    addFrame(canvas: HTMLCanvasElement | CanvasRenderingContext2D | ImageData, options?: any): void
    on(event: 'finished', cb: (blob: Blob, data?: Uint8Array) => void): void
    on(event: 'progress', cb: (percent: number) => void): void
    on(event: 'abort' | 'start' | 'error', cb: (...args: any[]) => void): void
    render(): void
  }
}

// Ambient modules used only in tests
declare module 'test-module'
declare module 'dependency-module'
declare module 'large-module'
declare module 'invalid-module'

// Jest DOM matchers global typing (fallback if not picked up)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare namespace jest {
  interface Matchers<R> {
    toBeInTheDocument(): R
    toHaveClass(...classNames: string[]): R
    toHaveStyle(style: Record<string, any> | string): R
    toHaveAttribute(attr: string, value?: string): R
    toHaveBeenCalled(): R
    toHaveBeenCalledWith(...args: any[]): R
    toHaveLength(len: number): R
    toBeInstanceOf(expected: any): R
  }
}

