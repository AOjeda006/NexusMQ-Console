import { Canvas, useFrame } from '@react-three/fiber';
import { type ReactNode, useMemo, useRef } from 'react';
import { type Group, type Mesh, type MeshStandardMaterial, Quaternion, Vector3 } from 'three';

import type { VizTokens } from '@/features/viz/use-viz-tokens';

import type { ClusterInfo, PartitionRaftInfo } from './use-cluster';

const UP = new Vector3(0, 1, 0);
const NODE_RADIUS = 2.6;

/** Color de una arista según el lag del seguidor (salud del consenso). */
function lagColor(lag: number, tokens: VizTokens): string {
  if (lag <= 2) {
    return tokens.success;
  }
  if (lag <= 6) {
    return tokens.warning;
  }
  return tokens.critical;
}

/** Posiciones de los nodos en un anillo (XZ), por orden de `nodeId`. */
function useNodePositions(nodeIds: readonly number[]): Map<number, Vector3> {
  const key = nodeIds.join(',');
  return useMemo(() => {
    const map = new Map<number, Vector3>();
    nodeIds.forEach((id, i) => {
      const angle = (i / nodeIds.length) * Math.PI * 2;
      map.set(id, new Vector3(Math.cos(angle) * NODE_RADIUS, 0, Math.sin(angle) * NODE_RADIUS));
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

function NodeSphere({
  position,
  color,
  isSelf,
  isLeader,
}: {
  readonly position: Vector3;
  readonly color: string;
  readonly isSelf: boolean;
  readonly isLeader: boolean;
}): ReactNode {
  const materialRef = useRef<MeshStandardMaterial>(null);

  useFrame((state) => {
    if (materialRef.current !== null) {
      materialRef.current.emissiveIntensity = isLeader
        ? 0.5 + 0.35 * Math.sin(state.clock.elapsedTime * 3)
        : 0.08;
    }
  });

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[isLeader ? 0.58 : 0.42, 32, 32]} />
        <meshStandardMaterial
          ref={materialRef}
          color={color}
          emissive={color}
          roughness={0.35}
          metalness={0.15}
        />
      </mesh>
      {isSelf && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.82, 0.035, 16, 56]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
    </group>
  );
}

function Edge({
  from,
  to,
  color,
  lag,
}: {
  readonly from: Vector3;
  readonly to: Vector3;
  readonly color: string;
  readonly lag: number;
}): ReactNode {
  const meshRef = useRef<Mesh>(null);
  const { position, quaternion, length } = useMemo(() => {
    const direction = new Vector3().subVectors(to, from);
    return {
      position: new Vector3().addVectors(from, to).multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(UP, direction.clone().normalize()),
      length: direction.length(),
    };
  }, [from, to]);
  const radius = 0.03 + Math.min(lag, 12) * 0.006;

  // Pulso sutil de replicación líder → seguidor.
  useFrame((state) => {
    if (meshRef.current !== null) {
      const pulse = 0.7 + 0.3 * Math.sin(state.clock.elapsedTime * 2.5);
      (meshRef.current.material as MeshStandardMaterial).emissiveIntensity = 0.2 * pulse;
    }
  });

  return (
    <mesh ref={meshRef} position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 14]} />
      <meshStandardMaterial color={color} emissive={color} transparent opacity={0.85} />
    </mesh>
  );
}

function Scene({
  cluster,
  tokens,
  active,
}: {
  readonly cluster: ClusterInfo;
  readonly tokens: VizTokens;
  readonly active: PartitionRaftInfo | null;
}): ReactNode {
  const groupRef = useRef<Group>(null);
  const nodeIds = cluster.nodes.map((n) => n.nodeId);
  const positions = useNodePositions(nodeIds);
  const leaderId = active !== null && active.leader >= 0 ? active.leader : null;

  useFrame((_, delta) => {
    if (groupRef.current !== null) {
      groupRef.current.rotation.y += delta * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      {cluster.nodes.map((node) => {
        const position = positions.get(node.nodeId);
        if (position === undefined) {
          return null;
        }
        const color = tokens.series[(node.nodeId - 1) % tokens.series.length] ?? tokens.primary;
        return (
          <NodeSphere
            key={node.nodeId}
            position={position}
            color={color}
            isSelf={node.isSelf}
            isLeader={leaderId === node.nodeId}
          />
        );
      })}
      {active !== null &&
        leaderId !== null &&
        active.followers.map((follower) => {
          const from = positions.get(leaderId);
          const to = positions.get(follower.node);
          if (from === undefined || to === undefined) {
            return null;
          }
          return (
            <Edge
              key={follower.node}
              from={from}
              to={to}
              color={lagColor(follower.lag, tokens)}
              lag={follower.lag}
            />
          );
        })}
    </group>
  );
}

/**
 * Topología 3D del clúster (pieza *showstopper* de F3.5). Un nodo = una esfera en
 * el anillo, coloreada con la paleta categórica; el nodo local lleva halo. Para la
 * **partición activa**, el líder pulsa (glow) y salen **aristas de replicación** a
 * cada seguidor, con color por lag (verde/ámbar/rojo) y grosor por retraso: la
 * escena **responde a los cambios de líder** al seleccionar otra partición.
 */
export function ClusterTopology({
  cluster,
  tokens,
  active,
  className,
  ariaLabel,
}: {
  readonly cluster: ClusterInfo;
  readonly tokens: VizTokens;
  readonly active: PartitionRaftInfo | null;
  readonly className?: string;
  readonly ariaLabel?: string;
}): ReactNode {
  return (
    <div className={className} role="img" aria-label={ariaLabel}>
      <Canvas camera={{ position: [0, 3.2, 6.5], fov: 45 }} dpr={[1, 2]}>
        <color attach="background" args={[tokens.surface]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[4, 6, 3]} intensity={1.1} />
        <Scene cluster={cluster} tokens={tokens} active={active} />
      </Canvas>
    </div>
  );
}
