import type { components } from '@nexusmq/contract';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/problem';

/** Resumen de un topic (fila de la lista); sale del contrato, no se escribe a mano. */
export type TopicSummary = components['schemas']['TopicSummary'];

/** Página de topics devuelta por `GET /api/v1/topics`. */
export type TopicPage = components['schemas']['TopicPage'];

/** Raíz de las claves de caché de topics (para invalidar todas de golpe). */
export const topicsRootKey = ['topics'] as const;

/** Clave de caché de una página de topics. */
export const topicsQueryKey = (page: number, size: number) =>
  [...topicsRootKey, 'page', page, size] as const;

/**
 * Lista los topics (paginado) del broker vía BFF, con el cliente tipado del
 * contrato. Los errores (incluido `problem+json`) se normalizan a `ProblemError`
 * en {@link unwrap} y llegan a la UI por `error`.
 */
export function useTopics(page = 1, size = 20): UseQueryResult<TopicPage, Error> {
  return useQuery({
    queryKey: topicsQueryKey(page, size),
    queryFn: () =>
      apiClient
        .GET('/api/v1/topics', { params: { query: { page, size } } })
        .then((result) => unwrap<TopicPage>(result)),
  });
}
