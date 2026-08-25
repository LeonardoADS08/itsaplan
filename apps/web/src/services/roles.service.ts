import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Permissions } from '@/lib/api';
import { qk } from '@/services/queryKeys';

// The resources and actions of the permission matrix. Static for the app's
// lifetime, so it never goes stale.
export function usePermissionCatalogQuery() {
  return useQuery({
    queryKey: qk.permissionCatalog,
    queryFn: () => api.getPermissionCatalog(),
    staleTime: Infinity,
  });
}

// The roles a project assigns from — the ones its team offers. Listable by any
// member, but only owners have a use for them; pass enabled=false for a non-owner
// to skip the request.
export function useProjectRolesQuery(projectKey: string | null, enabled = true) {
  return useQuery({
    queryKey: qk.projectRoles(projectKey ?? ''),
    queryFn: () => api.listProjectRoles(projectKey!),
    enabled: projectKey != null && enabled,
  });
}

// A team's own roles, for the panel that manages them.
export function useTeamRolesQuery(teamId: number | null) {
  return useQuery({
    queryKey: qk.teamRoles(teamId ?? 0),
    queryFn: () => api.listTeamRoles(teamId!),
    enabled: teamId != null,
  });
}

// What a role is assigned to, read when the delete dialog opens: the counts decide
// whether the caller has to name a role to move them to.
export function useRoleUsageQuery(teamId: number, roleId: number) {
  return useQuery({
    queryKey: qk.roleUsage(teamId, roleId),
    queryFn: () => api.getRoleUsage(teamId, roleId),
  });
}

// A role belongs to the team, so a write to it changes what every project of that
// team offers and what its members, agents and pending invites resolve to. The
// project-scoped lists are keyed by project, so they are dropped wholesale rather
// than by key.
function useRoleMutation<TInput, TResult>(
  teamId: number,
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.teamRoles(teamId) });
      qc.invalidateQueries({ queryKey: qk.anyProjectRoles });
      qc.invalidateQueries({ queryKey: qk.anyRoleUsage });
      qc.invalidateQueries({ queryKey: qk.anyMembers });
      qc.invalidateQueries({ queryKey: qk.anyAiAgents });
      qc.invalidateQueries({ queryKey: qk.anyInvites });
      qc.invalidateQueries({ queryKey: qk.anyTeamInvites });
    },
  });
}

export function useCreateRole(teamId: number) {
  return useRoleMutation(teamId, (input: { name: string; permissions: Permissions }) =>
    api.createRole(teamId, input),
  );
}

export function useUpdateRole(teamId: number) {
  return useRoleMutation(
    teamId,
    ({ roleId, patch }: { roleId: number; patch: { name?: string; permissions?: Permissions } }) =>
      api.updateRole(teamId, roleId, patch),
  );
}

// targetRoleId is where the members, agents and pending invites on the role are
// moved; the API refuses to delete a role in use without it.
export function useDeleteRole(teamId: number) {
  return useRoleMutation(
    teamId,
    ({ roleId, targetRoleId }: { roleId: number; targetRoleId?: number }) =>
      api.deleteRole(teamId, roleId, targetRoleId),
  );
}
