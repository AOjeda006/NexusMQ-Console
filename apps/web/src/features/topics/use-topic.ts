import type { components } from '@nexusmq/contract';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/problem';

import { topicsRootKey } from './use-topics';

/** Descripción completa de un topic (resumen + config mutable + particiones). */
export type TopicDescription = components['schemas']['TopicDescription'];
export type PartitionInfo = components['schemas']['PartitionInfo'];
export type TopicConfigView = components['schemas']['TopicConfigView'];

/** Clave de caché de la descripción de un topic. */
export const topicQueryKey = (name: string) => [...topicsRootKey, 'detail', name] as const;

/**
 * Describe un topic (`GET /api/v1/topics/{name}`): config de retención y sus
 * particiones (líder, high-watermark, época). Deshabilitada mientras `name` sea
 * `null` (no hay topic seleccionado).
 */
export function useTopic(name: string | null): UseQueryResult<TopicDescription, Error> {
  return useQuery({
    queryKey: topicQueryKey(name ?? ''),
    enabled: name !== null,
    queryFn: () =>
      apiClient
        .GET('/api/v1/topics/{name}', { params: { path: { name: name ?? '' } } })
        .then((result) => unwrap<TopicDescription>(result)),
  });
}
