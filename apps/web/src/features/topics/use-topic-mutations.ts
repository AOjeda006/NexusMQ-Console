import type { components } from '@nexusmq/contract';
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { unwrap, unwrapVoid } from '@/lib/problem';

import type { TopicSummary } from './use-topics';
import { topicsRootKey } from './use-topics';

/** Cuerpos de alta y de alteración de retención; salen del contrato. */
export type CreateTopicRequest = components['schemas']['CreateTopicRequest'];
export type AlterTopicRequest = components['schemas']['AlterTopicRequest'];

/** Parámetros del PATCH de retención: topic + campos mutables. */
export interface AlterRetentionVars {
  readonly name: string;
  readonly body: AlterTopicRequest;
}

/**
 * Crea un topic (`POST /api/v1/topics`). Al completarse invalida toda la caché de
 * topics para que la lista y las descripciones se recarguen con la realidad del
 * broker (nunca se manipula la caché a mano: el broker es la autoridad).
 */
export function useCreateTopic(): UseMutationResult<TopicSummary, Error, CreateTopicRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTopicRequest) =>
      apiClient.POST('/api/v1/topics', { body }).then((result) => unwrap<TopicSummary>(result)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: topicsRootKey }),
  });
}

/**
 * Altera la config mutable en caliente del topic (retención) vía
 * `PATCH /api/v1/topics/{name}`. Invalida la caché de topics: la **descripción se
 * vuelve a pedir al broker**, así que la UI refleja el efecto real del cambio, no
 * un valor optimista.
 */
export function useAlterRetention(): UseMutationResult<TopicSummary, Error, AlterRetentionVars> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, body }: AlterRetentionVars) =>
      apiClient
        .PATCH('/api/v1/topics/{name}', { params: { path: { name } }, body })
        .then((result) => unwrap<TopicSummary>(result)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: topicsRootKey }),
  });
}

/** Borra un topic (`DELETE /api/v1/topics/{name}`, 204). Invalida la caché de topics. */
export function useDeleteTopic(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiClient
        .DELETE('/api/v1/topics/{name}', { params: { path: { name } } })
        .then((result) => unwrapVoid(result)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: topicsRootKey }),
  });
}
