import { db, team, teamMember } from '@repo/db';
import { eq } from 'drizzle-orm';
import { iso } from '#shared/lib';

export type TeamRole = 'owner' | 'manager' | 'member';

export interface TeamRow {
  id: number;
  name: string;
  // The caller's rank in the team, not a property of the team itself.
  role: TeamRole;
  createdAt: string;
}

export async function listTeams(userId: string): Promise<TeamRow[]> {
  const rows = await db
    .select({
      id: team.id,
      name: team.name,
      role: teamMember.role,
      createdAt: team.createdAt,
    })
    .from(teamMember)
    .innerJoin(team, eq(team.id, teamMember.teamId))
    .where(eq(teamMember.userId, userId))
    .orderBy(team.id);
  return rows.map((row) => ({ ...row, role: row.role as TeamRole, createdAt: iso(row.createdAt) }));
}

export async function createTeam(name: string, ownerId: string): Promise<TeamRow> {
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(team).values({ name }).returning();
    await tx.insert(teamMember).values({ teamId: row.id, userId: ownerId, role: 'owner' });
    return { id: row.id, name: row.name, role: 'owner', createdAt: iso(row.createdAt) };
  });
}
