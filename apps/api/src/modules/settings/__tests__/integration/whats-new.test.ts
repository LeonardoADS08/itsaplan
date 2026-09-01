import { describe, it, expect, beforeEach } from 'bun:test';
import { setSetting } from '@repo/db';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// The screen shown once after an upgrade. The report and the backup are app_setting
// rows — written by migration 0115 and by the api on startup — and resetDb truncates
// that table, so a test that wants them writes them itself.

const REPORT = {
  version: 1,
  teams: [{ name: 'alice', projects: [{ key: 'WEB', name: 'Website' }] }],
  renamed: { roles: [{ from: 'QA', to: 'QA (Website)' }] },
  merged: { roles: 1, agentTools: 0 },
  movedInvites: 2,
  droppedNotificationSettings: ['Website'],
};

async function signUpClient() {
  const user = await signUpTestUser();
  return { user, api: authedApi(user.cookie) };
}

describe('whats-new', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('is pending until the user closes it', async () => {
    const { api } = await signUpClient();

    const first = await api.settings['whats-new'].get();
    expect(first.status).toBe(200);
    expect(first.data?.pending).toBe(true);

    const seen = await api.settings['whats-new'].seen.post();
    expect(seen.data?.version).toBe(first.data!.version);

    const second = await api.settings['whats-new'].get();
    expect(second.data?.pending).toBe(false);
  });

  it('gives the instance owner the migration report', async () => {
    const { api } = await signUpClient();
    await setSetting('migration.0115_teams', REPORT);

    const res = await api.settings['whats-new'].get();
    expect(res.data?.migration).toMatchObject({ movedInvites: 2 });
    expect(res.data?.migration?.renamed.roles).toHaveLength(1);
  });

  it('hides the report from an account that is not the instance owner', async () => {
    await signUpClient();
    const other = await signUpClient();
    await setSetting('migration.0115_teams', REPORT);

    const res = await other.api.settings['whats-new'].get();
    expect(res.data?.migration).toBeNull();
    expect(res.data?.backup).toBeNull();
  });
});
