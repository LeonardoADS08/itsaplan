ALTER TABLE "project_role" RENAME TO "team_role";--> statement-breakpoint
ALTER TABLE "team_role" DROP CONSTRAINT "project_role_project_id_name_unique";--> statement-breakpoint
ALTER TABLE "ai_agent" DROP CONSTRAINT "ai_agent_role_id_project_role_id_fk";
--> statement-breakpoint
ALTER TABLE "project_invite" DROP CONSTRAINT "project_invite_role_id_project_role_id_fk";
--> statement-breakpoint
ALTER TABLE "project_member" DROP CONSTRAINT "project_member_role_id_project_role_id_fk";
--> statement-breakpoint
ALTER TABLE "team_role" DROP CONSTRAINT "project_role_project_id_project_id_fk";
--> statement-breakpoint
DROP INDEX "project_role_default_uq";--> statement-breakpoint
DROP INDEX "project_role_project_idx";--> statement-breakpoint
ALTER TABLE "team_role" ADD COLUMN "team_id" integer;--> statement-breakpoint
ALTER TABLE "team_role" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint

-- Roles move from the project to the team that owns it, so every project of a team
-- draws on one list. A role keeps its id, which is what project_member.role_id,
-- project_invite.role_id and ai_agent.role_id point at, so only the roles merged
-- below need their references rewritten.
UPDATE "team_role" r SET "team_id" = p."team_id" FROM "project" p WHERE p."id" = r."project_id";--> statement-breakpoint

-- Which default roles were left as the project got them: named "Member" and granting
-- exactly what defaultMemberPermissions() in apps/api/src/shared/permissions.ts does.
-- Those are interchangeable and collapse into one role per team; an edited one is
-- kept as a role of its own.
CREATE TEMP TABLE "role_migration" AS
SELECT r."id",
       r."team_id",
       r."project_id",
       r."is_default"
         AND r."name" = 'Member'
         AND g."grants" @> ARRAY['work_items:create','work_items:edit','work_items:read','work_items:delete','initiatives:create','initiatives:edit','initiatives:read','initiatives:delete','cycles:create','cycles:edit','cycles:read','cycles:delete','dashboards:read','views:read','states:read','issue_types:read','labels:read','ai_agents:read','custom_fields:read','note_boards:create','note_boards:edit','note_boards:read','note_boards:delete']
         AND ARRAY['work_items:create','work_items:edit','work_items:read','work_items:delete','initiatives:create','initiatives:edit','initiatives:read','initiatives:delete','cycles:create','cycles:edit','cycles:read','cycles:delete','dashboards:read','views:read','states:read','issue_types:read','labels:read','ai_agents:read','custom_fields:read','note_boards:create','note_boards:edit','note_boards:read','note_boards:delete'] @> g."grants"
         AS "is_standard_default"
  FROM "team_role" r
  CROSS JOIN LATERAL (
    SELECT COALESCE(array_agg(res."rkey" || ':' || act."akey"), ARRAY[]::text[]) AS "grants"
      FROM jsonb_each(r."permissions") AS res("rkey", "rval")
      CROSS JOIN LATERAL jsonb_each(
        CASE WHEN jsonb_typeof(res."rval") = 'object' THEN res."rval" ELSE '{}'::jsonb END
      ) AS act("akey", "aval")
     WHERE act."aval" = 'true'::jsonb
  ) g;--> statement-breakpoint

-- The one default role each team keeps: the oldest untouched one.
CREATE TEMP TABLE "team_default" AS
SELECT DISTINCT ON ("team_id") "team_id", "id"
  FROM "role_migration" WHERE "is_standard_default" ORDER BY "team_id", "id";--> statement-breakpoint

