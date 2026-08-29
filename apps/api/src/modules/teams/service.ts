import {
  agentSkill,
  agentTool,
  aiAgent,
  db,
  integrationCredential,
  issue,
  issueActivity,
  project,
  projectColumn,
  projectMember,
  team,
  teamMember,
  teamRole,
  user,
} from '@repo/db';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { HttpError, iso } from '#shared/lib';
import { defaultMemberPermissions, fullPermissions, type Permissions } from '#shared/permissions';
import {
  getTeamPermissions,
  listMemberContexts,
  listMembers,
  type MemberRole,
} from '#modules/members/service';
import { getStats, type StatsDto } from '#modules/analytics/service';

// The rank a person holds in a team.
export type TeamRole = 'owner' | 'manager' | 'member';

// What a team_member row can say. An agent's bot user belongs to the team and appears
// in its member list, but its standing grants nothing: what it may do is the team role
// on its ai_agent row.
export type TeamStanding = TeamRole | 'agent';

// Owners and managers run the team, so they hold everything it can grant. Everyone
// else — a member, and an agent — holds what their project roles in it grant.
export function runsTeam(standing: TeamStanding | null): boolean {
  return standing === 'owner' || standing === 'manager';
}

export interface TeamRow {
  id: number;
  name: string;
  // Whether the team is reachable over MCP at all. Off closes its own resources and
  // every project it owns, whichever projects it covers.
  mcpEnabled: boolean;
  // The caller's standing in the team, not a property of the team itself. An agent
  // reading its own team is 'agent', which runs nothing.
  role: TeamStanding;
  joinedAt: string;
  projectCount: number;
  memberCount: number;
  // How many of those members are owners: the last one cannot leave.
  ownerCount: number;
  // The roles the team's projects assign from, the integration credentials they run
  // on, the agents that work in them, and the skills and tools those agents use.
  // Counted here so the page shows them beside the section without opening it.
  roleCount: number;
  integrationCount: number;
  agentCount: number;
  skillCount: number;
  toolCount: number;
  createdAt: string;
}

// One member of a team, as the team detail lists them: a person, or the bot user of
// one of the team's agents. An agent carries the id and handle it is addressed by and
// the name of the team role it acts under — its standing in the team is 'agent', which
// says nothing about what it may do.
export interface TeamMemberRow {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: TeamStanding;
  agentId: number | null;
  username: string | null;
  agentRoleName: string | null;
  joinedAt: string;
}

// A project the team owns. `isMember` is the caller's own access to it: a team
// member sees every project of the team, but only opens the ones they belong to.
export interface TeamProjectRow {
  id: number;
  key: string;
  name: string;
  description: string;
  // Whether the team's MCP reach covers this project. Only counts while the team's
  // own switch is on.
  mcpEnabled: boolean;
  memberCount: number;
  owners: { userId: string; name: string; image: string | null }[];
  isMember: boolean;
  createdAt: string;
}

// One member of a project the team owns, with the access their project membership
// resolves to. The same facts the god project panel shows, read by a team member.
export interface TeamProjectMemberRow {
  userId: string;
  name: string;
  email: string;
  // The handle they are mentioned by, @username. An agent's bot user carries the
  // agent's handle.
  username: string | null;
  image: string | null;
  isAgent: boolean;
  role: MemberRole;
  roleName: string | null;
  permissions: Permissions;
}

// One project of the team, opened: how it is doing and who can reach it.
export interface TeamProjectDetail {
  // The most recent entry in the project's issue feed, or null when nothing has
  // happened in it yet.
  lastActivityAt: string | null;
  stats: StatsDto;
  members: TeamProjectMemberRow[];
}

export interface TeamDetail extends TeamRow {
  // What the caller may do with the resources the team holds for all its projects.
  // Owners and managers run the team, so they get the full matrix; a member gets the
  // permissions of their project roles in it, merged.
  permissions: Permissions;
}

