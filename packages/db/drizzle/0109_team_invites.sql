CREATE TABLE "team_invite" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"team_id" integer NOT NULL,
	"project_id" integer,
	"email" text NOT NULL,
	"team_role" text DEFAULT 'member' NOT NULL,
	"project_role" text,
	"role_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by_user_id" text,
	"accepted_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "team_invite_token_unique" UNIQUE("token"),
	CONSTRAINT "team_invite_team_role_check" CHECK ("team_invite"."team_role" IN ('manager', 'member')),
	CONSTRAINT "team_invite_project_role_check" CHECK (("team_invite"."project_id" IS NULL AND "team_invite"."project_role" IS NULL)
        OR ("team_invite"."project_id" IS NOT NULL AND "team_invite"."project_role" IN ('owner', 'member'))),
	CONSTRAINT "team_invite_status_check" CHECK ("team_invite"."status" IN ('pending', 'accepted', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_role_id_team_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."team_role"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_invite_team_pending_uq" ON "team_invite" USING btree ("team_id","email") WHERE "team_invite"."status" = 'pending' AND "team_invite"."project_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "team_invite_project_pending_uq" ON "team_invite" USING btree ("project_id","email") WHERE "team_invite"."status" = 'pending' AND "team_invite"."project_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "team_invite_team_idx" ON "team_invite" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_invite_project_idx" ON "team_invite" USING btree ("project_id");--> statement-breakpoint

-- Invites are into a team from here on, so every project invite moves over and keeps
-- its token: a link that was already sent stays valid. It names the project it was
-- created for, and brings its invitee into the team as a plain member.
INSERT INTO "team_invite" (
  "id", "token", "team_id", "project_id", "email", "team_role", "project_role",
  "role_id", "status", "invited_by_user_id", "accepted_by_user_id", "created_at", "responded_at"
)
SELECT i."id", i."token", p."team_id", i."project_id", i."email", 'member', i."role",
       i."role_id", i."status", i."invited_by_user_id", i."accepted_by_user_id",
       i."created_at", i."responded_at"
  FROM "project_invite" i
  JOIN "project" p ON p."id" = i."project_id";--> statement-breakpoint
SELECT setval(
  pg_get_serial_sequence('team_invite', 'id'),
  GREATEST((SELECT COALESCE(max("id"), 0) FROM "team_invite"), 1)
);--> statement-breakpoint
DROP TABLE "project_invite" CASCADE;
