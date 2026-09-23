ALTER TYPE "public"."task_status" RENAME VALUE 'inbox' TO 'pending';--> statement-breakpoint
ALTER TYPE "public"."task_status" RENAME VALUE 'next' TO 'in_review';
