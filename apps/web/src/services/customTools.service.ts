// The team's configured tools, and the tools enabled on one agent of a project. The
// tools belong to the team, so their hooks are keyed by the team; which of them an
// agent runs belongs to the agent, so those hooks are keyed by the project. The tool
// catalog they are built from lives in integrations.service.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type NewConfiguredToolInput } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useConfiguredToolsQuery(teamId: number | null) {
  return useQuery({
    queryKey: qk.configuredTools(teamId ?? 0),
    queryFn: () => api.listConfiguredTools(teamId!),
    enabled: teamId != null,
  });
}

export function useCreateConfiguredTool(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewConfiguredToolInput) => api.createConfiguredTool(teamId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.configuredTools(teamId) });
      // The team list carries how many tools the team holds.
      void qc.invalidateQueries({ queryKey: qk.teams });
    },
  });
}

export function useDeleteConfiguredTool(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteConfiguredTool(teamId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.configuredTools(teamId) });
      void qc.invalidateQueries({ queryKey: qk.teams });
    },
  });
}

// The configured tools enabled on one agent (the agent editor's Tools section).
export function useAgentToolLinksQuery(projectKey: string | null, agentId: number | null) {
  return useQuery({
    queryKey: qk.agentToolLinks(projectKey ?? '', agentId ?? 0),
    queryFn: () => api.listAgentToolLinks(projectKey!, agentId!),
    enabled: projectKey != null && agentId != null,
  });
}

export function useSetAgentTools(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, agentToolIds }: { agentId: number; agentToolIds: number[] }) =>
      api.setAgentTools(projectKey!, agentId, agentToolIds),
    onSuccess: (_data, { agentId }) => {
      if (projectKey)
        void qc.invalidateQueries({ queryKey: qk.agentToolLinks(projectKey, agentId) });
    },
  });
}
