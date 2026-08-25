import { t } from 'elysia';

export const createTeamBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 60 }),
});

// A team DTO (TeamRow from the service).
export const TeamResponse = t.Object({
  id: t.Number(),
  name: t.String(),
  role: t.Union([t.Literal('owner'), t.Literal('manager'), t.Literal('member')], {
    description: 'Your rank in this team.',
  }),
  createdAt: t.String(),
});

export const TeamListResponse = t.Array(TeamResponse);
