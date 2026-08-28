ALTER TABLE "team_member" DROP CONSTRAINT "team_member_role_check";--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_role_check" CHECK ("team_member"."role" IN ('owner', 'manager', 'member', 'agent'));--> statement-breakpoint
-- Agents belong to the team's member list. Migration 0111 filled team_member from the
-- accounts that existed, and skipped the bot users; each agent gets its row here.
INSERT INTO "team_member" ("team_id", "user_id", "role")
SELECT a."team_id", a."user_id", 'agent' FROM "ai_agent" a
ON CONFLICT DO NOTHING;
