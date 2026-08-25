import { describe, it, expect, beforeEach } from 'bun:test';
import { api as anonApi, authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// The teams feature owns two routes: list and create. Every account is given a team
// at registration, named after its username, so a fresh account already lists one.

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
      expect(list.data?.[0]).toMatchObject({ name: user.username, role: 'owner' });
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
});
