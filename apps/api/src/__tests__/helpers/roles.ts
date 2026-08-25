import type { Api } from './app';

// Creates a role for a project through the team that owns it — roles live on the
// team, so a test that needs one for a project resolves its team first.
export async function createRole(
  api: Api,
  projectKey: string,
  body: { name: string; permissions: unknown },
) {
  const projects = await api.projects.get();
  const project = projects.data!.find((p) => p.key === projectKey)!;
  return api.teams({ teamId: project.teamId }).roles.post(body);
}
