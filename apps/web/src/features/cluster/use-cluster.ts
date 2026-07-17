import type { components } from '@nexusmq/contract';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/problem';

/** Estado del clúster y del consenso Raft. Sale del contrato, no se escribe a mano. */
export type ClusterInfo = components['schemas']['ClusterInfo'];
export type PartitionRaftInfo = components['schemas']['PartitionRaftInfo'];
export type NodeInfo = components['schemas']['NodeInfo'];

/** Clave de caché del estado del clúster. */
export const clusterQueryKey = ['cluster'] as const;

/** Resumen de salud del clúster/Raft para el Dashboard. */
export interface ClusterHealth {
  readonly nodeCount: number;
  readonly partitionCount: number;
  /** Particiones cuya réplica local es líder (`role === 'leader'`). */
  readonly ledBySelf: number;
  /** Particiones sin líder conocido (`leader < 0`): síntoma de inestabilidad. */
  readonly withoutLeader: number;
  /** Término Raft máximo observado entre particiones. */
  readonly maxTerm: number;
  /** Retraso máximo de cualquier seguidor (0 si no hay seguidores poblados). */
  readonly maxFollowerLag: number;
  /** Todo el clúster en buen estado (sin particiones huérfanas de líder). */
  readonly healthy: boolean;
}

/**
 * Resume el estado Raft en unos pocos indicadores de cabecera. La vista de
 * detalle (líder por partición, épocas, lag por seguidor) es F3.4/F3.5; aquí
 * basta el pulso de salud del clúster.
 */
export function summarizeCluster(cluster: ClusterInfo): ClusterHealth {
  const { partitions } = cluster;
  let ledBySelf = 0;
  let withoutLeader = 0;
  let maxTerm = 0;
  let maxFollowerLag = 0;
  for (const partition of partitions) {
    if (partition.role === 'leader') {
      ledBySelf += 1;
    }
    if (partition.leader < 0) {
      withoutLeader += 1;
    }
    maxTerm = Math.max(maxTerm, partition.term);
    for (const follower of partition.followers) {
      maxFollowerLag = Math.max(maxFollowerLag, follower.lag);
    }
  }
  return {
    nodeCount: cluster.nodes.length,
    partitionCount: partitions.length,
    ledBySelf,
    withoutLeader,
    maxTerm,
    maxFollowerLag,
    healthy: withoutLeader === 0,
  };
}

/**
 * Estado del clúster vía BFF, con **sondeo** periódico: `GET /api/v1/cluster` no
 * viaja por el SSE (que solo lleva métricas), así que el Dashboard lo refresca
 * con TanStack Query. Es una ruta protegida: en modo secreto exige sesión (el
 * guard de rutas ya garantiza que solo se llega aquí autenticado o en modo
 * abierto).
 */
export function useCluster(refetchIntervalMs = 3000): UseQueryResult<ClusterInfo, Error> {
  return useQuery({
    queryKey: clusterQueryKey,
    queryFn: () => apiClient.GET('/api/v1/cluster').then((result) => unwrap<ClusterInfo>(result)),
    refetchInterval: refetchIntervalMs,
    staleTime: 0,
  });
}
