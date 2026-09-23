import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const now = '2026-01-01T12:00:00.000Z';
const makeProject = (body) => ({
  id: randomUUID(), name: body.name, description: body.description, color: body.color,
  status: 'active', archivedAt: null, createdAt: now, updatedAt: now,
});
const makeTask = (body) => ({
  id: randomUUID(), title: body.title, notes: body.notes ?? null, projectId: body.projectId ?? null, status: 'pending',
  priority: body.priority ?? 'medium', pinned: false, scheduledFor: body.scheduledFor ?? null, dueAt: body.dueAt ?? null, startedAt: null,
  completedAt: null, blockedReason: null, createdAt: now, updatedAt: now,
});
async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}
async function freePort() {
  const server = createServer();
  const port = await listen(server);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test('flujos web: proyecto, inbox, completar y archivar', { timeout: 60_000 }, async (t) => {
  const projects = [];
  const tasks = [];
  const calls = [];
  const api = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
    calls.push({ method: req.method, path: url.pathname, body });
    let value;
    if (url.pathname === '/projects') {
      if (req.method === 'POST') {
        value = makeProject(body);
        projects.push(value);
      } else value = projects.filter((item) => item.status === url.searchParams.get('status'));
    } else if (url.pathname === '/tasks') {
      if (req.method === 'POST') {
        value = makeTask(body);
        tasks.push(value);
      } else value = tasks;
    } else {
      const project = /^\/projects\/([^/]+)(\/archive)?$/.exec(url.pathname);
      const task = /^\/tasks\/([^/]+)(\/complete|\/reopen)?$/.exec(url.pathname);
      if (project) {
        value = projects.find((item) => item.id === project[1]);
        if (value && project[2] && req.method === 'POST') {
          value.status = 'archived';
          value.archivedAt = now;
        }
      } else if (task) {
        value = tasks.find((item) => item.id === task[1]);
        if (value && req.method === 'PATCH') Object.assign(value, body);
        if (value && task[2] && req.method === 'POST') {
          value.status = task[2] === '/complete' ? 'done' : 'pending';
          value.completedAt = task[2] === '/complete' ? now : null;
        }
      }
    }
    res.writeHead(value === undefined ? 404 : 200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(value ?? { message: 'Not found' }));
  });
  const apiPort = await listen(api);
  t.after(() => new Promise((resolve) => api.close(resolve)));
  const webPort = await freePort();
  const web = spawn(process.execPath,
    [fileURLToPath(new URL('../node_modules/astro/astro.js', import.meta.url)),
      'dev', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, API_BASE_URL: `http://127.0.0.1:${apiPort}` },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  let output = '';
  web.stdout.on('data', (chunk) => { output += chunk; });
  web.stderr.on('data', (chunk) => { output += chunk; });
  t.after(() => web.kill());
  const base = `http://127.0.0.1:${webPort}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (web.exitCode !== null) break;
    try {
      if ((await fetch(`${base}/projects`)).ok) { ready = true; break; }
    } catch { /* Astro is starting. */ }
    await delay(200);
  }
  assert.ok(ready, `Astro did not start: ${output}`);
  const submit = (path, values, origin = base) => fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin },
    body: new URLSearchParams(values),
    redirect: 'manual',
  });

  const rejected = await submit('/projects', { name: 'Origen externo' }, 'https://example.org');
  assert.equal(rejected.status, 403);
  assert.equal(projects.length, 0);

  const created = await submit('/projects',
    { name: 'Proyecto de prueba', description: 'Descripción', color: '#4d8564' });
  assert.equal(created.status, 303);
  assert.equal(created.headers.get('location'), '/projects');
  assert.match(await (await fetch(`${base}/projects`)).text(), /Proyecto de prueba/);
  assert.deepEqual(calls.find((call) => call.method === 'POST' && call.path === '/projects').body,
    { name: 'Proyecto de prueba', description: 'Descripción', color: '#4d8564' });
  const projectPage = await (await fetch(`${base}/projects/${projects[0].id}`)).text();
  assert.match(projectPage, /Vista de tareas/);
  assert.match(projectPage, /Columnas[\s\S]*Filas/);
  assert.match(projectPage, /class="task-board/);
  assert.match(await (await fetch(`${base}/projects/${projects[0].id}?view=list`)).text(), /name="view" value="list"/);

  assert.equal((await submit('/inbox', {
    title: 'Tarea capturada', scheduledFor: '2026-09-22',
    dueAt: '2026-09-24T12:00', dueAtIso: '2026-09-24T10:00:00.000Z',
  })).status, 303);
  assert.match(await (await fetch(`${base}/inbox`)).text(), /Tarea capturada/);
  assert.equal(calls.find((call) => call.method === 'POST' && call.path === '/tasks').body.title,
    'Tarea capturada');
  assert.equal(tasks[0].dueAt, '2026-09-24T10:00:00.000Z');
  const home = await (await fetch(`${base}/?date=2026-09-22`)).text();
  assert.match(home, /Calendario/);
  assert.match(home, /class="brand-short" hidden/);
  assert.match(home, /addEventListener\('click'/);
  assert.match(home, /\.app-shell\.is-collapsed/);
  assert.match(home, /class="dashboard-grid"/);
  assert.match(home, /Tarea capturada, programada/);
  assert.match(home, /Tarea capturada, fecha límite/);
  assert.match(home, /Las 3 tareas más nuevas/);
  assert.match(await (await fetch(`${base}/?view=week&date=2026-09-22`)).text(), /Semana siguiente/);

  assert.equal((await submit(`/tasks/${tasks[0].id}`, { intent: 'pin' })).status, 303);
  assert.equal(tasks[0].pinned, true);
  assert.match(await (await fetch(`${base}/`)).text(), /Tareas ancladas[\s\S]*Tarea capturada/);
  assert.equal((await submit(`/tasks/${tasks[0].id}`, { intent: 'unpin' })).status, 303);
  assert.equal(tasks[0].pinned, false);

  assert.equal((await submit('/inbox', { intent: 'complete', taskId: tasks[0].id })).status, 303);
  assert.equal(tasks[0].status, 'done');
  assert.match(await (await fetch(`${base}/inbox`)).text(), /Tarea capturada/);
  assert.match(await (await fetch(`${base}/inbox?status=done`)).text(), /Tarea capturada/);
  assert.equal((await submit('/inbox', { intent: 'reopen', taskId: tasks[0].id })).status, 303);
  assert.equal(tasks[0].status, 'pending');
  assert.match(await (await fetch(`${base}/inbox`)).text(), /Tarea capturada/);

  const archived = await submit(`/projects/${projects[0].id}`, { intent: 'archive' });
  assert.equal(archived.status, 303);
  assert.equal(archived.headers.get('location'), '/projects?status=archived');
  assert.equal(projects[0].status, 'archived');
  assert.match(await (await fetch(`${base}/projects?status=archived`)).text(), /Proyecto de prueba/);
  assert.doesNotMatch(await (await fetch(`${base}/projects`)).text(), /Proyecto de prueba/);
});
