CREATE TABLE "project_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid,
	"event_type" varchar(40) NOT NULL,
	"task_title" varchar(200),
	"from_status" varchar(20),
	"to_status" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_activities" ADD CONSTRAINT "project_activities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_activities" ADD CONSTRAINT "project_activities_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "project_activities_project_created_idx" ON "project_activities" USING btree ("project_id", "created_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "log_project_activity_from_task"() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		IF NEW."project_id" IS NOT NULL THEN
			INSERT INTO "project_activities" ("project_id", "task_id", "event_type", "task_title", "to_status")
			VALUES (NEW."project_id", NEW."id", 'task_created', NEW."title", NEW."status"::text);
		END IF;
		RETURN NEW;
	END IF;

	IF OLD."project_id" IS DISTINCT FROM NEW."project_id" AND NEW."project_id" IS NOT NULL THEN
		INSERT INTO "project_activities" ("project_id", "task_id", "event_type", "task_title", "from_status", "to_status")
		VALUES (NEW."project_id", NEW."id", 'task_added', NEW."title", OLD."status"::text, NEW."status"::text);
	END IF;

	IF OLD."status" IS DISTINCT FROM NEW."status" AND NEW."project_id" IS NOT NULL THEN
			INSERT INTO "project_activities" ("project_id", "task_id", "event_type", "task_title", "from_status", "to_status")
			VALUES (NEW."project_id", NEW."id", 'task_status_changed', NEW."title", OLD."status"::text, NEW."status"::text);
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "tasks_project_activity_insert_trigger"
AFTER INSERT ON "tasks"
FOR EACH ROW EXECUTE FUNCTION "log_project_activity_from_task"();
--> statement-breakpoint
CREATE TRIGGER "tasks_project_activity_update_trigger"
AFTER UPDATE OF "status", "project_id" ON "tasks"
FOR EACH ROW EXECUTE FUNCTION "log_project_activity_from_task"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "log_project_activity_from_project"() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		INSERT INTO "project_activities" ("project_id", "event_type")
		VALUES (NEW."id", 'project_created');
	ELSIF OLD."status" IS DISTINCT FROM NEW."status" THEN
		INSERT INTO "project_activities" ("project_id", "event_type")
		VALUES (NEW."id", CASE WHEN NEW."status" = 'archived' THEN 'project_archived' ELSE 'project_restored' END);
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "projects_activity_insert_trigger"
AFTER INSERT ON "projects"
FOR EACH ROW EXECUTE FUNCTION "log_project_activity_from_project"();
--> statement-breakpoint
CREATE TRIGGER "projects_activity_update_trigger"
AFTER UPDATE OF "status" ON "projects"
FOR EACH ROW EXECUTE FUNCTION "log_project_activity_from_project"();
--> statement-breakpoint
INSERT INTO "project_activities" ("project_id", "event_type", "created_at")
SELECT "id", 'project_created', "created_at" FROM "projects";
