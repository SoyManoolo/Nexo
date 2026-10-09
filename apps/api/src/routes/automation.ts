import { asc, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  UpdateWeeklyReportProjectInputSchema,
  UpdateWeeklyReportSettingsInputSchema,
} from '@nexo/contracts';
import { db } from '../db/drizzle.js';
import {
  automationRuns,
  reportDeliveries,
  weeklyReportProjects,
  weeklyReportSettings,
  weeklyReports,
} from '../db/schema.js';

const WEEKLY_REPORTS_ID = 'weekly-reports';
const defaultSettings = {
  id: WEEKLY_REPORTS_ID,
  enabled: true,
  recipient: 'erik.saldi.diaz@gmail.com',
  scheduleDay: 5,
  scheduleHour: 8,
  timeZone: 'Europe/Madrid',
};

const AutomationRunInputSchema = z.object({
  status: z.enum(['running', 'succeeded', 'failed']),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable().optional(),
  summary: z.string().max(20_000).nullable().optional(),
  error: z.string().max(20_000).nullable().optional(),
}).strict();

const WeeklyReportSyncSchema = z.object({
  repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  runId: z.string().uuid().nullable().optional(),
  reportDate: z.string().date(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  markdown: z.string().max(500_000).nullable().optional(),
  localPath: z.string().max(2_000).nullable().optional(),
  status: z.enum(['generated', 'failed']),
  emailStatus: z.enum(['pending', 'sent', 'failed']),
  messageId: z.string().max(320).nullable().optional(),
  emailError: z.string().max(10_000).nullable().optional(),
  sentAt: z.string().datetime().nullable().optional(),
}).strict();

async function settings() {
  await db.insert(weeklyReportSettings).values(defaultSettings).onConflictDoNothing();
  const [value] = await db.select().from(weeklyReportSettings).where(eq(weeklyReportSettings.id, WEEKLY_REPORTS_ID));
  if (!value) throw new Error('No se pudo inicializar la configuración de informes');
  return value;
}

/**
 * Control plane para la automatización local. No ejecuta comandos: systemd continúa siendo
 * el único proceso que ejecuta Codex y que puede acceder al secreto SMTP.
 */
export const automationRoute = new Hono();

automationRoute.get('/weekly-reports', async (context) => {
  const [configuration, projects, reports, runs] = await Promise.all([
    settings(),
    db.select().from(weeklyReportProjects).orderBy(asc(weeklyReportProjects.sortOrder), asc(weeklyReportProjects.name)),
    db.select({
      id: weeklyReports.id,
      reportProjectId: weeklyReports.reportProjectId,
      projectName: weeklyReportProjects.name,
      reportDate: weeklyReports.reportDate,
      periodStart: weeklyReports.periodStart,
      periodEnd: weeklyReports.periodEnd,
      markdown: weeklyReports.markdown,
      localPath: weeklyReports.localPath,
      status: weeklyReports.status,
      emailStatus: weeklyReports.emailStatus,
      messageId: weeklyReports.messageId,
      emailError: weeklyReports.emailError,
      sentAt: weeklyReports.sentAt,
      createdAt: weeklyReports.createdAt,
      updatedAt: weeklyReports.updatedAt,
    }).from(weeklyReports).innerJoin(weeklyReportProjects, eq(weeklyReports.reportProjectId, weeklyReportProjects.id))
      .orderBy(desc(weeklyReports.reportDate), desc(weeklyReports.createdAt)).limit(50),
    db.select().from(automationRuns).where(eq(automationRuns.jobKey, WEEKLY_REPORTS_ID))
      .orderBy(desc(automationRuns.startedAt)).limit(25),
  ]);

  return context.json({
    settings: configuration,
    projects,
    reports,
    runs,
    // El secreto de Gmail nunca se lee desde la API; el agente local lo sincronizará después.
    emailConfigured: null,
  });
});

automationRoute.put('/weekly-reports', async (context) => {
  let body: unknown;
  try { body = await context.req.json(); } catch {
    return context.json({ error: 'validation_error', message: 'El cuerpo debe ser JSON válido' }, 400);
  }
  const input = UpdateWeeklyReportSettingsInputSchema.safeParse(body);
  if (!input.success) return context.json({ error: 'validation_error', message: 'Configuración de informe no válida' }, 400);
  await settings();
  const [updated] = await db.update(weeklyReportSettings).set({ ...input.data, updatedAt: new Date() })
    .where(eq(weeklyReportSettings.id, WEEKLY_REPORTS_ID)).returning();
  return context.json(updated);
});

automationRoute.put('/weekly-reports/projects/:id', async (context) => {
  const id = context.req.param('id');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return context.json({ error: 'validation_error', message: 'Identificador de proyecto no válido' }, 400);
  }
  let body: unknown;
  try { body = await context.req.json(); } catch {
    return context.json({ error: 'validation_error', message: 'El cuerpo debe ser JSON válido' }, 400);
  }
  const input = UpdateWeeklyReportProjectInputSchema.safeParse(body);
  if (!input.success) return context.json({ error: 'validation_error', message: 'Proyecto de informe no válido' }, 400);
  const [updated] = await db.update(weeklyReportProjects).set({ ...input.data, updatedAt: new Date() })
    .where(eq(weeklyReportProjects.id, id)).returning();
  if (!updated) return context.json({ error: 'not_found', message: 'Proyecto de informe no encontrado' }, 404);
  return context.json(updated);
});

