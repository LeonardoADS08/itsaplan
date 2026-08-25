import { describe, it, expect, beforeEach } from 'bun:test';
import { api as anonApi, authedApi } from '#tests/helpers/app';
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
    it('returns the members and the projects of the team', async () => {
      const { user, api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });
      const teamId = (await api.teams.get()).data![0].id;

      const detail = await api.teams({ teamId }).get();
      expect(detail.status).toBe(200);
      expect(detail.data).toMatchObject({ name: user.username, role: 'owner' });
      expect(detail.data?.members).toMatchObject([{ email: user.email, role: 'owner' }]);
      expect(detail.data?.projects).toMatchObject([
        { key: 'MKT', name: 'Marketing', memberCount: 1, isMember: true },
      ]);
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

  describe('leave', () => {
    it('rejects the last owner leaving', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;

      const left = await api.teams({ teamId }).leave.post();
      expect(left.status).toBe(409);
      expect((await api.teams.get()).data).toHaveLength(1);
    });

    it('404s for a team the caller is not a member of', async () => {
      const { api } = await signUpClient();
      const other = await signUpClient();
      const otherTeamId = (await other.api.teams.get()).data![0].id;

      expect((await api.teams({ teamId: otherTeamId }).leave.post()).status).toBe(404);
    });
  });
});
