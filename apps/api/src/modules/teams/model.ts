import { t } from 'elysia';
import { PermissionMatrixSchema } from '#shared/permissions';
import { StatsDto } from '#modules/analytics/model';

export const teamParams = t.Object({ teamId: t.Numeric() });

export const teamProjectParams = t.Object({ teamId: t.Numeric(), projectId: t.Numeric() });

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
  roleCount: t.Number({ description: "How many roles the team's projects assign from." }),
  integrationCount: t.Number({ description: 'How many integration credentials the team holds.' }),
  skillCount: t.Number({ description: 'How many agent skills the team library holds.' }),
  toolCount: t.Number({ description: 'How many configured tools the team holds.' }),
  createdAt: t.String(),
});

export const TeamListResponse = t.Array(TeamResponse);

export const TeamDetailResponse = t.Composite([
  TeamResponse,
  t.Object({ permissions: PermissionMatrixSchema }),
]);

export const TeamMemberListResponse = t.Array(
  t.Object({
    userId: t.String(),
    name: t.String(),
    email: t.String(),
    image: t.Nullable(t.String()),
    role: t.Union([t.Literal('owner'), t.Literal('manager'), t.Literal('member')]),
    joinedAt: t.String(),
  }),
);

export const TeamProjectListResponse = t.Array(
  t.Object({
    id: t.Number(),
    key: t.String(),
    name: t.String(),
    description: t.String(),
    memberCount: t.Number(),
    owners: t.Array(
      t.Object({
        userId: t.String(),
        name: t.String(),
        image: t.Nullable(t.String()),
      }),
      { description: 'The project members who own it.' },
    ),
    isMember: t.Boolean(),
    createdAt: t.String(),
  }),
);

// One project the team owns: how its issues stand, and the members with the access
// each membership resolves to.
export const TeamProjectDetailResponse = t.Object({
  lastActivityAt: t.Nullable(t.String()),
  stats: StatsDto,
  members: t.Array(
    t.Object({
      userId: t.String(),
      name: t.String(),
      email: t.String(),
      username: t.Nullable(t.String()),
      image: t.Nullable(t.String()),
      isAgent: t.Boolean(),
      role: t.Union([t.Literal('owner'), t.Literal('member')]),
      roleName: t.Nullable(t.String()),
      permissions: PermissionMatrixSchema,
    }),
  ),
});