automationRoute.post('/weekly-reports/runs', async (context) => {
  let body: unknown;
  try { body = await context.req.json(); } catch {
    return context.json({ error: 'validation_error', message: 'El cuerpo debe ser JSON válido' }, 400);
  }
  const input = AutomationRunInputSchema.safeParse(body);
  if (!input.success) return context.json({ error: 'validation_error', message: 'Ejecución no válida' }, 400);
  const [run] = await db.insert(automationRuns).values({
    jobKey: WEEKLY_REPORTS_ID,
    status: input.data.status,
    startedAt: new Date(input.data.startedAt),
    finishedAt: input.data.finishedAt ? new Date(input.data.finishedAt) : null,
    summary: input.data.summary ?? null,
    error: input.data.error ?? null,
  }).returning();
  return context.json(run, 201);
});

automationRoute.patch('/weekly-reports/runs/:id', async (context) => {
  const id = context.req.param('id');
  if (!z.string().uuid().safeParse(id).success) return context.json({ error: 'validation_error', message: 'Identificador de ejecución no válido' }, 400);
  let body: unknown;
  try { body = await context.req.json(); } catch {
    return context.json({ error: 'validation_error', message: 'El cuerpo debe ser JSON válido' }, 400);
  }
  const input = AutomationRunInputSchema.safeParse(body);
  if (!input.success) return context.json({ error: 'validation_error', message: 'Ejecución no válida' }, 400);
  const [run] = await db.update(automationRuns).set({
    status: input.data.status,
    startedAt: new Date(input.data.startedAt),
    finishedAt: input.data.finishedAt ? new Date(input.data.finishedAt) : null,
    summary: input.data.summary ?? null,
    error: input.data.error ?? null,
  }).where(eq(automationRuns.id, id)).returning();
  if (!run) return context.json({ error: 'not_found', message: 'Ejecución no encontrada' }, 404);
  return context.json(run);
});

automationRoute.put('/weekly-reports/reports', async (context) => {
  let body: unknown;
  try { body = await context.req.json(); } catch {
    return context.json({ error: 'validation_error', message: 'El cuerpo debe ser JSON válido' }, 400);
  }
  const input = WeeklyReportSyncSchema.safeParse(body);
  if (!input.success) return context.json({ error: 'validation_error', message: 'Informe no válido' }, 400);
  const [project] = await db.select().from(weeklyReportProjects).where(eq(weeklyReportProjects.repository, input.data.repository));
  if (!project) return context.json({ error: 'not_found', message: 'El repositorio no participa en informes' }, 404);
  const values = {
    reportProjectId: project.id,
    runId: input.data.runId ?? null,
    reportDate: input.data.reportDate,
    periodStart: new Date(input.data.periodStart),
    periodEnd: new Date(input.data.periodEnd),
    markdown: input.data.markdown ?? null,
    localPath: input.data.localPath ?? null,
    status: input.data.status,
    emailStatus: input.data.emailStatus,
    messageId: input.data.messageId ?? null,
    emailError: input.data.emailError ?? null,
    sentAt: input.data.sentAt ? new Date(input.data.sentAt) : null,
    updatedAt: new Date(),
  };
  const [report] = await db.insert(weeklyReports).values(values).onConflictDoUpdate({
    target: [weeklyReports.reportProjectId, weeklyReports.reportDate],
    set: values,
  }).returning();
  return context.json({ ...report, projectName: project.name });
});

/** El agente local puede publicar el resultado de un envío sin transferir credenciales. */
automationRoute.post('/weekly-reports/deliveries', async (context) => {
  let body: unknown;
  try { body = await context.req.json(); } catch {
    return context.json({ error: 'validation_error', message: 'El cuerpo debe ser JSON válido' }, 400);
  }
  const parsed = z.object({
    reportId: z.string().uuid(), recipient: z.string().email().max(320),
    status: z.enum(['pending', 'sent', 'failed']), messageId: z.string().max(320).nullable().optional(),
    error: z.string().max(10_000).nullable().optional(),
  }).strict().safeParse(body);
  if (!parsed.success) return context.json({ error: 'validation_error', message: 'Resultado de envío no válido' }, 400);
  const now = new Date();
  const [delivery] = await db.insert(reportDeliveries).values({
    reportId: parsed.data.reportId, recipient: parsed.data.recipient, status: parsed.data.status,
    messageId: parsed.data.messageId ?? null, error: parsed.data.error ?? null, attemptedAt: now,
  }).returning();
  await db.update(weeklyReports).set({
    emailStatus: parsed.data.status, messageId: parsed.data.messageId ?? null,
    emailError: parsed.data.error ?? null, sentAt: parsed.data.status === 'sent' ? now : null, updatedAt: now,
  }).where(eq(weeklyReports.id, parsed.data.reportId));
  return context.json(delivery, 201);
});
