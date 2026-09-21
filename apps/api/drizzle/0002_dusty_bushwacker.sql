ALTER TABLE "projects" ADD CONSTRAINT "projects_name_not_blank" CHECK (length(btrim("projects"."name")) > 0);--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_color_hex" CHECK ("projects"."color" IS NULL OR "projects"."color" ~ '^#[0-9A-Fa-f]{6}$');--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_archived_at_consistent" CHECK (
    ("projects"."status" = 'archived' AND "projects"."archived_at" IS NOT NULL)
    OR ("projects"."status" = 'active' AND "projects"."archived_at" IS NULL)
  );--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_title_not_blank" CHECK (length(btrim("tasks"."title")) > 0);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completion_consistency" CHECK (
    ("tasks"."status" = 'done' AND "tasks"."completed_at" IS NOT NULL)
    OR ("tasks"."status" <> 'done' AND "tasks"."completed_at" IS NULL)
  );--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_blocked_reason_consistency" CHECK (
    ("tasks"."status" = 'blocked' AND "tasks"."blocked_reason" IS NOT NULL AND length(btrim("tasks"."blocked_reason")) > 0)
    OR ("tasks"."status" <> 'blocked' AND "tasks"."blocked_reason" IS NULL)
  );