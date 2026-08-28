ALTER TABLE "agent_skill" DROP CONSTRAINT "agent_skill_project_id_name_unique";--> statement-breakpoint
DROP INDEX "agent_skill_project_idx";--> statement-breakpoint
ALTER TABLE "agent_skill" ADD COLUMN "team_id" integer;--> statement-breakpoint
ALTER TABLE "agent_skill" ADD CONSTRAINT "agent_skill_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_skill_team_idx" ON "agent_skill" USING btree ("team_id");--> statement-breakpoint
-- Skills move from the project to the team that owns it, so an agent working in two
-- projects of one team draws on one library. Every skill is kept: two projects of a
-- team that each hold a skill of the same name end up as two skills of the team, told
-- apart by the project name appended to the skill name. Names still equal after that
-- (two projects sharing a name) get a number. s3_prefix and files[].s3Key are left as
-- they are — the prefix is an opaque pointer, and no object moves.
WITH named AS (
  SELECT s."id",
         p."team_id" AS team_id,
         CASE
           WHEN EXISTS (
             SELECT 1 FROM "agent_skill" o
               JOIN "project" op ON op."id" = o."project_id"
              WHERE op."team_id" = p."team_id" AND o."id" <> s."id" AND o."name" = s."name"
           ) THEN s."name" || ' (' || p."name" || ')'
           ELSE s."name"
         END AS name
    FROM "agent_skill" s
    JOIN "project" p ON p."id" = s."project_id"
), numbered AS (
  SELECT "id", team_id, name,
         ROW_NUMBER() OVER (PARTITION BY team_id, name ORDER BY "id") AS position
    FROM named
)
UPDATE "agent_skill" s
   SET "team_id" = n.team_id,
       "name" = CASE WHEN n.position = 1 THEN n.name ELSE n.name || ' #' || n.position END
  FROM numbered n
 WHERE n."id" = s."id";--> statement-breakpoint
ALTER TABLE "agent_skill" DROP CONSTRAINT "agent_skill_project_id_project_id_fk";--> statement-breakpoint
ALTER TABLE "agent_skill" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_skill" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "agent_skill" ADD CONSTRAINT "agent_skill_team_id_name_unique" UNIQUE("team_id","name");