// The caller's teams as DTOs, optionally narrowed to one. Membership is the join,
// so a team the caller left is not returned at all.
async function loadTeamRows(userId: string, teamId?: number): Promise<TeamRow[]> {
  const rows = await db
    .select({
      id: team.id,
      name: team.name,
      mcpEnabled: team.mcpEnabled,
      role: teamMember.role,
      joinedAt: teamMember.createdAt,
      createdAt: team.createdAt,
    })
    .from(teamMember)
    .innerJoin(team, eq(team.id, teamMember.teamId))
    .where(
      teamId === undefined
        ? eq(teamMember.userId, userId)
        : and(eq(teamMember.userId, userId), eq(team.id, teamId)),
    )
    .orderBy(team.id);
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [
    projectCounts,
    memberCounts,
    roleCounts,
    integrationCounts,
    agentCounts,
    skillCounts,
    toolCounts,
  ] = await Promise.all([
    db
      .select({ teamId: project.teamId, count: sql<number>`count(*)::int` })
      .from(project)
      .where(inArray(project.teamId, ids))
      .groupBy(project.teamId),
    db
      .select({
        teamId: teamMember.teamId,
        count: sql<number>`count(*)::int`,
        owners: sql<number>`count(*) filter (where ${teamMember.role} = 'owner')::int`,
      })
      .from(teamMember)
      .where(inArray(teamMember.teamId, ids))
      .groupBy(teamMember.teamId),
    db
      .select({ teamId: teamRole.teamId, count: sql<number>`count(*)::int` })
      .from(teamRole)
      .where(inArray(teamRole.teamId, ids))
      .groupBy(teamRole.teamId),
    db
      .select({ teamId: integrationCredential.teamId, count: sql<number>`count(*)::int` })
      .from(integrationCredential)
      .where(inArray(integrationCredential.teamId, ids))
      .groupBy(integrationCredential.teamId),
    db
      .select({ teamId: aiAgent.teamId, count: sql<number>`count(*)::int` })
      .from(aiAgent)
      .where(inArray(aiAgent.teamId, ids))
      .groupBy(aiAgent.teamId),
    db
      .select({ teamId: agentSkill.teamId, count: sql<number>`count(*)::int` })
      .from(agentSkill)
      .where(inArray(agentSkill.teamId, ids))
      .groupBy(agentSkill.teamId),
    db
      .select({ teamId: agentTool.teamId, count: sql<number>`count(*)::int` })
      .from(agentTool)
      .where(inArray(agentTool.teamId, ids))
      .groupBy(agentTool.teamId),
  ]);
  const projects = new Map(projectCounts.map((r) => [r.teamId, r.count]));
  const members = new Map(memberCounts.map((r) => [r.teamId, r]));
  const roles = new Map(roleCounts.map((r) => [r.teamId, r.count]));
  const integrations = new Map(integrationCounts.map((r) => [r.teamId, r.count]));
  const agents = new Map(agentCounts.map((r) => [r.teamId, r.count]));
  const skills = new Map(skillCounts.map((r) => [r.teamId, r.count]));
  const tools = new Map(toolCounts.map((r) => [r.teamId, r.count]));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    mcpEnabled: row.mcpEnabled,
    role: row.role as TeamStanding,
    joinedAt: iso(row.joinedAt),
    projectCount: projects.get(row.id) ?? 0,
    memberCount: members.get(row.id)?.count ?? 0,
    ownerCount: members.get(row.id)?.owners ?? 0,
    roleCount: roles.get(row.id) ?? 0,
    integrationCount: integrations.get(row.id) ?? 0,
    agentCount: agents.get(row.id) ?? 0,
    skillCount: skills.get(row.id) ?? 0,
    toolCount: tools.get(row.id) ?? 0,
    createdAt: iso(row.createdAt),
  }));
}

// The teams the user belongs to. mcpOnly drops the ones with MCP switched off, so an
// MCP caller only sees the teams it can act in.
export async function listTeams(
  userId: string,
  opts: { mcpOnly?: boolean } = {},
): Promise<TeamRow[]> {
  const rows = await loadTeamRows(userId);
  return opts.mcpOnly ? rows.filter((row) => row.mcpEnabled) : rows;
}

