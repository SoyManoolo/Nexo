ALTER TABLE "tasks" ADD COLUMN "ticket_number" integer;
--> statement-breakpoint
WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY project_id ORDER BY created_at, id)::integer AS number
  FROM tasks
)
UPDATE tasks SET ticket_number = numbered.number FROM numbered WHERE tasks.id = numbered.id;
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "ticket_number" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_project_ticket_number_idx" ON "tasks" ("project_id", "ticket_number") WHERE "project_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_inbox_ticket_number_idx" ON "tasks" ("ticket_number") WHERE "project_id" IS NULL;
--> statement-breakpoint
CREATE TABLE "task_sequences" (
  "scope_key" varchar(36) PRIMARY KEY NOT NULL,
  "next_number" integer NOT NULL
);
--> statement-breakpoint
INSERT INTO "task_sequences" ("scope_key", "next_number")
SELECT coalesce(project_id::text, 'inbox'), max(ticket_number) FROM tasks
GROUP BY project_id;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "move_project_tasks_to_inbox_before_delete"() RETURNS trigger AS $$
DECLARE task_count integer;
DECLARE final_number integer;
BEGIN
  SELECT count(*) INTO task_count FROM tasks WHERE project_id = OLD.id;
  IF task_count > 0 THEN
    INSERT INTO task_sequences (scope_key, next_number) VALUES ('inbox', task_count)
    ON CONFLICT (scope_key) DO UPDATE SET next_number = task_sequences.next_number + EXCLUDED.next_number
    RETURNING next_number INTO final_number;
    WITH numbered AS (
      SELECT id, row_number() OVER (ORDER BY created_at, id)::integer AS number
      FROM tasks WHERE project_id = OLD.id
    )
    UPDATE tasks SET project_id = NULL, ticket_number = final_number - task_count + numbered.number
    FROM numbered WHERE tasks.id = numbered.id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "projects_move_tasks_to_inbox_before_delete"
BEFORE DELETE ON projects FOR EACH ROW EXECUTE FUNCTION "move_project_tasks_to_inbox_before_delete"();
