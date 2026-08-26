import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  type CredentialPatch,
  type IntegrationKind,
  type NewCredentialInput,
} from '@/lib/api';
import { qk } from '@/services/queryKeys';

// The team's stored credentials, secrets redacted. Backs the team's Integrations tab.
export function useCredentialsQuery(teamId: number) {
  return useQuery({
    queryKey: qk.teamCredentials(teamId),
    queryFn: () => api.listCredentials(teamId),
  });
}

// The connected integrations as picker options, for the agent and tool forms. Open
// to any project member, unlike the credential list above.
export function useIntegrationOptionsQuery(projectKey: string | null, kind?: IntegrationKind) {
  return useQuery({
    queryKey: qk.integrationOptions(projectKey ?? '', kind),
    queryFn: () => api.listIntegrationOptions(projectKey!, kind),
    enabled: projectKey != null,
  });
}

// The integrations the instance offers. Changes only on deploy, so it is cached
// for the session.
export function useIntegrationCatalogQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.integrationCatalog(projectKey ?? ''),
    queryFn: () => api.listIntegrationCatalog(projectKey!),
    enabled: projectKey != null,
    staleTime: Infinity,
  });
}

// The same catalog for the team panel, which knows the team and no project.
export function useTeamIntegrationCatalogQuery(teamId: number | null) {
  return useQuery({
    queryKey: qk.teamIntegrationCatalog(teamId ?? 0),
    queryFn: () => api.listTeamIntegrationCatalog(teamId!),
    enabled: teamId != null,
    staleTime: Infinity,
  });
}

// Models an LLM provider offers (from the models.dev registry). Fetched only when a
// provider is chosen; cached for the session.
export function useIntegrationModelsQuery(projectKey: string, provider: string | null) {
  return useQuery({
    queryKey: qk.integrationModels(projectKey, provider ?? ''),
    queryFn: () => api.listIntegrationModels(projectKey, provider!),
    enabled: provider != null && provider.length > 0,
    staleTime: Infinity,
  });
}

export function useCreateCredential(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewCredentialInput) => api.createCredential(teamId, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.integrations }),
  });
}

export function useUpdateCredential(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: CredentialPatch }) =>
      api.updateCredential(teamId, id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.integrations }),
  });
}

export function useDeleteCredential(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteCredential(teamId, id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.integrations }),
  });
}
