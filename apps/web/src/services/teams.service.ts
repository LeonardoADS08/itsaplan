import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Team } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useTeamsQuery() {
  return useQuery({ queryKey: qk.teams, queryFn: () => api.listTeams() });
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
