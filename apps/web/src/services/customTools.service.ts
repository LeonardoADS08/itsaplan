// The team's configured tools, and the tools enabled on one of its agents. Both belong
// to the team, so every hook here is keyed by it. The tool catalog they are built from
// lives in integrations.service.

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
export function useAgentToolLinksQuery(teamId: number | null, agentId: number | null) {
  return useQuery({
    queryKey: qk.agentToolLinks(teamId ?? 0, agentId ?? 0),
    queryFn: () => api.listAgentToolLinks(teamId!, agentId!),
    enabled: teamId != null && agentId != null,
  });
}

export function useSetAgentTools(teamId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, agentToolIds }: { agentId: number; agentToolIds: number[] }) =>
      api.setAgentTools(teamId!, agentId, agentToolIds),
    onSuccess: (_data, { agentId }) => {
      if (teamId != null)
        void qc.invalidateQueries({ queryKey: qk.agentToolLinks(teamId, agentId) });
    },
  });
}
