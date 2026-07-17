import type { components } from '@nexusmq/contract';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/problem';

import { groupsRootKey } from './use-groups';

/** Descripción de un grupo: estado, miembros y offsets confirmados con lag. */
export type GroupDescription = components['schemas']['GroupDescription'];
export type GroupMember = components['schemas']['GroupMember'];
export type GroupPartitionOffset = components['schemas']['GroupPartitionOffset'];

/** Clave de caché de la descripción de un grupo. */
export const groupQueryKey = (id: string) => [...groupsRootKey, 'detail', id] as const;

/**
 * Describe un grupo (`GET /api/v1/groups/{id}`): miembros y offsets confirmados
 * por partición, con el **lag** (`highWatermark - committedOffset`). Deshabilitada
 * mientras `id` sea `null`.
 */
export function useGroup(id: string | null): UseQueryResult<GroupDescription, Error> {
  return useQuery({
    queryKey: groupQueryKey(id ?? ''),
    enabled: id !== null,
    queryFn: () =>
      apiClient
        .GET('/api/v1/groups/{id}', { params: { path: { id: id ?? '' } } })
        .then((result) => unwrap<GroupDescription>(result)),
  });
}
