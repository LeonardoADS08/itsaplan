CREATE TABLE "team_notification_setting" (
	"team_id" integer PRIMARY KEY NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"redacted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_notification_setting" ADD CONSTRAINT "team_notification_setting_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Notification provider credentials move from the project to the team that owns it.
-- A team whose projects held several configurations keeps the one saved last. The
-- blob is encrypted with the instance key and is copied as it is, without
-- decrypting. project_notification_setting stays behind, out of the schema and read
-- by nothing, so the configurations that lost the merge can still be recovered by
-- hand; a later migration drops it.
INSERT INTO "team_notification_setting" ("team_id", "ciphertext", "iv", "auth_tag", "redacted", "updated_at")
SELECT DISTINCT ON (p."team_id")
       p."team_id", s."ciphertext", s."iv", s."auth_tag", s."redacted", s."updated_at"
  FROM "project_notification_setting" s
  JOIN "project" p ON p."id" = s."project_id"
 ORDER BY p."team_id", s."updated_at" DESC;