// The team's MCP switch alone, for the guard that runs on every team-scoped MCP call.
export async function teamMcpEnabled(teamId: number): Promise<boolean> {
  const [row] = await db
    .select({ mcpEnabled: team.mcpEnabled })
    .from(team)
    .where(eq(team.id, teamId));
  return row?.mcpEnabled ?? false;
}

// The team's MCP settings: the switch, and which of its projects it covers. Both are
// written from the team's MCP section — a project does not open itself.
export interface TeamMcpSettings {
  enabled: boolean;
  projects: { projectId: number; enabled: boolean }[];
}

async function getTeamMcp(teamId: number): Promise<TeamMcpSettings> {
  const [rows, projects] = await Promise.all([
    db.select({ mcpEnabled: team.mcpEnabled }).from(team).where(eq(team.id, teamId)),
    db
      .select({ projectId: project.id, enabled: project.mcpEnabled })
      .from(project)
      .where(eq(project.teamId, teamId))
      .orderBy(project.key),
  ]);
  return { enabled: rows[0]?.mcpEnabled ?? false, projects };
}

// Applies a patch to the team's MCP settings and returns the result. A project of
// another team is ignored rather than written, so an id from elsewhere changes
// nothing.
export async function setTeamMcp(
  teamId: number,
  patch: { enabled?: boolean; projects?: { projectId: number; enabled: boolean }[] },
): Promise<TeamMcpSettings> {
  if (patch.enabled !== undefined) {
    await db.update(team).set({ mcpEnabled: patch.enabled }).where(eq(team.id, teamId));
  }
  // Written as one statement per value rather than one per project, so a whole set
  // of checkboxes costs two.
  for (const enabled of [true, false]) {
    const ids = (patch.projects ?? []).filter((p) => p.enabled === enabled).map((p) => p.projectId);
    if (ids.length === 0) continue;
    await db
      .update(project)
      .set({ mcpEnabled: enabled })
      .where(and(eq(project.teamId, teamId), inArray(project.id, ids)));
  }
  return getTeamMcp(teamId);
}

export async function getTeamMembership(
  teamId: number,
  userId: string,
): Promise<TeamStanding | null> {
  const rows = await db
    .select({ role: teamMember.role })
    .from(teamMember)
    .where(and(eq(teamMember.teamId, teamId), eq(teamMember.userId, userId)));
  return rows[0] ? (rows[0].role as TeamStanding) : null;
}

// The team itself: the row the list carries, with what the caller may do with the
// resources it holds. Its members and its projects are read separately, one request
// per section of the page. Returns null when the caller is not a member of it.
export async function getTeam(teamId: number, userId: string): Promise<TeamDetail | null> {
  const [row] = await loadTeamRows(userId, teamId);
  if (!row) return null;

  const permissions = runsTeam(row.role)
    ? fullPermissions()
    : await getTeamPermissions(teamId, userId);
  return { ...row, permissions };
}

// The members of the team, people and agents alike, by name.
export async function listTeamMembers(teamId: number): Promise<TeamMemberRow[]> {
  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: teamMember.role,
      agentId: aiAgent.id,
      username: aiAgent.username,
      agentRoleName: teamRole.name,
      joinedAt: teamMember.createdAt,
    })
    .from(teamMember)
    .innerJoin(user, eq(user.id, teamMember.userId))
    .leftJoin(aiAgent, eq(aiAgent.userId, teamMember.userId))
    .leftJoin(teamRole, eq(teamRole.id, aiAgent.roleId))
    .where(eq(teamMember.teamId, teamId))
    .orderBy(user.name);

  return rows.map((m) => ({
    userId: m.userId,
    name: m.name,
    email: m.email,
    image: m.image,
    role: m.role as TeamStanding,
    agentId: m.agentId,
    username: m.username,
    agentRoleName: m.agentRoleName,
    joinedAt: iso(m.joinedAt),
  }));
}

