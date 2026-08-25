import { Elysia } from 'elysia';
import { requireUser } from '#shared/access';
import { authContext } from '#shared/auth-context';
import { HttpError } from '#shared/lib';
import { errors } from '#shared/responses';
import { TeamListResponse, TeamResponse, createTeamBody } from './model';
import { createTeam, listTeams } from './service';

// The teams the session user belongs to. A team owns projects and its own member
// list; every account is given one at registration and may create more, becoming
// their owner.
export const teamRoutes = new Elysia({ name: 'teams', detail: { tags: ['Teams'] } })
  .use(authContext)

  .get('/teams', ({ user }) => listTeams(requireUser(user).id), {
    response: { 200: TeamListResponse, ...errors(401) },
    detail: {
      summary: 'List teams',
      description: 'List the teams you are a member of, with your rank in each.',
    },
  })

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
  );
