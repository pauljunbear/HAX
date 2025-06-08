// Mock Three.js objects
export const Vector3 = jest.fn().mockImplementation((x = 0, y = 0, z = 0) => ({
  x, y, z,
  set: jest.fn(),
  normalize: jest.fn(),
  multiplyScalar: jest.fn(),
  add: jest.fn(),
  sub: jest.fn(),
}));

export const Euler = jest.fn().mockImplementation((x = 0, y = 0, z = 0) => ({
  x, y, z,
  set: jest.fn(),
}));

export const Matrix4 = jest.fn().mockImplementation(() => ({
  makeRotationFromEuler: jest.fn(),
  multiplyMatrices: jest.fn(),
}));

export const Texture = jest.fn().mockImplementation(() => ({
  needsUpdate: true,
}));

export const CanvasTexture = jest.fn().mockImplementation(() => ({
  needsUpdate: true,
}));

export const PlaneGeometry = jest.fn();
export const BoxGeometry = jest.fn();
export const MeshBasicMaterial = jest.fn();
export const Mesh = jest.fn();
export const DirectionalLight = jest.fn();
export const AmbientLight = jest.fn();
export const PerspectiveCamera = jest.fn();
export const WebGLRenderer = jest.fn().mockImplementation(() => ({
  setSize: jest.fn(),
  render: jest.fn(),
  domElement: document.createElement('canvas'),
}));

export const Scene = jest.fn().mockImplementation(() => ({
  add: jest.fn(),
  remove: jest.fn(),
})); 