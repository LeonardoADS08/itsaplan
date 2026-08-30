import { t } from 'elysia';

const memberRole = t.Union([t.Literal('owner'), t.Literal('member')]);

export const memberParams = t.Object({ projectKey: t.String(), userId: t.String() });

// A member DTO (MemberRow from the service).
const MemberResponse = t.Object({
  userId: t.String(),
  name: t.String(),
  email: t.String(),
  username: t.Nullable(t.String()),
  image: t.Nullable(t.String()),
  timezone: t.String(),
  role: memberRole,
  roleId: t.Nullable(t.Number()),
  roleName: t.Nullable(t.String()),
  description: t.String(),
  isAgent: t.Boolean(),
  // 'scim' when an identity provider's group granted this membership. Such a row is
  // rewritten on every sync, so the role and remove actions are refused.
  source: t.UnionEnum(['invite', 'scim']),
  createdAt: t.String(),
});

// One page of members, with how many the project has in total. Without limit and
// offset the page is the whole list.
export const MemberListResponse = t.Object({
  items: t.Array(MemberResponse),
  total: t.Number(),
  // How many of them own the project, which a page window cannot answer: the last
  // owner is protected, and the list marks their row for it.
  ownerCount: t.Number(),
});

export const memberListQuery = t.Object({
  search: t.Optional(t.String({ description: 'Matches the name, the address or the handle.' })),
  kind: t.Optional(
    t.UnionEnum(['all', 'human', 'agent'], {
      description: "Everyone, the people, or the AI agents' bot users. Defaults to everyone.",
    }),
  ),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
});

// Someone who can be added to the project straight away (MemberCandidate).
const MemberCandidateResponse = t.Object({
  userId: t.String(),
  name: t.String(),
  email: t.String(),
  username: t.Nullable(t.String()),
  image: t.Nullable(t.String()),
  isAgent: t.Boolean(),
});

export const MemberCandidateListResponse = t.Array(MemberCandidateResponse);

export const addMemberBody = t.Object({
  userId: t.String(),
  role: memberRole,
  roleId: t.Optional(t.Nullable(t.Integer())),
});

export const setMemberRoleBody = t.Object({
  role: memberRole,
  roleId: t.Optional(t.Nullable(t.Integer())),
});

export const setMemberDescriptionBody = t.Object({
  description: t.String({ maxLength: 500 }),
});
