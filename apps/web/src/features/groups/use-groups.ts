import type { components } from '@nexusmq/contract';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/problem';

/** Resumen de un grupo de consumo (fila de la lista); sale del contrato. */
export type GroupSummary = components['schemas']['GroupSummary'];
export type GroupPage = components['schemas']['GroupPage'];
/** Estado del grupo (ciclo de vida del rebalanceo Kafka). */
export type GroupState = GroupSummary['state'];

/** Raíz de las claves de caché de grupos (para invalidar todas de golpe). */
export const groupsRootKey = ['groups'] as const;

/** Clave de caché de una página de grupos. */
export const groupsQueryKey = (page: number, size: number) =>
  [...groupsRootKey, 'page', page, size] as const;

/**
 * Lista los grupos de consumo (paginado) del broker vía BFF con el cliente
 * tipado del contrato. Los errores RFC 7807 se normalizan en {@link unwrap}.
 */
export function useGroups(page = 1, size = 20): UseQueryResult<GroupPage, Error> {
  return useQuery({
    queryKey: groupsQueryKey(page, size),
    queryFn: () =>
      apiClient
        .GET('/api/v1/groups', { params: { query: { page, size } } })
        .then((result) => unwrap<GroupPage>(result)),
  });
}
