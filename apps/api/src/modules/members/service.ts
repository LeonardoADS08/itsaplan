import {
  db,
  project,
  projectMember,
  teamMember,
  teamRole,
  projectColumn,
  user,
  aiAgent,
  userPreference,
} from '@repo/db';
import { and, eq, isNull, notExists, sql } from 'drizzle-orm';
import { iso } from '#shared/lib';
import { DEFAULT_TIMEZONE } from '#modules/user-preferences/service';
import {
  defaultMemberPermissions,
  emptyPermissions,
  fullPermissions,
  normalizePermissions,
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
  type Permissions,
} from '#shared/permissions';

// Data access for project membership: which users can reach a project and their
// role in it ("owner" or "member"). Access checks resolve the owning project of
// any entity and look for the current user here.

export type MemberRole = 'owner' | 'member';

export interface MemberRow {
  userId: string;
  name: string;
  email: string;
  // The handle they are mentioned by, @username. An agent's bot user is written by
  // a direct insert and never gets one of its own, so it carries the agent's handle.
  username: string | null;
  // The zone this member reads timestamps in. Falls back to the same default as
  // their preferences do while they have not chosen one.
  timezone: string;
  image: string | null;
  role: MemberRole;
  // The custom role assigned to a member, or null. Owners bypass roles, so their
  // roleId is always null.
  roleId: number | null;
  roleName: string | null;
  // What this member does in the project, free text set by an owner. Empty when unset.
  description: string;
  // True when this member is an AI agent's bot user (has an ai_agent row). Agents
  // join by agent creation, not an invite, so their role and access are managed on
  // the AI Agents screen, not here.
  isAgent: boolean;
  createdAt: string;
}

// Someone who can be put in a project without an invite: a member of the team that
// owns it who is not in the project yet.
export interface MemberCandidate {
  userId: string;
  name: string;
  email: string;
  username: string | null;
  image: string | null;
}

// A member's effective access in a project: the owner/member flag plus the
// resolved permission matrix. Owners get the full matrix; a member resolves it
// from their assigned role, falling back to the default member matrix when no
// role is set.
export interface MemberContext {
  role: MemberRole;
  permissions: Permissions;
}

// The current user's role in a project, or null when they are not a member.
export async function getMembership(projectId: number, userId: string): Promise<MemberRole | null> {
  const rows = await db
    .select({ role: projectMember.role })
    .from(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)));
  return rows[0] ? (rows[0].role as MemberRole) : null;
}

export function toMemberContext(role: MemberRole, rolePermissions: unknown): MemberContext {
  if (role === 'owner') return { role, permissions: fullPermissions() };
  return {
    role,
    permissions: rolePermissions
      ? normalizePermissions(rolePermissions)
      : defaultMemberPermissions(),
  };
}

// The current user's role and resolved permission matrix in a project, or null
// when they are not a member. This is the single lookup behind assertPermission.
export async function getMemberContext(
  projectId: number,
  userId: string,
): Promise<MemberContext | null> {
  const rows = await db
    .select({
      role: projectMember.role,
      permissions: teamRole.permissions,
    })
    .from(projectMember)
    .leftJoin(teamRole, eq(teamRole.id, projectMember.roleId))
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)));
  const r = rows[0];
  return r ? toMemberContext(r.role as MemberRole, r.permissions) : null;
}

// The access a user has across a team: the permissions of their project memberships
// in it, merged. Permissions are only ever assigned per project, so this is what a
// team-scoped resource checks for a member who is neither owner nor manager of the
// team. Owning one of the projects carries the full matrix into the merge, which is
// what lets a project owner manage the resources the team holds for all of them.
// Someone who is a member of no project of the team gets an empty matrix.
export async function getTeamPermissions(teamId: number, userId: string): Promise<Permissions> {
  const rows = await db
    .select({ role: projectMember.role, permissions: teamRole.permissions })
    .from(projectMember)
    .innerJoin(project, eq(project.id, projectMember.projectId))
    .leftJoin(teamRole, eq(teamRole.id, projectMember.roleId))
    .where(and(eq(project.teamId, teamId), eq(projectMember.userId, userId)));
  const merged = emptyPermissions();
  for (const row of rows) {
    const { permissions } = toMemberContext(row.role as MemberRole, row.permissions);
    for (const resource of PERMISSION_RESOURCES) {
      for (const action of PERMISSION_ACTIONS) {
        merged[resource][action] ||= permissions[resource][action];
      }
    }
  }
  return merged;
}