// The projects the team owns, with the caller's own access to each.
export async function listTeamProjects(teamId: number, userId: string): Promise<TeamProjectRow[]> {
  const [projects, projectOwners] = await Promise.all([
    db
      .select({
        id: project.id,
        key: project.key,
        name: project.name,
        description: project.description,
        mcpEnabled: project.mcpEnabled,
        createdAt: project.createdAt,
        memberCount: sql<number>`count(${projectMember.userId})::int`,
        isMember: sql<boolean>`bool_or(${projectMember.userId} = ${userId})`,
      })
      .from(project)
      .leftJoin(projectMember, eq(projectMember.projectId, project.id))
      .where(eq(project.teamId, teamId))
      .groupBy(project.id)
      .orderBy(project.key),
    db
      .select({
        projectId: projectMember.projectId,
        userId: user.id,
        name: user.name,
        image: user.image,
      })
      .from(projectMember)
      .innerJoin(project, eq(project.id, projectMember.projectId))
      .innerJoin(user, eq(user.id, projectMember.userId))
      .where(and(eq(project.teamId, teamId), eq(projectMember.role, 'owner')))
      .orderBy(user.name),
  ]);

  const ownersByProject = new Map<number, TeamProjectRow['owners']>();
  for (const o of projectOwners) {
    const owners = ownersByProject.get(o.projectId) ?? [];
    owners.push({ userId: o.userId, name: o.name, image: o.image });
    ownersByProject.set(o.projectId, owners);
  }

  return projects.map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description,
    mcpEnabled: p.mcpEnabled,
    memberCount: p.memberCount,
    owners: ownersByProject.get(p.id) ?? [],
    isMember: p.isMember ?? false,
    createdAt: iso(p.createdAt),
  }));
}

// When the project's issue feed last moved. Read as the newest row rather than a
// max(), which the driver returns as a formatted string instead of a Date.
async function lastActivityAt(projectId: number): Promise<string | null> {
  const rows = await db
    .select({ createdAt: issueActivity.createdAt })
    .from(issueActivity)
    .innerJoin(issue, eq(issue.id, issueActivity.issueId))
    .where(eq(issue.projectId, projectId))
    .orderBy(desc(issueActivity.createdAt))
    .limit(1);
  return rows[0] ? iso(rows[0].createdAt) : null;
}

// Whether the project is one the team owns. The team-scoped project routes check it
// so a project of another team answers 404 rather than being acted on.
export async function teamOwnsProject(teamId: number, projectId: number): Promise<boolean> {
  const rows = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.teamId, teamId)));
  return rows.length > 0;
}

// One project the team owns, with its issue stats and its members. Returns null
// when the project is not owned by the team, so the route answers 404 for a
// project of another team.
export async function getTeamProject(
  teamId: number,
  projectId: number,
): Promise<TeamProjectDetail | null> {
  if (!(await teamOwnsProject(teamId, projectId))) return null;

  const [activity, stats, members, contexts] = await Promise.all([
    lastActivityAt(projectId),
    getStats(projectId),
    listMembers(projectId),
    listMemberContexts(projectId),
  ]);
  const memberRows = members.flatMap((m) => {
    const context = contexts.get(m.userId);
    if (!context) return [];
    return [
      {
        userId: m.userId,
        name: m.name,
        email: m.email,
        username: m.username,
        image: m.image,
        isAgent: m.isAgent,
        role: m.role,
        roleName: m.roleName,
        permissions: context.permissions,
      },
    ];
  });

  return {
    lastActivityAt: activity,
    stats,
    // Owners first, the rest in the order they joined: who runs the project is the
    // first thing the list has to answer.
    members: memberRows.sort((a, b) => Number(b.role === 'owner') - Number(a.role === 'owner')),
  };
}

