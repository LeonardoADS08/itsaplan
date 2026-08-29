ALTER TABLE "ai_agent" DROP CONSTRAINT "ai_agent_runner_scope_check";--> statement-breakpoint
ALTER TABLE "ai_agent" ALTER COLUMN "runner_scope" SET DEFAULT 'team';--> statement-breakpoint
UPDATE "ai_agent" SET "runner_scope" = 'team' WHERE "runner_scope" = 'project';--> statement-breakpoint
ALTER TABLE "ai_agent" ADD CONSTRAINT "ai_agent_runner_scope_check" CHECK ("ai_agent"."runner_scope" IN ('owner', 'team'));