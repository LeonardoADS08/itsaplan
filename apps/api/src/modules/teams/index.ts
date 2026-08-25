import { Elysia, t } from 'elysia';
import { requireUser, type AuthUser } from '#shared/access';
import { authContext } from '#shared/auth-context';
import { noContent } from '#shared/http';
import { HttpError } from '#shared/lib';
import { errors } from '#shared/responses';
import {
  TeamDetailResponse,
  TeamListResponse,
  TeamResponse,
  createTeamBody,
  teamParams,
  updateTeamBody,
} from './model';
import {
  createTeam,
  getTeam,
  getTeamMembership,
  leaveTeam,
  listTeams,
  renameTeam,
  type TeamRole,
} from './service';

type TeamParams = { teamId: string };

// Resolves the :teamId path param to the caller's membership in it. 404 for an
// unknown team and for one the caller is not a member of: a team the caller
// cannot see should not be distinguishable from one that does not exist.
async function requireTeamRole(
  params: unknown,
  user: AuthUser | undefined | null,
): Promise<{ teamId: number; role: TeamRole; userId: string }> {
  const current = requireUser(user);
  const teamId = Number((params as TeamParams).teamId);
  const role = await getTeamMembership(teamId, current.id);
  if (!role) throw new HttpError(404, 'Team not found');
  return { teamId, role, userId: current.id };
}

// The teams the session user belongs to. A team owns projects and its own member
// list; every account is given one at registration and may create more, becoming
// their owner.
export const teamRoutes = new Elysia({ name: 'teams', detail: { tags: ['Teams'] } })
  .use(authContext)
  .macro({
    // Any member of the team may proceed.
    teamMember(_enabled: boolean) {
      return {
        async resolve({ params, user }) {
          return { membership: await requireTeamRole(params, user) };
        },
      };
    },

    // Owner-only actions. A non-member gets the same 404 as for an unknown team,
    // since membership is resolved before the owner check.
    teamOwner(_enabled: boolean) {
      return {
        async resolve({ params, user }) {
          const membership = await requireTeamRole(params, user);
          if (membership.role !== 'owner')
            throw new HttpError(403, 'Only a team owner can do this');
          return { membership };
        },
      };
    },
  })

  .get('/teams', ({ user }) => listTeams(requireUser(user).id), {
    response: { 200: TeamListResponse, ...errors(401) },
    detail: {
      summary: 'List teams',
      description: 'List the teams you are a member of, with your rank in each.',
    },
  })

  .get(
    '/teams/:teamId',
    async ({ membership }) => {
      const team = await getTeam(membership.teamId, membership.userId);
      if (!team) throw new HttpError(404, 'Team not found');
      return team;
    },
    {
      teamMember: true,
      params: teamParams,
      response: { 200: TeamDetailResponse, ...errors(401, 404) },
      detail: {
        summary: 'Get a team',
        description: 'A team with its members and the projects it owns.',
      },
    },
  )

  .post(
    '/teams',
    async ({ body, user, set }) => {
      const name = body.name.trim();
      if (!name) throw new HttpError(400, 'Team name is required');
      set.status = 201;
      return createTeam(name, requireUser(user).id);
    },
    {
      body: createTeamBody,
      response: { 201: TeamResponse, ...errors(400, 401) },
      detail: {
        summary: 'Create a team',
        description: 'Create a team and become its owner.',
      },
    },
  )

  .patch(
    '/teams/:teamId',
    async ({ body, membership }) => {
      const name = body.name?.trim();
      if (!name) throw new HttpError(400, 'Team name is required');
      return renameTeam(membership.teamId, name, membership.userId);
    },
    {
      teamOwner: true,
      params: teamParams,
      body: updateTeamBody,
      response: { 200: TeamResponse, ...errors(400, 401, 403, 404) },
      detail: {
        summary: 'Rename a team',
        description: 'Rename a team you own.',
      },
    },
  )

  .post(
    '/teams/:teamId/leave',
    async ({ membership }) => {
      await leaveTeam(membership.teamId, membership.userId, membership.role);
      return noContent();
    },
    {
      teamMember: true,
      params: teamParams,
      response: { 204: t.Void(), ...errors(401, 404, 409) },
      detail: {
        summary: 'Leave a team',
        description:
          'Leave a team you belong to. The last owner cannot leave; the projects stay with the team.',
      },
    },
  );