// Every member's resolved access in the project, keyed by user id — getMemberContext
// in bulk, for a caller that judges several people at once (agents included: their
// bot user is a member like any other).
export async function listMemberContexts(projectId: number): Promise<Map<string, MemberContext>> {
  const rows = await db
    .select({
      userId: projectMember.userId,
      role: projectMember.role,
      permissions: teamRole.permissions,
    })
    .from(projectMember)
    .leftJoin(teamRole, eq(teamRole.id, projectMember.roleId))
    .where(eq(projectMember.projectId, projectId));
  return new Map(rows.map((r) => [r.userId, toMemberContext(r.role as MemberRole, r.permissions)]));
}

// A candidate an issue can be assigned to: a project member (a real user) or an
// AI agent (its bot user). Both are `user` rows, so assignment and authorship use
// user.id uniformly; `kind` lets the UI group "Members" and "AI Agents".
export interface AssigneeCandidate {
  userId: string;
  name: string;
  email: string;
  // The handle they are mentioned by, @username. Null for a member who has none.
  username: string | null;
  image: string | null;
  kind: 'member' | 'agent';
  agentKind: 'external' | 'internal' | null;
  // For a member: their owner/member flag and their project description, so callers
  // (the agent tool) can pick who to tag. Null for an agent.
  role: MemberRole | null;
  description: string | null;
  // The user an 'owner'-scoped external agent works for: only their runs reach its
  // runner, so delegating it to anyone else does nothing. Null for everyone else.
  restrictedToUserId: string | null;
}

export async function listAssigneeCandidates(projectId: number): Promise<AssigneeCandidate[]> {
  const [memberRows, agentRows] = await Promise.all([
    db
      .select({
        userId: projectMember.userId,
        name: user.name,
        email: user.email,
        username: user.username,
        image: user.image,
        role: projectMember.role,
        description: projectMember.description,
      })
      .from(projectMember)
      .innerJoin(user, eq(user.id, projectMember.userId))
      // An agent's bot user also holds a project_member row (that is how it gets its
      // permissions). It is listed below as kind 'agent', so it is excluded here to
      // keep the member candidates real people only. Same agent test as listMembers.
      .leftJoin(aiAgent, eq(aiAgent.userId, projectMember.userId))
      .where(and(eq(projectMember.projectId, projectId), isNull(aiAgent.id))),
    db
      .select({
        userId: aiAgent.userId,
        name: user.name,
        email: user.email,
        username: aiAgent.username,
        image: user.image,
        agentKind: aiAgent.kind,
        ownerUserId: aiAgent.ownerUserId,
        runnerScope: aiAgent.runnerScope,
      })
      .from(aiAgent)
      .innerJoin(user, eq(user.id, aiAgent.userId))
      // The agents working in the project: the ones its member list holds. An agent of
      // the team that is not a member is not offered, because the API refuses it.
      .innerJoin(
        projectMember,
        and(eq(projectMember.userId, aiAgent.userId), eq(projectMember.projectId, projectId)),
      ),
  ]);
  const members: AssigneeCandidate[] = memberRows.map((r) => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    username: r.username,
    image: r.image,
    kind: 'member',
    agentKind: null,
    role: r.role as MemberRole,
    description: r.description,
    restrictedToUserId: null,
  }));
  const agents: AssigneeCandidate[] = agentRows.map((r) => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    username: r.username,
    image: r.image,
    kind: 'agent',
    agentKind: r.agentKind as 'external' | 'internal',
    role: null,
    description: null,
    restrictedToUserId: r.runnerScope === 'owner' ? r.ownerUserId : null,
  }));
  return [...members, ...agents].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listMembers(projectId: number): Promise<MemberRow[]> {
  const rows = await db
    .select({
      userId: projectMember.userId,
      name: user.name,
      email: user.email,
      username: user.username,
      image: user.image,
      timezone: userPreference.timezone,
      role: projectMember.role,
      roleId: projectMember.roleId,
      roleName: teamRole.name,
      description: projectMember.description,
      agentId: aiAgent.id,
      agentUsername: aiAgent.username,
      createdAt: projectMember.createdAt,
    })
    .from(projectMember)
    .innerJoin(user, eq(user.id, projectMember.userId))
    .leftJoin(teamRole, eq(teamRole.id, projectMember.roleId))
    .leftJoin(aiAgent, eq(aiAgent.userId, projectMember.userId))
    .leftJoin(userPreference, eq(userPreference.userId, projectMember.userId))
    .where(eq(projectMember.projectId, projectId))
    .orderBy(projectMember.createdAt);
  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    username: r.username ?? r.agentUsername,
    image: r.image,
    timezone: r.timezone ?? DEFAULT_TIMEZONE,
    role: r.role as MemberRole,
    roleId: r.roleId,
    roleName: r.roleName,
    description: r.description,
    isAgent: r.agentId !== null,
    createdAt: iso(r.createdAt),
  }));
}

