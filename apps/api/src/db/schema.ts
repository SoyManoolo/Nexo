import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const projectStatus = pgEnum('project_status', ['active', 'archived']);
export const taskStatus = pgEnum('task_status', [
  'pending',
  'in_review',
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
    notes: text('notes'),
    color: varchar('color', { length: 7 }),
    githubRepository: varchar('github_repository', { length: 200 }),
    status: projectStatus('status').notNull().default('active'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('projects_status_idx').on(table.status),
    uniqueIndex('projects_github_repository_idx').on(table.githubRepository).where(sql`${table.githubRepository} IS NOT NULL`),
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

export const integrationSettings = pgTable('integration_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  encryptedValue: text('encrypted_value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Configuración editable del informe semanal. Los secretos permanecen fuera de PostgreSQL. */
export const weeklyReportSettings = pgTable('weekly_report_settings', {
  id: varchar('id', { length: 40 }).primaryKey(),
  enabled: boolean('enabled').notNull().default(true),
  recipient: varchar('recipient', { length: 320 }).notNull(),
  scheduleDay: integer('schedule_day').notNull().default(5),
  scheduleHour: integer('schedule_hour').notNull().default(8),
  timeZone: varchar('time_zone', { length: 80 }).notNull().default('Europe/Madrid'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('weekly_report_settings_schedule_day', sql`${table.scheduleDay} BETWEEN 1 AND 7`),
  check('weekly_report_settings_schedule_hour', sql`${table.scheduleHour} BETWEEN 0 AND 23`),
]);

export const weeklyReportProjects = pgTable('weekly_report_projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 120 }).notNull(),
  repository: varchar('repository', { length: 200 }).notNull(),
  focus: text('focus').notNull().default(''),
  enabled: boolean('enabled').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('weekly_report_projects_name_idx').on(table.name),
  uniqueIndex('weekly_report_projects_repository_idx').on(table.repository),
  index('weekly_report_projects_project_id_idx').on(table.projectId),
  check('weekly_report_projects_name_not_blank', sql`length(btrim(${table.name})) > 0`),
]);

export const automationRunStatus = pgEnum('automation_run_status', ['running', 'succeeded', 'failed']);
export const weeklyReportStatus = pgEnum('weekly_report_status', ['generated', 'failed']);
export const reportDeliveryStatus = pgEnum('report_delivery_status', ['pending', 'sent', 'failed']);

export const automationRuns = pgTable('automation_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobKey: varchar('job_key', { length: 80 }).notNull(),
  status: automationRunStatus('status').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  summary: text('summary'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('automation_runs_job_started_idx').on(table.jobKey, table.startedAt)]);

export const weeklyReports = pgTable('weekly_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  reportProjectId: uuid('report_project_id').notNull().references(() => weeklyReportProjects.id, { onDelete: 'cascade' }),
  runId: uuid('run_id').references(() => automationRuns.id, { onDelete: 'set null' }),
  reportDate: date('report_date').notNull(),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  markdown: text('markdown'),
  localPath: text('local_path'),
  status: weeklyReportStatus('status').notNull(),
  emailStatus: reportDeliveryStatus('email_status').notNull().default('pending'),
  messageId: varchar('message_id', { length: 320 }),
  emailError: text('email_error'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('weekly_reports_project_date_idx').on(table.reportProjectId, table.reportDate),
  index('weekly_reports_created_idx').on(table.createdAt),
]);

export const reportDeliveries = pgTable('report_deliveries', {
  id: uuid('id').defaultRandom().primaryKey(),
  reportId: uuid('report_id').notNull().references(() => weeklyReports.id, { onDelete: 'cascade' }),
  recipient: varchar('recipient', { length: 320 }).notNull(),
  status: reportDeliveryStatus('status').notNull(),
  messageId: varchar('message_id', { length: 320 }),
  error: text('error'),
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('report_deliveries_report_attempted_idx').on(table.reportId, table.attemptedAt)]);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 200 }).notNull(),
    ticketNumber: integer('ticket_number').notNull(),
    notes: text('notes'),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    status: taskStatus('status').notNull().default('pending'),
    priority: taskPriority('priority').notNull().default('medium'),
    pinned: boolean('pinned').notNull().default(false),
    scheduledFor: date('scheduled_for'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    blockedReason: text('blocked_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('tasks_project_id_idx').on(table.projectId),
    uniqueIndex('tasks_project_ticket_number_idx').on(table.projectId, table.ticketNumber).where(sql`${table.projectId} IS NOT NULL`),
    uniqueIndex('tasks_inbox_ticket_number_idx').on(table.ticketNumber).where(sql`${table.projectId} IS NULL`),
    index('tasks_status_scheduled_for_idx').on(table.status, table.scheduledFor),
    index('tasks_due_at_idx').on(table.dueAt),
    index('tasks_deleted_at_idx').on(table.deletedAt),
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

export const taskSequences = pgTable('task_sequences', {
  scopeKey: varchar('scope_key', { length: 36 }).primaryKey(),
  nextNumber: integer('next_number').notNull(),
});

export const projectActivities = pgTable(
  'project_activities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    eventType: varchar('event_type', { length: 40 }).notNull(),
    taskTitle: varchar('task_title', { length: 200 }),
    fromStatus: varchar('from_status', { length: 20 }),
    toStatus: varchar('to_status', { length: 20 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('project_activities_project_created_idx').on(table.projectId, table.createdAt)],
);

export const taskAttachments = pgTable(
  'task_attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    size: integer('size').notNull(),
    storageKey: uuid('storage_key').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('task_attachments_task_id_idx').on(table.taskId)],
);

export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;
export type ProjectActivityRow = typeof projectActivities.$inferSelect;
export type TaskAttachmentRow = typeof taskAttachments.$inferSelect;
export type WeeklyReportSettingsRow = typeof weeklyReportSettings.$inferSelect;
export type WeeklyReportProjectRow = typeof weeklyReportProjects.$inferSelect;
export type AutomationRunRow = typeof automationRuns.$inferSelect;
export type WeeklyReportRow = typeof weeklyReports.$inferSelect;
