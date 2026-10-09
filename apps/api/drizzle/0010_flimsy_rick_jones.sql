CREATE TYPE "public"."automation_run_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."report_delivery_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."weekly_report_status" AS ENUM('generated', 'failed');--> statement-breakpoint
CREATE TABLE "automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_key" varchar(80) NOT NULL,
	"status" "automation_run_status" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"summary" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"recipient" varchar(320) NOT NULL,
	"status" "report_delivery_status" NOT NULL,
	"message_id" varchar(320),
	"error" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_report_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"name" varchar(120) NOT NULL,
	"repository" varchar(200) NOT NULL,
	"focus" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_report_projects_name_not_blank" CHECK (length(btrim("weekly_report_projects"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "weekly_report_settings" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"recipient" varchar(320) NOT NULL,
	"schedule_day" integer DEFAULT 5 NOT NULL,
	"schedule_hour" integer DEFAULT 8 NOT NULL,
	"time_zone" varchar(80) DEFAULT 'Europe/Madrid' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_report_settings_schedule_day" CHECK ("weekly_report_settings"."schedule_day" BETWEEN 1 AND 7),
	CONSTRAINT "weekly_report_settings_schedule_hour" CHECK ("weekly_report_settings"."schedule_hour" BETWEEN 0 AND 23)
);
--> statement-breakpoint
CREATE TABLE "weekly_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_project_id" uuid NOT NULL,
	"run_id" uuid,
	"report_date" date NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"markdown" text,
	"local_path" text,
	"status" "weekly_report_status" NOT NULL,
	"email_status" "report_delivery_status" DEFAULT 'pending' NOT NULL,
	"message_id" varchar(320),
	"email_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_report_id_weekly_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."weekly_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_report_projects" ADD CONSTRAINT "weekly_report_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_report_project_id_weekly_report_projects_id_fk" FOREIGN KEY ("report_project_id") REFERENCES "public"."weekly_report_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_run_id_automation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."automation_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_runs_job_started_idx" ON "automation_runs" USING btree ("job_key","started_at");--> statement-breakpoint
CREATE INDEX "report_deliveries_report_attempted_idx" ON "report_deliveries" USING btree ("report_id","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_report_projects_name_idx" ON "weekly_report_projects" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_report_projects_repository_idx" ON "weekly_report_projects" USING btree ("repository");--> statement-breakpoint
CREATE INDEX "weekly_report_projects_project_id_idx" ON "weekly_report_projects" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_reports_project_date_idx" ON "weekly_reports" USING btree ("report_project_id","report_date");--> statement-breakpoint
CREATE INDEX "weekly_reports_created_idx" ON "weekly_reports" USING btree ("created_at");
--> statement-breakpoint
INSERT INTO "weekly_report_settings" ("id", "enabled", "recipient", "schedule_day", "schedule_hour", "time_zone")
VALUES ('weekly-reports', true, 'erik.saldi.diaz@gmail.com', 5, 8, 'Europe/Madrid')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "weekly_report_projects" ("project_id", "name", "repository", "focus", "enabled", "sort_order")
SELECT p."id", seed."name", seed."repository", seed."focus", true, seed."sort_order"
FROM (VALUES
  ('Micro-SaaS', 'SoyManoolo/create-my-saas', 'FastAPI, NestJS, autenticación, PostgreSQL, Redis, Alembic, Stripe, frontend, generación de proyectos, seguridad y productización.', 10),
  ('FriendsGo', 'SoyManoolo/M12', 'Express/TypeScript, Sequelize/PostgreSQL, JWT, Socket.IO, WebRTC, frontend, tests, seguridad y despliegue.', 20),
  ('JobAgent', 'SoyManoolo/JobAgent', 'Playwright, portales de empleo, cookies y sesiones, FastAPI, SQLite, análisis IA, estados de ofertas, dashboard, solicitudes manuales y CV/PDF.', 30),
  ('pino-config', 'SoyManoolo/pino-config', 'API pública, handlers, concurrencia, compatibilidad, rendimiento, tests, dependencias y publicación npm.', 40),
  ('Nexo', 'SoyManoolo/Nexo', 'Backend, frontend Astro, PostgreSQL, MCP, tareas, integración GitHub, Coolify, tests y estabilidad.', 50)
) AS seed("name", "repository", "focus", "sort_order")
LEFT JOIN "projects" p ON p."github_repository" = seed."repository"
ON CONFLICT ("repository") DO NOTHING;
