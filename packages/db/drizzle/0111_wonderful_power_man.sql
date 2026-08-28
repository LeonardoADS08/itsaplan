CREATE TABLE "team" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_member" (
	"team_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_member_team_id_user_id_pk" PRIMARY KEY("team_id","user_id"),
	CONSTRAINT "team_member_role_check" CHECK ("team_member"."role" IN ('owner', 'manager', 'member'))
);
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "team_id" integer;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_member_user_idx" ON "team_member" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Accounts that existed before teams. Each one gets the team the sign-up hook in
-- @repo/auth now creates: named after the username, owned by that account. Agent bot
-- users are skipped — they never sign in and never own a project.
DO $$
DECLARE
  account record;
  new_team_id integer;
BEGIN
  FOR account IN
    SELECT "id", "username", "name" FROM "user"
    WHERE "email" NOT LIKE '%@agents.local'
    ORDER BY "created_at"
  LOOP
    INSERT INTO "team" ("name")
    VALUES (COALESCE(NULLIF(account."username", ''), account."name"))
    RETURNING "id" INTO new_team_id;
    INSERT INTO "team_member" ("team_id", "user_id", "role")
    VALUES (new_team_id, account."id", 'owner');
  END LOOP;
END $$;--> statement-breakpoint
-- Every project joins the team of the account that owns it. With several owners it is
-- the one who became an owner first; with none left, the team of its earliest member
-- of any role. Agent members carry no team, so they never decide this.
UPDATE "project" p
SET "team_id" = pick."team_id"
FROM (
  SELECT DISTINCT ON (m."project_id") m."project_id", tm."team_id"
  FROM "project_member" m
  JOIN "team_member" tm ON tm."user_id" = m."user_id" AND tm."role" = 'owner'
  ORDER BY m."project_id", (m."role" <> 'owner'), m."created_at", m."user_id"
) pick
WHERE p."id" = pick."project_id";--> statement-breakpoint
-- A project whose members are all gone has no team to join, so it gets one of its own.
DO $$
DECLARE
  orphan record;
  new_team_id integer;
BEGIN
  FOR orphan IN SELECT "id", "name" FROM "project" WHERE "team_id" IS NULL LOOP
    INSERT INTO "team" ("name") VALUES (orphan."name") RETURNING "id" INTO new_team_id;
    UPDATE "project" SET "team_id" = new_team_id WHERE "id" = orphan."id";
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "team_id" SET NOT NULL;
