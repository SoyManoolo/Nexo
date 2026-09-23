import type { ProjectActivity } from '@nexo/contracts';
import { ProjectActivityEventTypeSchema, TaskStatusSchema } from '@nexo/contracts';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { projectActivities, type ProjectActivityRow } from '../db/schema.js';

function toProjectActivity(row: ProjectActivityRow): ProjectActivity {
  return {
    id: row.id,
    projectId: row.projectId,
    taskId: row.taskId,
    eventType: ProjectActivityEventTypeSchema.parse(row.eventType),
    taskTitle: row.taskTitle,
    fromStatus: row.fromStatus === null ? null : TaskStatusSchema.parse(row.fromStatus),
    toStatus: row.toStatus === null ? null : TaskStatusSchema.parse(row.toStatus),
    createdAt: row.createdAt.toISOString(),
  };
}

export class ProjectActivityRepository {
  async list(projectId: string, limit = 30): Promise<ProjectActivity[]> {
    const rows = await db
      .select()
      .from(projectActivities)
      .where(eq(projectActivities.projectId, projectId))
      .orderBy(desc(projectActivities.createdAt), desc(projectActivities.id))
      .limit(limit);
    return rows.map(toProjectActivity);
  }
}
