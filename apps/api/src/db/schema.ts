import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const projectStatus = pgEnum('project_status', ['active', 'archived']);
export const taskStatus = pgEnum('task_status', [
  'inbox',
  'next',
  'in_progress',
  'blocked',
  'done',
]);
export const taskPriority = pgEnum('task_priority', ['low', 'medium', 'high']);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    color: varchar('color', { length: 7 }),
    status: projectStatus('status').notNull().default('active'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('projects_status_idx').on(table.status),
    check('projects_name_not_blank', sql`length(btrim(${table.name})) > 0`),
    check(
      'projects_color_hex',
      sql`${table.color} IS NULL OR ${table.color} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
    check(
      'projects_archived_at_consistent',
      sql`
    (${table.status} = 'archived' AND ${table.archivedAt} IS NOT NULL)
    OR (${table.status} = 'active' AND ${table.archivedAt} IS NULL)
  `,
    ),
  ],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 200 }).notNull(),
    notes: text('notes'),
    status: taskStatus('status').notNull().default('inbox'),
    priority: taskPriority('priority').notNull().default('medium'),
    scheduledFor: date('scheduled_for'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    blockedReason: text('blocked_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('tasks_project_id_idx').on(table.projectId),
    index('tasks_status_scheduled_for_idx').on(table.status, table.scheduledFor),
    index('tasks_due_at_idx').on(table.dueAt),
    index('tasks_pending_idx')
      .on(table.updatedAt)
      .where(sql`${table.status} <> 'done'`),
    check('tasks_title_not_blank', sql`length(btrim(${table.title})) > 0`),
    check(
      'tasks_completion_consistency',
      sql`
    (${table.status} = 'done' AND ${table.completedAt} IS NOT NULL)
    OR (${table.status} <> 'done' AND ${table.completedAt} IS NULL)
  `,
    ),
    check(
      'tasks_blocked_reason_consistency',
      sql`
    (${table.status} = 'blocked' AND ${table.blockedReason} IS NOT NULL AND length(btrim(${table.blockedReason})) > 0)
    OR (${table.status} <> 'blocked' AND ${table.blockedReason} IS NULL)
  `,
    ),
  ],
);

export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;
