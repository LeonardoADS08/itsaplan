ALTER TABLE "agent_tool" DROP CONSTRAINT "agent_tool_project_id_tool_key_credential_id_unique";--> statement-breakpoint
DROP INDEX "agent_tool_project_idx";--> statement-breakpoint
ALTER TABLE "agent_tool" ADD COLUMN "team_id" integer;--> statement-breakpoint
ALTER TABLE "agent_tool" ADD CONSTRAINT "agent_tool_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_tool_team_idx" ON "agent_tool" USING btree ("team_id");--> statement-breakpoint
-- Configured tools move from the project to the team that owns it, because the
-- credential they bind is already the team's. Two projects of one team that bound the
-- same tool to the same credential become one row: the setting is the same, and a
-- configured tool has no name to tell two apart.
UPDATE "agent_tool" t
   SET "team_id" = p."team_id"
  FROM "project" p
 WHERE p."id" = t."project_id";--> statement-breakpoint
-- The agents of the merged rows keep the tool: their links move to the row that
-- survives. An agent belongs to one project, and the old unique constraint held per
-- project, so no agent can end up linked to the survivor twice.
WITH survivor AS (
  SELECT "id", min("id") OVER (PARTITION BY "team_id", "tool_key", "credential_id") AS keep_id
    FROM "agent_tool"
)
UPDATE "agent_tool_link" l
   SET "agent_tool_id" = s.keep_id
  FROM survivor s
 WHERE s."id" = l."agent_tool_id" AND s.keep_id <> s."id";--> statement-breakpoint
DELETE FROM "agent_tool" a
 USING (
   SELECT "id", min("id") OVER (PARTITION BY "team_id", "tool_key", "credential_id") AS keep_id
     FROM "agent_tool"
 ) s
 WHERE s."id" = a."id" AND s.keep_id <> a."id";--> statement-breakpoint
ALTER TABLE "agent_tool" DROP CONSTRAINT "agent_tool_project_id_project_id_fk";--> statement-breakpoint
ALTER TABLE "agent_tool" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_tool" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "agent_tool" ADD CONSTRAINT "agent_tool_team_id_tool_key_credential_id_unique" UNIQUE("team_id","tool_key","credential_id");