// Sets a member's project description (what they do). Returns false when the user is
// not a member of the project.
export async function setMemberDescription(
  projectId: number,
  userId: string,
  description: string,
): Promise<boolean> {
  const updated = await db
    .update(projectMember)
    .set({ description })
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)))
    .returning({ userId: projectMember.userId });
  return updated.length > 0;
}

// Adds a member of the team to one of its projects. Returns false when they are
// already in the project, which the route answers with a 409 rather than quietly
// changing the role they are on.
export async function addMember(
  projectId: number,
  userId: string,
  role: MemberRole,
  roleId: number | null,
): Promise<boolean> {
  const inserted = await db
    .insert(projectMember)
    .values({ projectId, userId, role, roleId })
    .onConflictDoNothing()
    .returning({ userId: projectMember.userId });
  return inserted.length > 0;
}

// The team's members who are not in the project yet: who can be added to it straight
// away, without an invite.
export async function listMemberCandidates(
  projectId: number,
  teamId: number,
): Promise<MemberCandidate[]> {
  return db
    .select({
      userId: teamMember.userId,
      name: user.name,
      email: user.email,
      username: user.username,
      image: user.image,
    })
    .from(teamMember)
    .innerJoin(user, eq(user.id, teamMember.userId))
    .where(
      and(
        eq(teamMember.teamId, teamId),
        notExists(
          db
            .select({ one: sql`1` })
            .from(projectMember)
            .where(
              and(
                eq(projectMember.projectId, projectId),
                eq(projectMember.userId, teamMember.userId),
              ),
            ),
        ),
      ),
    )
    .orderBy(user.name);
}

// Sets a member's owner/member flag and custom role in one update. Promoting to
// owner clears the role (owners bypass roles), so callers pass roleId null there;
// a member keeps roleId (null falls back to the default role). Returns false when
// the user is not a member of the project.
export async function setMembership(
  projectId: number,
  userId: string,
  role: MemberRole,
  roleId: number | null,
): Promise<boolean> {
  const updated = await db
    .update(projectMember)
    .set({ role, roleId })
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)))
    .returning({ userId: projectMember.userId });
  return updated.length > 0;
}

export async function removeMember(projectId: number, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(projectMember)
      .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)));
    // A column cannot keep assigning issues to someone who is no longer a member:
    // the same assignment sent as a patch would be refused.
    await tx
      .update(projectColumn)
      .set({ autoAssignUserId: null })
      .where(
        and(eq(projectColumn.projectId, projectId), eq(projectColumn.autoAssignUserId, userId)),
      );
  });
}

export async function countOwners(projectId: number): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.role, 'owner')));
  return rows[0]?.count ?? 0;
}
