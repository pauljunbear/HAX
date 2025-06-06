'use client';

import React, { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useTexture } from '@react-three/drei';
import * as THREE from 'three';

export interface ThreeDEffectsCanvasProps {
  /** Image data URL to use as texture */
  imageUrl?: string;
  /** 3D effect type to render */
  effectType?: '3dPlane' | '3dCube' | '3dTilt' | '3dParallax';
  /** Whether the 3D canvas is visible */
  visible?: boolean;
  /** Depth of the 3D effect */
  depth?: number;
  /** Rotation speed for animated effects */
  rotationSpeed?: number;
  /** Tilt intensity for parallax effects */
  tiltIntensity?: number;
  /** Camera controls enabled */
  controlsEnabled?: boolean;
  /** Canvas dimensions */
  width?: number;
  height?: number;
  /** Custom className for styling */
  className?: string;
  /** Z-index for positioning */
  zIndex?: number;
}

// Image plane component that displays the texture
const ImagePlane: React.FC<{
  imageUrl: string;
  effectType: string;
  depth: number;
  rotationSpeed: number;
  tiltIntensity: number;
}> = ({ imageUrl, effectType, depth, rotationSpeed, tiltIntensity }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  
  // Load texture
  const texture = useTexture(imageUrl);
  
  // Get mouse position for parallax effects
  const { mouse } = useThree();
  
  // Animation loop
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    switch (effectType) {
      case '3dCube':
        // Continuous rotation
        meshRef.current.rotation.x += rotationSpeed * delta;
        meshRef.current.rotation.y += rotationSpeed * delta;
        break;
        
      case '3dTilt':
        // Tilt based on mouse position
        meshRef.current.rotation.x = mouse.y * tiltIntensity;
        meshRef.current.rotation.y = mouse.x * tiltIntensity;
        break;
        
      case '3dParallax':
        // Subtle parallax movement
        meshRef.current.position.x = mouse.x * tiltIntensity * 0.5;
        meshRef.current.position.y = mouse.y * tiltIntensity * 0.5;
        meshRef.current.rotation.x = mouse.y * tiltIntensity * 0.3;
        meshRef.current.rotation.y = mouse.x * tiltIntensity * 0.3;
        break;
        
      default:
        // 3dPlane - subtle hover effect
        if (hovered) {
          meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, depth * 0.1, 0.1);
        } else {
          meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, 0, 0.1);
        }
        break;
    }
  });
  
  // Calculate geometry based on effect type and texture aspect ratio
  const aspectRatio = texture.image ? texture.image.width / texture.image.height : 1;
  const geometry = React.useMemo(() => {
    switch (effectType) {
      case '3dCube':
        return new THREE.BoxGeometry(2, 2, 2);
      default:
        return new THREE.PlaneGeometry(4 * aspectRatio, 4);
    }
  }, [effectType, aspectRatio]);
  
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  );
};

// Loading fallback component
const LoadingPlaceholder: React.FC = () => (
  <mesh>
    <planeGeometry args={[4, 3]} />
    <meshBasicMaterial color="#333333" />
  </mesh>
);

// Main 3D Effects Canvas component
const ThreeDEffectsCanvas: React.FC<ThreeDEffectsCanvasProps> = ({
  imageUrl,
  effectType = '3dPlane',
  visible = true,
  depth = 1,
  rotationSpeed = 1,
  tiltIntensity = 0.2,
  controlsEnabled = true,
  width = 800,
  height = 600,
  className = '',
  zIndex = 10
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webGLSupported, setWebGLSupported] = useState(true);
  
  // Check WebGL support
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    setWebGLSupported(!!gl);
  }, []);
  
  // Fallback for devices without WebGL support
  if (!webGLSupported) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-100 text-gray-600 ${className}`}
        style={{ width, height, zIndex }}
      >
        <div className="text-center">
          <div className="text-sm font-medium mb-2">3D effects not supported</div>
          <div className="text-xs">WebGL is required for 3D effects</div>
        </div>
      </div>
    );
  }
  
  if (!visible || !imageUrl) {
    return null;
  }
  
  return (
    <div 
      className={`relative ${className}`}
      style={{ width, height, zIndex }}
    >
      <Canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 0, 5], fov: 75 }}
        gl={{ 
          alpha: true, 
          antialias: true,
          powerPreference: 'high-performance'
        }}
      >
        {/* Camera and controls */}
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        {controlsEnabled && (
          <OrbitControls 
            enableZoom={effectType === '3dCube'}
            enablePan={false}
            enableRotate={effectType === '3dCube'}
            maxPolarAngle={Math.PI / 2}
            minPolarAngle={Math.PI / 2}
          />
        )}
        
        {/* Lighting */}
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 10, 5]} intensity={0.5} />
        
        {/* 3D Image */}
        <Suspense fallback={<LoadingPlaceholder />}>
          <ImagePlane
            imageUrl={imageUrl}
            effectType={effectType}
            depth={depth}
            rotationSpeed={rotationSpeed}
            tiltIntensity={tiltIntensity}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default ThreeDEffectsCanvas; 