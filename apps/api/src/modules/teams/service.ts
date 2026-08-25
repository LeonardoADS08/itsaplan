import { db, issue, issueActivity, project, projectMember, team, teamMember, user } from '@repo/db';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { HttpError, iso } from '#shared/lib';
import type { Permissions } from '#shared/permissions';
import { listMemberContexts, listMembers, type MemberRole } from '#modules/members/service';
import { getStats, type StatsDto } from '#modules/analytics/service';

export type TeamRole = 'owner' | 'manager' | 'member';

export interface TeamRow {
  id: number;
  name: string;
  // The caller's rank in the team, not a property of the team itself.
  role: TeamRole;
  joinedAt: string;
  projectCount: number;
  memberCount: number;
  // How many of those members are owners: the last one cannot leave.
  ownerCount: number;
  createdAt: string;
}

// One member of a team, as the team detail lists them.
export interface TeamMemberRow {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: TeamRole;
  joinedAt: string;
}

// A project the team owns. `isMember` is the caller's own access to it: a team
// member sees every project of the team, but only opens the ones they belong to.
export interface TeamProjectRow {
  id: number;
  key: string;
  name: string;
  description: string;
  memberCount: number;
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
  // agent's handle, not one of its own.
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
  members: TeamMemberRow[];
  projects: TeamProjectRow[];
}

// The caller's teams as DTOs, optionally narrowed to one. Membership is the join,
// so a team the caller left is not returned at all.
async function loadTeamRows(userId: string, teamId?: number): Promise<TeamRow[]> {
  const rows = await db
    .select({
      id: team.id,
      name: team.name,
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
  const [projectCounts, memberCounts] = await Promise.all([
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
  ]);
  const projects = new Map(projectCounts.map((r) => [r.teamId, r.count]));
  const members = new Map(memberCounts.map((r) => [r.teamId, r]));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role as TeamRole,
    joinedAt: iso(row.joinedAt),
    projectCount: projects.get(row.id) ?? 0,
    memberCount: members.get(row.id)?.count ?? 0,
    ownerCount: members.get(row.id)?.owners ?? 0,
    createdAt: iso(row.createdAt),
  }));
}

export async function listTeams(userId: string): Promise<TeamRow[]> {
  return loadTeamRows(userId);
}

export async function getTeamMembership(teamId: number, userId: string): Promise<TeamRole | null> {
  const rows = await db
    .select({ role: teamMember.role })
    .from(teamMember)
    .where(and(eq(teamMember.teamId, teamId), eq(teamMember.userId, userId)));
  return rows[0] ? (rows[0].role as TeamRole) : null;
}

// The team with its members and the projects it owns. Returns null when the
// caller is not a member of it.
export async function getTeam(teamId: number, userId: string): Promise<TeamDetail | null> {
  const [row] = await loadTeamRows(userId, teamId);
  if (!row) return null;

  const [members, projects] = await Promise.all([
    db
      .select({
        userId: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: teamMember.role,
        joinedAt: teamMember.createdAt,
      })
      .from(teamMember)
      .innerJoin(user, eq(user.id, teamMember.userId))
      .where(eq(teamMember.teamId, teamId))
      .orderBy(user.name),
    db
      .select({
        id: project.id,
        key: project.key,
        name: project.name,
        description: project.description,
        createdAt: project.createdAt,
        memberCount: sql<number>`count(${projectMember.userId})::int`,
        isMember: sql<boolean>`bool_or(${projectMember.userId} = ${userId})`,
      })
      .from(project)
      .leftJoin(projectMember, eq(projectMember.projectId, project.id))
      .where(eq(project.teamId, teamId))
      .groupBy(project.id)
      .orderBy(project.key),
  ]);

  return {
    ...row,
    members: members.map((m) => ({
      userId: m.userId,
      name: m.name,
      email: m.email,
      image: m.image,
      role: m.role as TeamRole,
      joinedAt: iso(m.joinedAt),
    })),
    projects: projects.map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      description: p.description,
      memberCount: p.memberCount,
      isMember: p.isMember ?? false,
      createdAt: iso(p.createdAt),
    })),
  };
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

// One project the team owns, with its issue stats and its members. Returns null
// when the project is not owned by the team, so the route answers 404 for a
// project of another team.
export async function getTeamProject(
  teamId: number,
  projectId: number,
): Promise<TeamProjectDetail | null> {
  const owned = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.teamId, teamId)));
  if (owned.length === 0) return null;

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
    return {
      id: row.id,
      name: row.name,
      role: 'owner',
      joinedAt: iso(membership.createdAt),
      projectCount: 0,
      memberCount: 1,
      ownerCount: 1,
      createdAt: iso(row.createdAt),
    };
  });
}

export async function renameTeam(teamId: number, name: string, userId: string): Promise<TeamRow> {
  await db.update(team).set({ name }).where(eq(team.id, teamId));
  const [row] = await loadTeamRows(userId, teamId);
  return row;
}

// Drops the caller's membership. The team keeps its projects, so a member who
// leaves only loses the grouping, not the projects they belong to. The last owner
// cannot leave: a team without an owner has nobody who can rename it.
export async function leaveTeam(teamId: number, userId: string, role: TeamRole): Promise<void> {
  if (role === 'owner') {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(teamMember)
      .where(and(eq(teamMember.teamId, teamId), eq(teamMember.role, 'owner')));
    if (count === 1) throw new HttpError(409, 'The last owner cannot leave the team');
  }
  await db
    .delete(teamMember)
    .where(and(eq(teamMember.teamId, teamId), eq(teamMember.userId, userId)));
}
