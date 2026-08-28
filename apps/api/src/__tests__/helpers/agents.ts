import type { Api } from './app';

// The team that owns a project, which is where its agents live: a test that addresses
// an agent resolves the team from the project it works in. Never build a route inside
// an async function that returns it — a Treaty node answers to `then`, so awaiting one
// issues a request to `.../then` that never settles. Resolve the id first, then build
// the route where it is called.
export async function teamOf(api: Api, projectKey: string): Promise<number> {
  const projects = await api.projects.get();
  return projects.data!.find((p) => p.key === projectKey)!.teamId;
}

// The project's own id, for the calls that name the projects an agent works in.
export async function projectIdOf(api: Api, projectKey: string): Promise<number> {
  const projects = await api.projects.get();
  return projects.data!.find((p) => p.key === projectKey)!.id;
}

type CreateAgentBody = Parameters<ReturnType<Api['teams']>['ai-agents']['post']>[0];

// Creates an agent on the team that owns the project and attaches it to that project,
// which is what an agent bound to one project looks like now. An agent always acts
// under a role of its team, so a test that does not care which one gets the default.
// Returns the raw response so a test can assert on its status.
export async function createAgent(
  api: Api,
  projectKey: string,
  body: Omit<CreateAgentBody, 'roleId'> & { roleId?: number },
) {
  const projects = await api.projects.get();
  const project = projects.data!.find((p) => p.key === projectKey)!;
  const teamId = project.teamId;
  let roleId = body.roleId;
  if (roleId === undefined) {
    const roles = await api.teams({ teamId }).roles.get();
    roleId = (roles.data!.find((r) => r.isDefault) ?? roles.data![0]).id;
  }
  return api.teams({ teamId })['ai-agents'].post({
    projectIds: [project.id],
    ...body,
    roleId,
  });
}
