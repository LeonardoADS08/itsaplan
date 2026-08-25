import { t } from 'elysia';

export const teamParams = t.Object({ teamId: t.Numeric() });

export const createTeamBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 60 }),
});

export const updateTeamBody = t.Partial(createTeamBody);

// A team DTO (TeamRow from the service).
export const TeamResponse = t.Object({
  id: t.Number(),
  name: t.String(),
  role: t.Union([t.Literal('owner'), t.Literal('manager'), t.Literal('member')], {
    description: 'Your rank in this team.',
  }),
  joinedAt: t.String(),
  projectCount: t.Number(),
  memberCount: t.Number(),
  ownerCount: t.Number({ description: 'How many members are owners; the last one cannot leave.' }),
  createdAt: t.String(),
});

export const TeamListResponse = t.Array(TeamResponse);

export const TeamDetailResponse = t.Composite([
  TeamResponse,
  t.Object({
    members: t.Array(
      t.Object({
        userId: t.String(),
        name: t.String(),
        email: t.String(),
        image: t.Union([t.String(), t.Null()]),
        role: t.Union([t.Literal('owner'), t.Literal('manager'), t.Literal('member')]),
        joinedAt: t.String(),
      }),
    ),
    projects: t.Array(
      t.Object({
        id: t.Number(),
        key: t.String(),
        name: t.String(),
        description: t.String(),
        memberCount: t.Number(),
        isMember: t.Boolean(),
        createdAt: t.String(),
      }),
    ),
  }),
]);
