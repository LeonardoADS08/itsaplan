import { describe, it, expect, beforeEach } from 'bun:test';
import { api as anonApi, authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { addProjectMember } from '#tests/helpers/members';

// The teams feature owns list, create, detail, rename, and leave. Every account is
// given a team at registration, named after its username, so a fresh account already
// lists one.

async function signUpClient() {
  const user = await signUpTestUser();
  return { user, api: authedApi(user.cookie) };
}

// Signs up a user, invites them into the team on the given rank and accepts for them.
async function addTeamMember(
  owner: { api: Api },
  teamId: number,
  role: 'manager' | 'member' = 'member',
) {
  const user = await signUpTestUser();
  const created = await owner.api.teams({ teamId }).invites.post({ email: user.email, role });
  const api = authedApi(user.cookie);
  await api.invites({ token: created.data!.token }).accept.post();
  return { user, api };
}

async function memberRole(api: Api, teamId: number, userId: string) {
  const list = await api.teams({ teamId }).members.get();
  return list.data?.find((one) => one.userId === userId)?.role;
}

describe('teams', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('list', () => {
    it('lists the team the account was registered with', async () => {
      const { user, api } = await signUpClient();

      const list = await api.teams.get();
      expect(list.status).toBe(200);
      expect(list.data).toHaveLength(1);
      expect(list.data?.[0]).toMatchObject({
        name: user.username,
        role: 'owner',
        memberCount: 1,
        ownerCount: 1,
        projectCount: 0,
      });
    });

    it('counts the projects the team owns', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const list = await api.teams.get();
      expect(list.data?.[0]).toMatchObject({ projectCount: 1 });
    });

    it("lists only the caller's own teams", async () => {
      const { api } = await signUpClient();
      const other = await signUpClient();
      await other.api.teams.post({ name: 'Design' });

      const list = await api.teams.get();
      expect(list.data?.map((t) => t.name)).not.toContain('Design');
    });

    it('rejects a request without a session', async () => {
      const list = await anonApi.teams.get();
      expect(list.status).toBe(401);
    });
  });

  describe('create', () => {
    it('creates a team with the caller as its owner', async () => {
      const { api } = await signUpClient();

      const created = await api.teams.post({ name: 'Design' });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ name: 'Design', role: 'owner' });

      const list = await api.teams.get();
      expect(list.data).toHaveLength(2);
      expect(list.data?.map((t) => t.name)).toContain('Design');
    });

    it('trims the name', async () => {
      const { api } = await signUpClient();

      const created = await api.teams.post({ name: '  Design  ' });
      expect(created.data).toMatchObject({ name: 'Design' });
    });

    it('rejects an empty or blank name', async () => {
      const { api } = await signUpClient();

      expect((await api.teams.post({ name: '' })).status).toBe(400);
      expect((await api.teams.post({ name: '   ' })).status).toBe(400);
    });

    it('rejects a name longer than 60 characters', async () => {
      const { api } = await signUpClient();

      expect((await api.teams.post({ name: 'a'.repeat(60) })).status).toBe(201);
      expect((await api.teams.post({ name: 'a'.repeat(61) })).status).toBe(400);
    });

    it('rejects a request without a session', async () => {
      const created = await anonApi.teams.post({ name: 'Design' });
      expect(created.status).toBe(401);
    });
  });

  describe('detail', () => {
    it('returns the team with what it holds and what the caller may do', async () => {
      const { user, api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });
      const teamId = (await api.teams.get()).data![0].id;

      const detail = await api.teams({ teamId }).get();
      expect(detail.status).toBe(200);
      expect(detail.data).toMatchObject({
        name: user.username,
        role: 'owner',
        projectCount: 1,
        memberCount: 1,
        roleCount: 1,
        integrationCount: 0,
      });
      expect(detail.data?.permissions).toBeDefined();
    });

    it('lists the members and the projects of the team by their own routes', async () => {
      const { user, api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });
      const teamId = (await api.teams.get()).data![0].id;

      const members = await api.teams({ teamId }).members.get();
      expect(members.data).toMatchObject([{ email: user.email, role: 'owner' }]);

      const projects = await api.teams({ teamId }).projects.get();
      expect(projects.data).toMatchObject([
        { key: 'MKT', name: 'Marketing', memberCount: 1, isMember: true },
      ]);
    });

    it('lists a member only the projects they joined, and the manager all of them', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;
      await api.teams({ teamId }).projects.post({ key: 'MKT', name: 'Marketing' });
      await api.teams({ teamId }).projects.post({ key: 'OPS', name: 'Operations' });
      const member = await addTeamMember({ api }, teamId);
      const manager = await addTeamMember({ api }, teamId, 'manager');
      await api
        .projects({ projectKey: 'MKT' })
        .members.post({ userId: member.user.userId, role: 'member' });

      const mine = await member.api.teams({ teamId }).projects.get();
      expect(mine.data?.map((p) => p.key)).toEqual(['MKT']);
      expect((await member.api.teams.get()).data?.[0]).toMatchObject({ projectCount: 1 });

      const all = await manager.api.teams({ teamId }).projects.get();
      expect(all.data?.map((p) => p.key)).toEqual(['MKT', 'OPS']);
      expect((await manager.api.teams.get()).data?.[0]).toMatchObject({ projectCount: 2 });
    });

    it('hides a project detail from a member who did not join it', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;
      const project = await api.teams({ teamId }).projects.post({ key: 'MKT', name: 'Marketing' });
      const member = await addTeamMember({ api }, teamId);

      const denied = await member.api
        .teams({ teamId })
        .projects({ projectId: project.data!.id })
        .get();
      expect(denied.status).toBe(404);

      await api
        .projects({ projectKey: 'MKT' })
        .members.post({ userId: member.user.userId, role: 'member' });
      const allowed = await member.api
        .teams({ teamId })
        .projects({ projectId: project.data!.id })
        .get();
      expect(allowed.status).toBe(200);
    });

    it('hides the members and the projects of a team the caller is not in', async () => {
      const { api } = await signUpClient();
      const other = await signUpClient();
      const otherTeamId = (await other.api.teams.get()).data![0].id;

      expect((await api.teams({ teamId: otherTeamId }).members.get()).status).toBe(404);
      expect((await api.teams({ teamId: otherTeamId }).projects.get()).status).toBe(404);
    });

    it('hides a team the caller is not a member of', async () => {
      const { api } = await signUpClient();
      const other = await signUpClient();
      const otherTeamId = (await other.api.teams.get()).data![0].id;

      const detail = await api.teams({ teamId: otherTeamId }).get();
      expect(detail.status).toBe(404);
    });

    it('404s for an unknown team', async () => {
      const { api } = await signUpClient();

      expect((await api.teams({ teamId: 999999 }).get()).status).toBe(404);
    });
  });

  describe('project detail', () => {
    it('returns the members of a project the team owns with their resolved access', async () => {
      const { user, api } = await signUpClient();
      const project = await api.projects.post({ key: 'MKT', name: 'Marketing' });
      await addProjectMember(api, 'MKT');
      const teamId = (await api.teams.get()).data![0].id;

      const detail = await api.teams({ teamId }).projects({ projectId: project.data!.id }).get();
      expect(detail.status).toBe(200);
      expect(detail.data?.members).toHaveLength(2);

      const owner = detail.data!.members.find((m) => m.email === user.email)!;
      expect(owner).toMatchObject({ role: 'owner', roleName: null, isAgent: false });
      expect(owner.permissions.work_items.delete).toBe(true);

      const member = detail.data!.members.find((m) => m.email !== user.email)!;
      expect(member.role).toBe('member');
      expect(member.permissions.danger_zone.delete).toBe(false);
    });

    it('lists the owners of the project before its members', async () => {
      const { user, api } = await signUpClient();
      const project = await api.projects.post({ key: 'MKT', name: 'Marketing' });
      const promoted = await addProjectMember(api, 'MKT');
      const promotedUserId = (await api.projects({ projectKey: 'MKT' }).members.get()).data!.find(
        (m) => m.email !== user.email,
      )!.userId;
      await api
        .projects({ projectKey: 'MKT' })
        .members({ userId: promotedUserId })
        .patch({ role: 'owner' });
      // The account that created the project joined first, so it heads the list until
      // the other owner demotes it.
      await promoted
        .projects({ projectKey: 'MKT' })
        .members({ userId: user.userId })
        .patch({ role: 'member' });
      const teamId = (await api.teams.get()).data![0].id;

      const detail = await api.teams({ teamId }).projects({ projectId: project.data!.id }).get();
      expect(detail.data?.members.map((m) => m.role)).toEqual(['owner', 'member']);
      expect(detail.data?.members[0].userId).toBe(promotedUserId);
    });

    it('counts the open issues of the project and reports its last activity', async () => {
      const { api } = await signUpClient();
      const project = await api.projects.post({ key: 'MKT', name: 'Marketing' });
      const teamId = (await api.teams.get()).data![0].id;

      const empty = await api.teams({ teamId }).projects({ projectId: project.data!.id }).get();
      expect(empty.data?.stats).toMatchObject({ open: 0 });
      expect(empty.data?.lastActivityAt).toBeNull();

      const columnId = (await api.projects({ projectKey: 'MKT' }).get()).data!.columns[0].id;
      await api.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'First' });

      const detail = await api.teams({ teamId }).projects({ projectId: project.data!.id }).get();
      expect(detail.data?.stats).toMatchObject({ open: 1 });
      expect(detail.data?.lastActivityAt).not.toBeNull();
    });

    it("404s for a project of another account's team", async () => {
      const { api } = await signUpClient();
      const other = await signUpClient();
      const otherProject = await other.api.projects.post({ key: 'OTH', name: 'Other' });
      const teamId = (await api.teams.get()).data![0].id;

      const detail = await api
        .teams({ teamId })
        .projects({ projectId: otherProject.data!.id })
        .get();
      expect(detail.status).toBe(404);
    });

    it('404s for a team the caller is not a member of', async () => {
      const { api } = await signUpClient();
      const other = await signUpClient();
      const otherProject = await other.api.projects.post({ key: 'OTH', name: 'Other' });
      const otherTeamId = (await other.api.teams.get()).data![0].id;

      const detail = await api
        .teams({ teamId: otherTeamId })
        .projects({ projectId: otherProject.data!.id })
        .get();
      expect(detail.status).toBe(404);
    });
  });

  describe('team projects', () => {
    // The team the account was registered with, which owns the projects it creates.
    async function ownTeamId(api: Api): Promise<number> {
      return (await api.teams.get()).data![0].id;
    }

    describe('create', () => {
      it('creates a project the team owns, with the caller as its owner', async () => {
        const { user, api } = await signUpClient();
        const teamId = await ownTeamId(api);

        const created = await api
          .teams({ teamId })
          .projects.post({ key: 'MKT', name: 'Marketing' });
        expect(created.status).toBe(201);
        expect(created.data).toMatchObject({ key: 'MKT', teamId, teamName: user.username });

        const projects = await api.teams({ teamId }).projects.get();
        expect(projects.data).toMatchObject([{ key: 'MKT', isMember: true }]);
      });

      it('rejects a duplicate project key', async () => {
        const { api } = await signUpClient();
        const teamId = await ownTeamId(api);
        await api.teams({ teamId }).projects.post({ key: 'MKT', name: 'Marketing' });

        const dup = await api.teams({ teamId }).projects.post({ key: 'MKT', name: 'Other' });
        expect(dup.status).toBe(409);
      });

      it("404s for another account's team", async () => {
        const { api } = await signUpClient();
        const other = await signUpClient();
        const otherTeamId = await ownTeamId(other.api);

        const created = await api
          .teams({ teamId: otherTeamId })
          .projects.post({ key: 'MKT', name: 'Marketing' });
        expect(created.status).toBe(404);
        expect((await other.api.teams({ teamId: otherTeamId }).projects.get()).data).toHaveLength(
          0,
        );
      });
    });

    describe('copy', () => {
      it("copies a project of the team into the same team's new project", async () => {
        const { api } = await signUpClient();
        const teamId = await ownTeamId(api);
        const source = await api.teams({ teamId }).projects.post({ key: 'SRC', name: 'Source' });
        await api.projects({ projectKey: 'SRC' }).labels.post({ name: 'bug', color: '#ff0000' });

        const copied = await api
          .teams({ teamId })
          .projects({ projectId: source.data!.id })
          .copy.post({ key: 'DST', name: 'Destination' });
        expect(copied.status).toBe(201);
        expect(copied.data).toMatchObject({ key: 'DST', teamId });

        const view = await api.projects({ projectKey: 'DST' }).get();
        expect(view.data?.labels.map((l) => l.name)).toEqual(['bug']);
      });

      it("404s for a project of another account's team", async () => {
        const { api } = await signUpClient();
        const other = await signUpClient();
        const otherProject = await other.api.projects.post({ key: 'OTH', name: 'Other' });
        const teamId = await ownTeamId(api);

        const copied = await api
          .teams({ teamId })
          .projects({ projectId: otherProject.data!.id })
          .copy.post({ key: 'DST', name: 'Destination' });
        expect(copied.status).toBe(404);
      });
    });

    describe('update', () => {
      it('renames a project the team owns', async () => {
        const { api } = await signUpClient();
        const teamId = await ownTeamId(api);
        const project = await api
          .teams({ teamId })
          .projects.post({ key: 'MKT', name: 'Marketing' });

        const updated = await api
          .teams({ teamId })
          .projects({ projectId: project.data!.id })
          .patch({ name: 'Growth', description: 'What we ship' });
        expect(updated.status).toBe(200);
        expect(updated.data).toMatchObject({ key: 'MKT', name: 'Growth' });

        const projects = await api.teams({ teamId }).projects.get();
        expect(projects.data).toMatchObject([
          { key: 'MKT', name: 'Growth', description: 'What we ship' },
        ]);
      });

      it("404s for a project of another account's team", async () => {
        const { api } = await signUpClient();
        const other = await signUpClient();
        const otherProject = await other.api.projects.post({ key: 'OTH', name: 'Other' });
        const teamId = await ownTeamId(api);

        const updated = await api
          .teams({ teamId })
          .projects({ projectId: otherProject.data!.id })
          .patch({ name: 'Growth' });
        expect(updated.status).toBe(404);
        expect((await other.api.projects.get()).data?.[0]).toMatchObject({ name: 'Other' });
      });

      it('rejects an empty name', async () => {
        const { api } = await signUpClient();
        const teamId = await ownTeamId(api);
        const project = await api
          .teams({ teamId })
          .projects.post({ key: 'MKT', name: 'Marketing' });

        const updated = await api
          .teams({ teamId })
          .projects({ projectId: project.data!.id })
          .patch({ name: '' });
        expect(updated.status).toBe(400);
      });
    });

    describe('delete', () => {
      it('deletes a project the team owns', async () => {
        const { api } = await signUpClient();
        const teamId = await ownTeamId(api);
        const project = await api
          .teams({ teamId })
          .projects.post({ key: 'MKT', name: 'Marketing' });

        const deleted = await api
          .teams({ teamId })
          .projects({ projectId: project.data!.id })
          .delete();
        expect(deleted.status).toBe(204);
        expect((await api.teams({ teamId }).projects.get()).data).toHaveLength(0);
        expect((await api.projects.get()).data).toHaveLength(0);
      });

      it('404s for a project of another team, leaving it in place', async () => {
        const { api } = await signUpClient();
        const other = await signUpClient();
        const otherProject = await other.api.projects.post({ key: 'OTH', name: 'Other' });
        const teamId = await ownTeamId(api);

        const deleted = await api
          .teams({ teamId })
          .projects({ projectId: otherProject.data!.id })
          .delete();
        expect(deleted.status).toBe(404);
        expect((await other.api.projects.get()).data).toHaveLength(1);
      });
    });
  });

  describe('mcp settings', () => {
    // Marks a request as an MCP tool dispatch, the way the MCP endpoint marks its own
    // in-process requests. Forged here to reach the team-scoped gate without /mcp.
    const asMcp = { headers: { 'x-mcp-loopback': '1' } };

    it('starts with MCP on and every project covered', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;
      const project = (await api.projects.post({ key: 'MKT', name: 'Marketing' })).data!;

      expect((await api.teams.get()).data?.[0]).toMatchObject({ mcpEnabled: true });
      expect((await api.teams({ teamId }).projects.get()).data).toMatchObject([
        { id: project.id, mcpEnabled: true },
      ]);
    });

    it('sets the switch and the covered projects in one call', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;
      const on = (await api.projects.post({ key: 'ON', name: 'On' })).data!;
      const off = (await api.projects.post({ key: 'OFF', name: 'Off' })).data!;

      const res = await api.teams({ teamId }).mcp.patch({
        enabled: false,
        projects: [
          { projectId: on.id, enabled: true },
          { projectId: off.id, enabled: false },
        ],
      });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        enabled: false,
        projects: [
          { projectId: off.id, enabled: false },
          { projectId: on.id, enabled: true },
        ],
      });
      // The switch reaches the team list, which is what the UI reads it from.
      expect((await api.teams.get()).data?.[0]).toMatchObject({ mcpEnabled: false });
    });

    it('ignores a project of another team', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;
      const other = await signUpClient();
      const foreign = (await other.api.projects.post({ key: 'OTH', name: 'Other' })).data!;

      const res = await api.teams({ teamId }).mcp.patch({
        projects: [{ projectId: foreign.id, enabled: false }],
      });
      expect(res.status).toBe(200);
      expect(res.data?.projects).toEqual([]);

      // The other team's own project keeps its reach.
      const otherTeamId = (await other.api.teams.get()).data![0].id;
      expect((await other.api.teams({ teamId: otherTeamId }).projects.get()).data).toMatchObject([
        { id: foreign.id, mcpEnabled: true },
      ]);
    });

    it('lets a manager write the settings', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      const project = (await owner.api.projects.post({ key: 'MKT', name: 'Marketing' })).data!;
      const manager = await addTeamMember(owner, teamId, 'manager');

      const res = await manager.api.teams({ teamId }).mcp.patch({
        enabled: false,
        projects: [{ projectId: project.id, enabled: false }],
      });
      expect(res.status).toBe(200);
      expect((await owner.api.teams.get()).data?.[0]).toMatchObject({ mcpEnabled: false });
    });

    it('lets a member read the state but not write it', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const member = await addProjectMember(owner.api, 'MKT');

      expect((await member.teams({ teamId }).projects.get()).data).toMatchObject([
        { key: 'MKT', mcpEnabled: true },
      ]);
      expect((await member.teams({ teamId }).mcp.patch({ enabled: false })).status).toBe(403);
    });

    it("closes the team's own resources to MCP once the switch is off", async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;

      expect((await api.teams({ teamId })['ai-agents'].get(asMcp)).status).toBe(200);
      await api.teams({ teamId }).mcp.patch({ enabled: false });

      // The web app still reaches them; only the MCP surface closes.
      expect((await api.teams({ teamId })['ai-agents'].get()).status).toBe(200);
      const blocked = await api.teams({ teamId })['ai-agents'].get(asMcp);
      expect(blocked.status).toBe(403);
      expect((blocked.error?.value as { error: string }).error).toBe(
        'MCP is disabled for this team',
      );
    });

    it('hides a team with MCP off from an MCP list_teams call', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;
      const second = (await api.teams.post({ name: 'Growth' })).data!;
      await api.teams({ teamId }).mcp.patch({ enabled: false });

      expect((await api.teams.get()).data?.map((t) => t.id).sort()).toEqual(
        [teamId, second.id].sort(),
      );
      expect((await api.teams.get(asMcp)).data?.map((t) => t.id)).toEqual([second.id]);
    });
  });

  describe('rename', () => {
    it('renames a team the caller owns', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;

      const renamed = await api.teams({ teamId }).patch({ name: '  Growth  ' });
      expect(renamed.status).toBe(200);
      expect(renamed.data).toMatchObject({ name: 'Growth' });

      const list = await api.teams.get();
      expect(list.data?.[0]).toMatchObject({ name: 'Growth' });
    });

    it('rejects a blank name', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;

      expect((await api.teams({ teamId }).patch({ name: '   ' })).status).toBe(400);
    });

    it("rejects a rename of another account's team", async () => {
      const { api } = await signUpClient();
      const other = await signUpClient();
      const otherTeamId = (await other.api.teams.get()).data![0].id;

      const renamed = await api.teams({ teamId: otherTeamId }).patch({ name: 'Growth' });
      expect(renamed.status).toBe(404);
    });
  });

  describe('member rank', () => {
    it('promotes a member to manager', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      const member = await addTeamMember(owner, teamId);

      const patched = await owner.api
        .teams({ teamId })
        .members({ userId: member.user.userId })
        .patch({ role: 'manager' });
      expect(patched.status).toBe(204);
      expect(await memberRole(owner.api, teamId, member.user.userId)).toBe('manager');
    });

    it('lets a manager change a plain member, but not grant the owner rank', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      const manager = await addTeamMember(owner, teamId, 'manager');
      const member = await addTeamMember(owner, teamId);

      const promoted = await manager.api
        .teams({ teamId })
        .members({ userId: member.user.userId })
        .patch({ role: 'owner' });
      expect(promoted.status).toBe(403);

      const demoted = await manager.api
        .teams({ teamId })
        .members({ userId: owner.user.userId })
        .patch({ role: 'member' });
      expect(demoted.status).toBe(403);

      const changed = await manager.api
        .teams({ teamId })
        .members({ userId: member.user.userId })
        .patch({ role: 'manager' });
      expect(changed.status).toBe(204);
    });

    it('rejects changing your own rank, and keeps an owner in place', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      const second = await addTeamMember(owner, teamId);
      await owner.api
        .teams({ teamId })
        .members({ userId: second.user.userId })
        .patch({ role: 'owner' });

      const self = await owner.api
        .teams({ teamId })
        .members({ userId: owner.user.userId })
        .patch({ role: 'member' });
      expect(self.status).toBe(409);

      // Demoting an owner takes a second owner, which is what leaves the team one.
      const demoted = await second.api
        .teams({ teamId })
        .members({ userId: owner.user.userId })
        .patch({ role: 'member' });
      expect(demoted.status).toBe(204);
      expect(await memberRole(owner.api, teamId, owner.user.userId)).toBe('member');
    });

    it('403s for a plain member', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      const member = await addTeamMember(owner, teamId);
      const other = await addTeamMember(owner, teamId);

      const patched = await member.api
        .teams({ teamId })
        .members({ userId: other.user.userId })
        .patch({ role: 'manager' });
      expect(patched.status).toBe(403);
    });
  });

  describe('remove a member', () => {
    it('drops the member and their access to the projects of the team', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const member = await addTeamMember(owner, teamId);
      await owner.api
        .projects({ projectKey: 'MKT' })
        .members.post({ userId: member.user.userId, role: 'member' });

      const removed = await owner.api
        .teams({ teamId })
        .members({ userId: member.user.userId })
        .delete();
      expect(removed.status).toBe(204);

      const members = await owner.api.teams({ teamId }).members.get();
      expect(members.data?.some((one) => one.userId === member.user.userId)).toBe(false);
      expect((await member.api.projects({ projectKey: 'MKT' }).get()).status).toBe(403);
      expect((await member.api.teams.get()).data?.some((one) => one.id === teamId)).toBe(false);
    });

    it('rejects removing yourself, and 404s for someone outside the team', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      const outsider = await signUpClient();

      const self = await owner.api
        .teams({ teamId })
        .members({ userId: owner.user.userId })
        .delete();
      expect(self.status).toBe(409);

      const stranger = await owner.api
        .teams({ teamId })
        .members({ userId: outsider.user.userId })
        .delete();
      expect(stranger.status).toBe(404);
    });

    it('403s for a manager', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      const manager = await addTeamMember(owner, teamId, 'manager');
      const member = await addTeamMember(owner, teamId);

      const removed = await manager.api
        .teams({ teamId })
        .members({ userId: member.user.userId })
        .delete();
      expect(removed.status).toBe(403);
    });
  });

  describe('leave', () => {
    it('rejects the last owner leaving', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;

      const left = await api.teams({ teamId }).leave.post();
      expect(left.status).toBe(409);
      expect((await api.teams.get()).data).toHaveLength(1);
    });

    it('takes the projects of the team with it', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const member = await addTeamMember(owner, teamId);
      await owner.api
        .projects({ projectKey: 'MKT' })
        .members.post({ userId: member.user.userId, role: 'member' });

      expect((await member.api.teams({ teamId }).leave.post()).status).toBe(204);
      expect((await member.api.projects({ projectKey: 'MKT' }).get()).status).toBe(403);
    });

    it('404s for a team the caller is not a member of', async () => {
      const { api } = await signUpClient();
      const other = await signUpClient();
      const otherTeamId = (await other.api.teams.get()).data![0].id;

      expect((await api.teams({ teamId: otherTeamId }).leave.post()).status).toBe(404);
    });
  });
});
