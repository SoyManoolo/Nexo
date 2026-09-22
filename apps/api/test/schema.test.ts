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
      { typname: 'task_status', enumlabel: 'inbox' },
      { typname: 'task_status', enumlabel: 'next' },
      { typname: 'task_status', enumlabel: 'in_progress' },
      { typname: 'task_status', enumlabel: 'blocked' },
      { typname: 'task_status', enumlabel: 'done' },
    ]);

    await pool.query('BEGIN');
    try {
      const project = await pool.query<{ id: string; status: string }>(
        `INSERT INTO projects (name) VALUES ('schema-test') RETURNING id, status`,
      );
      assert.equal(project.rows[0].status, 'active');

      const task = await pool.query<{ project_id: string; status: string; priority: string }>(
        `INSERT INTO tasks (project_id, title)
       VALUES ($1, 'schema-test-task')
       RETURNING project_id, status, priority`,
        [project.rows[0].id],
      );
      assert.deepEqual(task.rows[0], {
        project_id: project.rows[0].id,
        status: 'inbox',
        priority: 'medium',
      });

      await assert.rejects(
        pool.query(
          `INSERT INTO tasks (title, status, blocked_reason) VALUES ('invalid', 'inbox', 'reason')`,
        ),
      );
    } finally {
      await pool.query('ROLLBACK');
    }
  },
);
