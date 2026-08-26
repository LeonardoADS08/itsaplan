import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors } from '#shared/responses';
import { mcpTool } from '#mcp/generate';
import { getProjectTeamId } from '#modules/projects/service';
import { teamParams } from '#modules/teams/model';
import { INTEGRATION_CATALOG, integrationKind } from './catalog';
import { listModelsForProvider } from './provider-models';
import {
  CredentialListResponse,
  CredentialResponse,
  IntegrationCatalogResponse,
  IntegrationOptionListResponse,
  ProviderModelListResponse,
  createCredentialBody,
  credentialParams,
  integrationOptionsQuery,
  providerParams,
  updateCredentialBody,
} from './model';
import { listCredentials, createCredential, updateCredential, deleteCredential } from './service';

// The credential store belongs to the team and serves every project it owns, so the
// writes sit under :teamId, gated by the integrations resource on the team: its owner
// and managers always, an owner of one of its projects always, another member when a
// project role of theirs grants it.
//
// The reads a project needs — the catalog, a provider's models, the picker options and
// the credential list — stay under :projectKey, the same as list_roles for a resource
// the team also owns. That is what keeps them behind the per-project MCP toggle: the
// team guards resolve membership only, so a tool tagged on a :teamId route would answer
// an MCP call against a project that has MCP off. The writes are not exposed as MCP
// tools, because a credential body carries the provider's secret in plain text.
export const integrationRoutes = new Elysia({
  name: 'integrations',
  detail: { tags: ['Integrations'] },
})
  .use(authContext)
  .use(guards)

  // The frontend builds the credential form from credentialSchema. Open to any project
  // member: the catalog is a constant in this codebase, not project data.
  .get('/projects/:projectKey/integrations/catalog', () => INTEGRATION_CATALOG, {
    projectMember: true,
    response: { 200: IntegrationCatalogResponse, ...accessErrors },
    detail: {
      summary: 'List available integrations',
      description:
        "List the integration catalog: LLM providers (kind 'llm') and tool integrations " +
        "(kind 'tool'). A provider key here is what list_provider_models takes.",
      ...mcpTool('list_integrations'),
    },
  })

  // The models an LLM provider offers, from the models.dev registry. Backs the model
  // select in the agent config UI. Open to any project member: the list comes from a
  // public registry and holds no project data.
  .get(
    '/projects/:projectKey/integrations/models/:provider',
    ({ params }) => listModelsForProvider(params.provider),
    {
      params: providerParams,
      projectMember: true,
      response: { 200: ProviderModelListResponse, ...accessErrors },
      detail: {
        summary: "List a provider's models",
        description:
          'List the models an LLM provider offers. An id here is what the model field on ' +
          'create_ai_agent / update_ai_agent takes. Empty when the model registry is unreachable.',
        // The list comes from models.dev, the one route here that reads outside the tracker.
        ...mcpTool('list_provider_models', { openWorldHint: true }),
      },
    },
  )

  // Fills the credential selects in the agent and tool forms. Open to any project
  // member, and deliberately separate from the credential list below: that one is the
  // integrations admin view and may grow fields this one must not carry.
  .get(
    '/projects/:projectKey/integrations/options',
    async ({ project, query }) => {
      const credentials = await listCredentials(await getProjectTeamId(project.id));
      return credentials.flatMap((c) => {
        const kind = integrationKind(c.integrationKey);
        if (!kind || (query.kind && kind !== query.kind)) return [];
        return [{ id: c.id, integrationKey: c.integrationKey, kind, label: c.label }];
      });
    },
    {
      query: integrationOptionsQuery,
      projectMember: true,
      response: { 200: IntegrationOptionListResponse, ...commonErrors },
      detail: {
        summary: 'List integration options',
        description:
          "The team's connected integrations as picker options: id, key, kind and label.",
      },
    },
  )

  // The admin view of what the project's team has stored, for a caller who reaches it
  // through the project. The UI reads the same list under :teamId; this one is what an
  // MCP client calls, so it carries the tool tag.
  .get(
    '/projects/:projectKey/integrations',
    async ({ project }) => listCredentials(await getProjectTeamId(project.id)),
    {
      permission: ['integrations', 'read'],
      response: { 200: CredentialListResponse, ...accessErrors },
      detail: {
        summary: "List the team's credentials",
        description:
          "List the integration credentials of the project's team, secrets redacted. The id " +
          'of a credential on an LLM provider is what modelCredentialId on create_ai_agent / ' +
          'update_ai_agent takes. A credential is added in the UI, not here.',
        ...mcpTool('list_integration_credentials'),
      },
    },
  )

  // The same catalog for the team panel, which knows the team and no project.
  .get('/teams/:teamId/integrations/catalog', () => INTEGRATION_CATALOG, {
    params: teamParams,
    teamMember: true,
    response: { 200: IntegrationCatalogResponse, ...accessErrors },
    detail: {
      summary: 'List available integrations for a team',
      description: "The integration catalog, for the team panel's integrations tab.",
    },
  })

  .get('/teams/:teamId/integrations', ({ membership }) => listCredentials(membership.teamId), {
    params: teamParams,
    teamPermission: ['integrations', 'read'],
    response: { 200: CredentialListResponse, ...accessErrors },
    detail: {
      summary: 'List credentials',
      description: "List a team's integration credentials, secrets redacted.",
    },
  })

  .post(
    '/teams/:teamId/integrations',
    async ({ membership, body, set }) => {
      set.status = 201;
      return createCredential(membership.teamId, body);
    },
    {
      params: teamParams,
      body: createCredentialBody,
      teamPermission: ['integrations', 'create'],
      response: { 201: CredentialResponse, ...commonErrors },
      detail: {
        summary: 'Add a credential',
        description: 'Store a credential for an integration.',
      },
    },
  )

  // Updates the label and/or the credential. Secret fields left out of `credential`
  // keep their stored value. The integration is fixed once created (delete + re-add).
  .patch(
    '/teams/:teamId/integrations/:credentialId',
    async ({ params, membership, body }) => {
      const row = await updateCredential(params.credentialId, membership.teamId, body);
      if (!row) throw new HttpError(404, 'Credential not found');
      return row;
    },
    {
      body: updateCredentialBody,
      params: credentialParams,
      teamPermission: ['integrations', 'edit'],
      response: { 200: CredentialResponse, ...commonErrors },
      detail: {
        summary: 'Update a credential',
        description: "Update a credential's label or secret. The integration is fixed.",
      },
    },
  )

  .delete(
    '/teams/:teamId/integrations/:credentialId',
    async ({ params, membership }) => {
      const ok = await deleteCredential(params.credentialId, membership.teamId);
      if (!ok) throw new HttpError(404, 'Credential not found');
      return noContent();
    },
    {
      params: credentialParams,
      teamPermission: ['integrations', 'delete'],
      response: { 204: t.Void(), ...accessErrors },
      detail: {
        summary: 'Delete a credential',
        description: 'Delete an integration credential.',
      },
    },
  );
