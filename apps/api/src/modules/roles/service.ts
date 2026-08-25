import { db, teamRole, projectMember } from '@repo/db';
import { and, asc, eq } from 'drizzle-orm';
import { iso } from '#shared/lib';
import { normalizePermissions, type Permissions } from '#shared/permissions';

// Data access for team roles: the permission matrices a team's projects assign to
// their members. Owners bypass roles. Exactly one role per team is the default
// (isDefault), assigned to members that join through an invite and used as the
// fallback for a member with no explicit role.

export interface RoleRow {
  id: number;
  name: string;
  isDefault: boolean;
  permissions: Permissions;
  createdAt: string;
}

function mapRole(row: typeof teamRole.$inferSelect): RoleRow {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    permissions: normalizePermissions(row.permissions),
    createdAt: iso(row.createdAt),
  };
}

export async function listRoles(teamId: number): Promise<RoleRow[]> {
  const rows = await db
    .select()
    .from(teamRole)
    .where(eq(teamRole.teamId, teamId))
    .orderBy(asc(teamRole.id));
  return rows.map(mapRole);
}

export async function getRole(teamId: number, roleId: number): Promise<RoleRow | null> {
  const rows = await db
    .select()
    .from(teamRole)
    .where(and(eq(teamRole.teamId, teamId), eq(teamRole.id, roleId)));
  return rows[0] ? mapRole(rows[0]) : null;
}

export async function createRole(
  teamId: number,
  input: { name: string; permissions: unknown },
): Promise<RoleRow> {
  const [row] = await db
    .insert(teamRole)
    .values({
      teamId,
      name: input.name,
      isDefault: false,
      permissions: normalizePermissions(input.permissions),
    })
    .returning();
  return mapRole(row);
}

export async function updateRole(
  teamId: number,
  roleId: number,
  input: { name?: string; permissions?: unknown },
): Promise<RoleRow | null> {
  const set: { name?: string; permissions?: Permissions } = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.permissions !== undefined) set.permissions = normalizePermissions(input.permissions);
  if (Object.keys(set).length === 0) return getRole(teamId, roleId);
  const [row] = await db
    .update(teamRole)
    .set(set)
    .where(and(eq(teamRole.teamId, teamId), eq(teamRole.id, roleId)))
    .returning();
  return row ? mapRole(row) : null;
}

// Deletes a role after reassigning every member on it, in any project of the team,
// to the team's default role, so no member is left with a dangling role. Runs in one
// transaction. The caller guards against deleting the default role itself.
export async function deleteRole(teamId: number, roleId: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [def] = await tx
      .select({ id: teamRole.id })
      .from(teamRole)
      .where(and(eq(teamRole.teamId, teamId), eq(teamRole.isDefault, true)));
    await tx
      .update(projectMember)
      .set({ roleId: def?.id ?? null })
      .where(eq(projectMember.roleId, roleId));
    await tx.delete(teamRole).where(and(eq(teamRole.teamId, teamId), eq(teamRole.id, roleId)));
  });
}
