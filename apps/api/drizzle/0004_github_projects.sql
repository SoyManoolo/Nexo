ALTER TABLE "projects" ADD COLUMN "github_repository" varchar(200);
CREATE UNIQUE INDEX "projects_github_repository_idx" ON "projects" USING btree ("github_repository") WHERE "github_repository" IS NOT NULL;
CREATE TABLE "integration_settings" (
  "key" varchar(100) PRIMARY KEY NOT NULL,
  "encrypted_value" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
