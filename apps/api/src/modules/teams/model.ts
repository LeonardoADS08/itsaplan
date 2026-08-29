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
  mcpEnabled: t.Boolean({
    description:
      'Whether the team is reachable over MCP. Off closes its own resources and every ' +
      'project it owns.',
  }),
  role: t.Union(
    [t.Literal('owner'), t.Literal('manager'), t.Literal('member'), t.Literal('agent')],
    { description: 'Your standing in this team.' },
  ),
  joinedAt: t.String(),
  projectCount: t.Number(),
  memberCount: t.Number(),
  ownerCount: t.Number({ description: 'How many members are owners; the last one cannot leave.' }),
  roleCount: t.Number({ description: "How many roles the team's projects assign from." }),
  integrationCount: t.Number({ description: 'How many integration credentials the team holds.' }),
  agentCount: t.Number({ description: 'How many AI agents the team owns.' }),
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
    role: t.Union([
      t.Literal('owner'),
      t.Literal('manager'),
      t.Literal('member'),
      t.Literal('agent'),
    ]),
    agentId: t.Nullable(t.Number({ description: 'The AI agent this bot user backs.' })),
    username: t.Nullable(t.String({ description: "An agent's mention handle." })),
    agentRoleName: t.Nullable(
      t.String({ description: 'The team role an agent acts under, which is what it may do.' }),
    ),
    joinedAt: t.String(),
  }),
);

export const TeamProjectListResponse = t.Array(
  t.Object({
    id: t.Number(),
    key: t.String(),
    name: t.String(),
    description: t.String(),
    mcpEnabled: t.Boolean({ description: "Whether the team's MCP reach covers this project." }),
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

// The team's MCP settings: the switch, and the projects its reach covers.
export const TeamMcpResponse = t.Object({
  enabled: t.Boolean(),
  projects: t.Array(t.Object({ projectId: t.Number(), enabled: t.Boolean() })),
});

export const updateTeamMcpBody = t.Object({
  enabled: t.Optional(t.Boolean()),
  projects: t.Optional(t.Array(t.Object({ projectId: t.Number(), enabled: t.Boolean() }))),
});
