import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ProjectNotFoundError, ProjectValidationError } from '../services/project.service.js';
import {
  TaskNotFoundError,
  TaskProjectNotFoundError,
  TaskValidationError,
} from '../services/task.service.js';
import { GithubIntegrationError } from '../services/github.service.js';

type DatabaseError = Error & { code?: string };

function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof Error && typeof (error as DatabaseError).code === 'string';
}

export function handleApiError(error: Error, context: Context): Response {
  if (error instanceof GithubIntegrationError) {
    return context.json({ error: 'github_error', message: error.message }, error.status as ContentfulStatusCode);
  }
  if (error instanceof ProjectValidationError) {
    return context.json({ error: 'validation_error', message: error.message }, 400);
  }

  if (error instanceof ProjectNotFoundError) {
    return context.json({ error: 'not_found', message: error.message }, 404);
  }

  if (error instanceof TaskValidationError) {
    return context.json({ error: 'validation_error', message: error.message }, 400);
  }

  if (error instanceof TaskProjectNotFoundError || error instanceof TaskNotFoundError) {
    return context.json({ error: 'not_found', message: error.message }, 404);
  }

  if (isDatabaseError(error)) {
    if (error.code === '23514' || error.code === '22P02') {
      return context.json({ error: 'invalid_data', message: 'The submitted data is invalid' }, 400);
    }

    if (error.code === '23503' || error.code === '23505') {
      return context.json(
        { error: 'conflict', message: 'The operation conflicts with existing data' },
        409,
      );
    }
  }

  console.error(error);
  return context.json({ error: 'internal_error', message: 'Internal server error' }, 500);
}