export async function createTeam(name: string, ownerId: string): Promise<TeamRow> {
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(team).values({ name }).returning();
    const [membership] = await tx
      .insert(teamMember)
      .values({ teamId: row.id, userId: ownerId, role: 'owner' })
      .returning();
    // The roles the team's projects assign live on the team, so it starts with the
    // default one, as the sign-up hook in @repo/auth does for the team it creates.
    await tx.insert(teamRole).values({
      teamId: row.id,
      name: 'Member',
      isDefault: true,
      permissions: defaultMemberPermissions(),
    });
    return {
      id: row.id,
      name: row.name,
      mcpEnabled: row.mcpEnabled,
      role: 'owner',
      joinedAt: iso(membership.createdAt),
      projectCount: 0,
      memberCount: 1,
      ownerCount: 1,
      roleCount: 1,
      integrationCount: 0,
      agentCount: 0,
      skillCount: 0,
      toolCount: 0,
      createdAt: iso(row.createdAt),
    };
  });
}

export async function renameTeam(teamId: number, name: string, userId: string): Promise<TeamRow> {
  await db.update(team).set({ name }).where(eq(team.id, teamId));
  const [row] = await loadTeamRows(userId, teamId);
  return row;
}

// Changes what a member ranks as in the team. An agent's standing comes from its
// agent settings, and nobody sets their own rank. Only an owner grants the owner rank
// or changes what another owner holds, which is also what keeps the last owner in
// place: demoting an owner takes a second one.
export async function setTeamMemberRole(
  teamId: number,
  actor: { userId: string; role: TeamStanding },
  userId: string,
  role: TeamRole,
): Promise<void> {
  if (userId === actor.userId) throw new HttpError(409, 'You cannot change your own rank');

  const current = await getTeamMembership(teamId, userId);
  if (!current) throw new HttpError(404, 'Member not found');
  if (current === 'agent')
    throw new HttpError(409, "An agent's rank comes from its agent settings");
  if (actor.role !== 'owner' && (role === 'owner' || current === 'owner'))
    throw new HttpError(403, 'Only a team owner can grant or take the owner rank');

  await db
    .update(teamMember)
    .set({ role })
    .where(and(eq(teamMember.teamId, teamId), eq(teamMember.userId, userId)));
}

// Ends a team membership: the member leaves the team and every project it owns. What
// they already did in those projects stays — issues keep their assignee and their
// author.
async function dropTeamMembership(teamId: number, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const teamProjects = tx
      .select({ id: project.id })
      .from(project)
      .where(eq(project.teamId, teamId));
    await tx
      .delete(projectMember)
      .where(and(eq(projectMember.userId, userId), inArray(projectMember.projectId, teamProjects)));
    // A column cannot keep assigning issues to someone who no longer belongs to the
    // project, the same rule remove_member follows.
    await tx
      .update(projectColumn)
      .set({ autoAssignUserId: null })
      .where(
        and(
          eq(projectColumn.autoAssignUserId, userId),
          inArray(projectColumn.projectId, teamProjects),
        ),
      );
    await tx
      .delete(teamMember)
      .where(and(eq(teamMember.teamId, teamId), eq(teamMember.userId, userId)));
  });
}

// Removes a member from the team. Nobody removes themselves — that is leaving the
// team. Removing an owner is possible because the actor is one and stays, so the team
// never loses its last owner.
export async function removeTeamMember(
  teamId: number,
  actorId: string,
  userId: string,
): Promise<void> {
  if (userId === actorId) throw new HttpError(409, 'Leave the team instead of removing yourself');

  const current = await getTeamMembership(teamId, userId);
  if (!current) throw new HttpError(404, 'Member not found');
  if (current === 'agent') throw new HttpError(409, 'An agent is removed with its agent settings');

  await dropTeamMembership(teamId, userId);
}

// Drops the caller's own membership, with their access to the team's projects. The
// team keeps the projects themselves. The last owner cannot leave: a team without an
// owner has nobody who can rename it.
export async function leaveTeam(teamId: number, userId: string, role: TeamStanding): Promise<void> {
  if (role === 'owner') {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(teamMember)
      .where(and(eq(teamMember.teamId, teamId), eq(teamMember.role, 'owner')));
    if (count === 1) throw new HttpError(409, 'The last owner cannot leave the team');
  }
  await dropTeamMembership(teamId, userId);
}
