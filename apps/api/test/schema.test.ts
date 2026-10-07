import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

test(
  'PostgreSQL schema exposes the Nexo tables, enums, defaults and constraints',
  { skip: !databaseUrl },
  async (t) => {
    const pool = new Pool({ connectionString: databaseUrl });
    t.after(() => pool.end());

    const tables = await pool.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('projects', 'tasks')
    ORDER BY table_name
  `);
    assert.deepEqual(
      tables.rows.map(({ table_name }) => table_name),
      ['projects', 'tasks'],
    );

    const enums = await pool.query<{ typname: string; enumlabel: string }>(`
    SELECT typname, enumlabel
    FROM pg_type
    JOIN pg_enum ON pg_enum.enumtypid = pg_type.oid
    WHERE typname IN ('project_status', 'task_status', 'task_priority')
    ORDER BY typname, enumsortorder
  `);
    assert.deepEqual(enums.rows, [
      { typname: 'project_status', enumlabel: 'active' },
      { typname: 'project_status', enumlabel: 'archived' },
      { typname: 'task_priority', enumlabel: 'low' },
      { typname: 'task_priority', enumlabel: 'medium' },
      { typname: 'task_priority', enumlabel: 'high' },
      { typname: 'task_status', enumlabel: 'pending' },
      { typname: 'task_status', enumlabel: 'in_review' },
      { typname: 'task_status', enumlabel: 'in_progress' },
      { typname: 'task_status', enumlabel: 'blocked' },
      { typname: 'task_status', enumlabel: 'done' },
    ]);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const project = await client.query<{ id: string; status: string }>(
        `INSERT INTO projects (name) VALUES ('schema-test') RETURNING id, status`,
      );
      assert.equal(project.rows[0].status, 'active');

      const task = await client.query<{
        project_id: string;
        ticket_number: number;
        status: string;
        priority: string;
        pinned: boolean;
      }>(
        `INSERT INTO tasks (project_id, ticket_number, title)
       VALUES ($1, 1, 'schema-test-task')
       RETURNING project_id, ticket_number, status, priority, pinned`,
        [project.rows[0].id],
      );
      assert.deepEqual(task.rows[0], {
        project_id: project.rows[0].id,
        ticket_number: 1,
        status: 'pending',
        priority: 'medium',
        pinned: false,
      });

      await client.query('SAVEPOINT invalid_task');
      await assert.rejects(
        client.query(
          `INSERT INTO tasks (ticket_number, title, status, blocked_reason)
           VALUES (2, 'invalid', 'pending', 'reason')`,
        ),
        { code: '23514', constraint: 'tasks_blocked_reason_consistency' },
      );
      await client.query('ROLLBACK TO SAVEPOINT invalid_task');

      await assert.rejects(
        client.query(
          `INSERT INTO tasks (project_id, title) VALUES ($1, 'missing-ticket-number')`,
          [project.rows[0].id],
        ),
        { code: '23502', column: 'ticket_number' },
      );
    } finally {
      try {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    }
  },
);
