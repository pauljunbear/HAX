import React from 'react';

// Mock Canvas component
export const Canvas = ({ children, ...props }: any) => (
  <div data-testid="r3f-canvas" data-props={JSON.stringify(props)}>
    {children}
  </div>
);

// Mock OrbitControls component
export const OrbitControls = (props: any) => (
  <div data-testid="orbit-controls" data-props={JSON.stringify(props)} />
);

// Mock Three.js components
export const Mesh = (props: any) => <div data-testid="mesh" data-props={JSON.stringify(props)} />;
export const DirectionalLight = (props: any) => (
  <div data-testid="directional-light" data-props={JSON.stringify(props)} />
);
export const MeshBasicMaterial = (props: any) => (
  <div data-testid="mesh-basic-material" data-props={JSON.stringify(props)} />
);
export const PlaneGeometry = (props: any) => (
  <div data-testid="plane-geometry" data-props={JSON.stringify(props)} />
);
export const BoxGeometry = (props: any) => (
  <div data-testid="box-geometry" data-props={JSON.stringify(props)} />
);

// Mock useThree hook
export const useThree = jest.fn(() => ({
  camera: {
    position: [0, 0, 5],
    lookAt: jest.fn(),
  },
  gl: {
    setSize: jest.fn(),
  },
})); 