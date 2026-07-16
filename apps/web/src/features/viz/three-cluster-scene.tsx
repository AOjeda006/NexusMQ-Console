import { Canvas, useFrame } from '@react-three/fiber';
import { type ReactNode, useMemo, useRef } from 'react';
import type { Group } from 'three';

import type { VizTokens } from './use-viz-tokens';

interface SceneNode {
  readonly id: string;
  readonly position: readonly [number, number, number];
  readonly color: string;
}

function ClusterNode({
  position,
  color,
}: {
  position: SceneNode['position'];
  color: string;
}): ReactNode {
  return (
    <mesh position={position as [number, number, number]}>
      <sphereGeometry args={[0.42, 32, 32]} />
      <meshStandardMaterial color={color} roughness={0.35} metalness={0.1} />
    </mesh>
  );
}

function Cluster({ tokens }: { tokens: VizTokens }): ReactNode {
  const groupRef = useRef<Group>(null);

  const nodes = useMemo<readonly SceneNode[]>(() => {
    const count = 6;
    const radius = 2.3;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      return {
        id: `node-${i}`,
        position: [Math.cos(angle) * radius, Math.sin(angle * 2) * 0.5, Math.sin(angle) * radius],
        color: tokens.series[i % tokens.series.length] ?? tokens.primary,
      };
    });
  }, [tokens]);

  useFrame((_, delta) => {
    if (groupRef.current !== null) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <icosahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color={tokens.primary} roughness={0.3} metalness={0.15} />
      </mesh>
      {nodes.map((node) => (
        <ClusterNode key={node.id} position={node.position} color={node.color} />
      ))}
    </group>
  );
}

/**
 * Wrapper base de **react-three-fiber**: una mini-topología 3D (nodo líder +
 * seguidores en anillo) que rota despacio, coloreada con la paleta categórica de
 * los tokens dataviz y con fondo de la superficie del tema. Es el germen de la
 * topología *showstopper* del cluster (F3.5); aquí valida el pipeline WebGL y su
 * tematizado.
 */
export function ThreeClusterScene({
  tokens,
  className,
  ariaLabel,
}: {
  readonly tokens: VizTokens;
  readonly className?: string;
  readonly ariaLabel?: string;
}): ReactNode {
  return (
    <div className={className} role="img" aria-label={ariaLabel}>
      <Canvas camera={{ position: [0, 2.5, 6], fov: 45 }} dpr={[1, 2]}>
        <color attach="background" args={[tokens.surface]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[4, 6, 3]} intensity={1.1} />
        <Cluster tokens={tokens} />
      </Canvas>
    </div>
  );
}