-- A team whose projects all edited their default role, and a team with no project at
-- all, gets a fresh one. Every team has exactly one default role from here on.
WITH "created" AS (
  INSERT INTO "team_role" ("team_id", "name", "is_default", "permissions")
  SELECT t."id", 'Member', true, '{"work_items":{"create":true,"edit":true,"read":true,"delete":true},"initiatives":{"create":true,"edit":true,"read":true,"delete":true},"cycles":{"create":true,"edit":true,"read":true,"delete":true},"dashboards":{"create":false,"edit":false,"read":true,"delete":false},"views":{"create":false,"edit":false,"read":true,"delete":false},"members_invite":{"create":false,"edit":false,"read":false,"delete":false},"members_manage":{"create":false,"edit":false,"read":false,"delete":false},"states":{"create":false,"edit":false,"read":true,"delete":false},"issue_types":{"create":false,"edit":false,"read":true,"delete":false},"labels":{"create":false,"edit":false,"read":true,"delete":false},"ai_agents":{"create":false,"edit":false,"read":true,"delete":false},"integrations":{"create":false,"edit":false,"read":false,"delete":false},"agent_skills":{"create":false,"edit":false,"read":false,"delete":false},"agent_tools":{"create":false,"edit":false,"read":false,"delete":false},"custom_fields":{"create":false,"edit":false,"read":true,"delete":false},"workflow_config":{"create":false,"edit":false,"read":false,"delete":false},"actions":{"create":false,"edit":false,"read":false,"delete":false},"webhooks":{"create":false,"edit":false,"read":false,"delete":false},"note_boards":{"create":true,"edit":true,"read":true,"delete":true},"danger_zone":{"create":false,"edit":false,"read":false,"delete":false}}'::jsonb
    FROM "team" t
   WHERE NOT EXISTS (SELECT 1 FROM "team_default" d WHERE d."team_id" = t."id")
  RETURNING "id", "team_id"
)
INSERT INTO "team_default" ("team_id", "id") SELECT "team_id", "id" FROM "created";--> statement-breakpoint

-- Everyone who sat on one of the merged default roles moves to the one the team kept.
UPDATE "project_member" m SET "role_id" = d."id"
  FROM "role_migration" rm JOIN "team_default" d ON d."team_id" = rm."team_id"
 WHERE m."role_id" = rm."id" AND rm."is_standard_default" AND rm."id" <> d."id";--> statement-breakpoint
UPDATE "project_invite" i SET "role_id" = d."id"
  FROM "role_migration" rm JOIN "team_default" d ON d."team_id" = rm."team_id"
 WHERE i."role_id" = rm."id" AND rm."is_standard_default" AND rm."id" <> d."id";--> statement-breakpoint
UPDATE "ai_agent" a SET "role_id" = d."id"
  FROM "role_migration" rm JOIN "team_default" d ON d."team_id" = rm."team_id"
 WHERE a."role_id" = rm."id" AND rm."is_standard_default" AND rm."id" <> d."id";--> statement-breakpoint
DELETE FROM "team_role" r USING "role_migration" rm, "team_default" d
 WHERE r."id" = rm."id" AND rm."is_standard_default" AND d."team_id" = rm."team_id" AND rm."id" <> d."id";--> statement-breakpoint

-- An edited default role is a role like any other from here on.
UPDATE "team_role" r SET "is_default" = false
 WHERE r."is_default" AND NOT EXISTS (SELECT 1 FROM "team_default" d WHERE d."id" = r."id");--> statement-breakpoint

-- Two projects of the same team could each name a role the same way, which the team
-- cannot. Every side of such a clash takes the name of the project it came from, so
-- both survive and neither name is arbitrary. The team's default role keeps its name.
UPDATE "team_role" r SET "name" = r."name" || ' (' || p."name" || ')'
  FROM "project" p
 WHERE p."id" = r."project_id" AND NOT r."is_default"
   AND EXISTS (
     SELECT 1 FROM "team_role" o
      WHERE o."team_id" = r."team_id" AND o."id" <> r."id" AND o."name" = r."name"
   );--> statement-breakpoint

-- Two projects can also share a name, which leaves the clash unresolved. The project
-- key is unique across the instance, so appending it always settles it.
UPDATE "team_role" r SET "name" = r."name" || ' [' || p."key" || ']'
  FROM "project" p
 WHERE p."id" = r."project_id" AND NOT r."is_default"
   AND EXISTS (
     SELECT 1 FROM "team_role" o
      WHERE o."team_id" = r."team_id" AND o."id" <> r."id" AND o."name" = r."name"
   );--> statement-breakpoint

DROP TABLE "role_migration";--> statement-breakpoint
DROP TABLE "team_default";--> statement-breakpoint
ALTER TABLE "team_role" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_agent" ADD CONSTRAINT "ai_agent_role_id_team_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."team_role"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invite" ADD CONSTRAINT "project_invite_role_id_team_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."team_role"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_role_id_team_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."team_role"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_role" ADD CONSTRAINT "team_role_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_role_default_uq" ON "team_role" USING btree ("team_id") WHERE "team_role"."is_default";--> statement-breakpoint
CREATE INDEX "team_role_team_idx" ON "team_role" USING btree ("team_id");--> statement-breakpoint
ALTER TABLE "team_role" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "team_role" ADD CONSTRAINT "team_role_team_id_name_unique" UNIQUE("team_id","name");
