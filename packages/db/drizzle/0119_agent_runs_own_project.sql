ALTER TABLE "agent_run" ADD COLUMN "project_id" integer;--> statement-breakpoint
ALTER TABLE "agent_schedule" ADD COLUMN "project_id" integer;--> statement-breakpoint
-- A schedule and a run name the project they work in. Until now that project came
-- from the agent, which is about to belong to a team instead, so every existing row
-- takes the project its agent had.
UPDATE "agent_schedule" s SET "project_id" = a."project_id"
  FROM "ai_agent" a WHERE a."id" = s."agent_id";--> statement-breakpoint
UPDATE "agent_run" r SET "project_id" = a."project_id"
  FROM "ai_agent" a WHERE a."id" = r."agent_id";--> statement-breakpoint
ALTER TABLE "agent_run" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_schedule" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_schedule" ADD CONSTRAINT "agent_schedule_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_run_project_idx" ON "agent_run" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "agent_schedule_project_idx" ON "agent_schedule" USING btree ("project_id");
