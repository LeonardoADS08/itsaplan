DROP INDEX "ai_agent_project_username_uq";--> statement-breakpoint
DROP INDEX "ai_agent_project_idx";--> statement-breakpoint
ALTER TABLE "ai_agent" ADD COLUMN "team_id" integer;--> statement-breakpoint
ALTER TABLE "ai_agent" ADD CONSTRAINT "ai_agent_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- An agent moves from the project to the team that owns it, so one agent and one key
-- reach every project of the team. A handle is unique per team now, so two agents that
-- shared one in two projects are told apart by the project key appended to the handle,
-- and by a number when that still collides. Membership in the project each agent works
-- in is written below, so it keeps that project.
WITH named AS (
  SELECT a."id",
         p."team_id" AS team_id,
         CASE
           WHEN EXISTS (
             SELECT 1 FROM "ai_agent" o
               JOIN "project" op ON op."id" = o."project_id"
              WHERE op."team_id" = p."team_id" AND o."id" <> a."id"
                AND lower(o."username") = lower(a."username")
           ) THEN a."username" || '-' || lower(p."key")
           ELSE a."username"
         END AS username
    FROM "ai_agent" a
    JOIN "project" p ON p."id" = a."project_id"
), numbered AS (
  SELECT "id", team_id, username,
         ROW_NUMBER() OVER (PARTITION BY team_id, lower(username) ORDER BY "id") AS position
    FROM named
)
UPDATE "ai_agent" a
   SET "team_id" = n.team_id,
       "username" = CASE WHEN n.position = 1 THEN n.username ELSE n.username || '-' || n.position END
  FROM numbered n
 WHERE n."id" = a."id";--> statement-breakpoint
-- An agent works in the project it was bound to, and membership is what says so now.
-- Agents created before the membership was written get their row here, so nothing
-- depends on the column about to be dropped.
INSERT INTO "project_member" ("project_id", "user_id", "role", "role_id")
SELECT a."project_id", a."user_id", 'member', a."role_id" FROM "ai_agent" a
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "ai_agent" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_agent" DROP CONSTRAINT "ai_agent_project_id_project_id_fk";--> statement-breakpoint
ALTER TABLE "ai_agent" DROP COLUMN "project_id";--> statement-breakpoint
CREATE UNIQUE INDEX "ai_agent_team_username_uq" ON "ai_agent" USING btree ("team_id",lower("username"));--> statement-breakpoint
CREATE INDEX "ai_agent_team_idx" ON "ai_agent" USING btree ("team_id");
