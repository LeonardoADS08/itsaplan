DROP INDEX "integration_credential_project_idx";--> statement-breakpoint
ALTER TABLE "integration_credential" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_credential" ADD COLUMN "team_id" integer;--> statement-breakpoint
ALTER TABLE "integration_credential" ADD CONSTRAINT "integration_credential_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_credential_team_idx" ON "integration_credential" USING btree ("team_id");--> statement-breakpoint
-- Integration credentials move from the project to the team that owns it. Every
-- credential is kept: two projects of one team that each stored a key for the same
-- integration end up as two credentials of the team, told apart by the project name
-- appended to the label. Credentials that are still indistinguishable after that
-- (several unlabelled ones on the same integration in one project) get a number.
WITH labelled AS (
  SELECT c."id",
         p."team_id" AS team_id,
         c."integration_key" AS integration_key,
         CASE
           WHEN COALESCE(c."label", '') = '' THEN p."name"
           ELSE c."label" || ' (' || p."name" || ')'
         END AS label
    FROM "integration_credential" c
    JOIN "project" p ON p."id" = c."project_id"
), numbered AS (
  SELECT "id", team_id, label,
         ROW_NUMBER() OVER (PARTITION BY team_id, integration_key, label ORDER BY "id") AS position
    FROM labelled
)
UPDATE "integration_credential" c
   SET "team_id" = n.team_id,
       "label" = CASE WHEN n.position = 1 THEN n.label ELSE n.label || ' #' || n.position END
  FROM numbered n
 WHERE n."id" = c."id";--> statement-breakpoint
ALTER TABLE "integration_credential" DROP CONSTRAINT "integration_credential_project_id_project_id_fk";--> statement-breakpoint
ALTER TABLE "integration_credential" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_credential" DROP COLUMN "project_id";
