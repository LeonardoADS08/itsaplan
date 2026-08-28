ALTER TABLE "ai_agent" DROP CONSTRAINT "ai_agent_role_id_team_role_id_fk";--> statement-breakpoint
-- A team that holds an agent but no role at all gets the default one team creation
-- writes. It grants nothing until an operator edits it, which is the safe end of the
-- range for a state the application never produces.
INSERT INTO "team_role" ("team_id", "name", "is_default", "permissions")
SELECT DISTINCT a."team_id", 'Member', true, '{}'::jsonb
  FROM "ai_agent" a
 WHERE a."role_id" IS NULL
   AND NOT EXISTS (SELECT 1 FROM "team_role" r WHERE r."team_id" = a."team_id");--> statement-breakpoint
-- An empty role_id used to fall back to a permission matrix in code, a copy of the
-- default Member role taken when the team was made, which later edits of that role
-- never reached. Every agent is put on a real role of its team instead — the default
-- one, or the oldest it has — so editing that role changes what the agent may do.
UPDATE "ai_agent" a
   SET "role_id" = (
     SELECT r."id" FROM "team_role" r
      WHERE r."team_id" = a."team_id"
      ORDER BY r."is_default" DESC, r."id"
      LIMIT 1
   )
 WHERE a."role_id" IS NULL;--> statement-breakpoint
ALTER TABLE "ai_agent" ALTER COLUMN "role_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_agent" ADD CONSTRAINT "ai_agent_role_id_team_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."team_role"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- The bot user's project memberships carry the same role, so a permission check that
-- resolves it through project_member reads what the agent row says.
UPDATE "project_member" m
   SET "role_id" = a."role_id"
  FROM "ai_agent" a
 WHERE a."user_id" = m."user_id" AND m."role_id" IS DISTINCT FROM a."role_id";
