import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Team } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useTeamsQuery() {
  return useQuery({ queryKey: qk.teams, queryFn: () => api.listTeams() });
}

export function useTeamQuery(teamId: number) {
  return useQuery({ queryKey: qk.team(teamId), queryFn: () => api.getTeam(teamId) });
}

// One project the team owns. Fetched when the project's row is opened, so a team
// with many projects loads no stats or permission matrix it does not show.
export function useTeamProjectQuery(teamId: number, projectId: number) {
  return useQuery({
    queryKey: qk.teamProject(teamId, projectId),
    queryFn: () => api.getTeamProject(teamId, projectId),
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) => api.createTeam(input),
    onSuccess: (team) => {
      // Put the team in the cached list right away so the switcher shows it before
      // the refetch lands; it has no projects yet, so nothing else has to load.
      qc.setQueryData<Team[]>(qk.teams, (prev) => (prev ? [...prev, team] : [team]));
      void qc.invalidateQueries({ queryKey: qk.teams });
    },
  });
}

export function useRenameTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { teamId: number; name: string }) =>
      api.renameTeam(input.teamId, { name: input.name }),
    onSuccess: (team) => {
      void qc.invalidateQueries({ queryKey: qk.teams });
      void qc.invalidateQueries({ queryKey: qk.team(team.id) });
      // The switcher groups projects by team name, so the project list carries it too.
      void qc.invalidateQueries({ queryKey: qk.projects });
    },
  });
}

export function useLeaveTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: number) => api.leaveTeam(teamId),
    onSuccess: (_result, teamId) => {
      qc.setQueryData<Team[]>(qk.teams, (prev) => prev?.filter((t) => t.id !== teamId));
      void qc.invalidateQueries({ queryKey: qk.teams });
    },
  });
}
