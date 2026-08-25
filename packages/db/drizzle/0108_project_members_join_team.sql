-- Every project member joins the team that owns their project, so a team's member
-- list holds everyone who works in its projects. The project_member row stays: it is
-- what grants access to that project and carries the team role the member works
-- under. A user who is already in the team keeps the role they have there, so an
-- owner stays an owner; everyone else joins as 'member'. Someone in several projects
-- of one team gets a single row, dated by the first of those projects they joined.
-- Agent bot users are skipped — they act through their project_member row alone and
-- never appear in a member list.
INSERT INTO "team_member" ("team_id", "user_id", "role", "created_at")
SELECT p."team_id", m."user_id", 'member', min(m."created_at")
  FROM "project_member" m
  JOIN "project" p ON p."id" = m."project_id"
 WHERE NOT EXISTS (SELECT 1 FROM "ai_agent" a WHERE a."user_id" = m."user_id")
 GROUP BY p."team_id", m."user_id"
ON CONFLICT ("team_id", "user_id") DO NOTHING;
