# API de proyectos

La API HTTP se inicia desde la raíz del repositorio con `pnpm dev` y expone las rutas de
proyectos bajo `/projects`. Todas las respuestas exitosas devuelven JSON.

## Endpoints

### `POST /projects`

Crea un proyecto.

Request:

```http
POST /projects
Content-Type: application/json

{"name":"Nexo","description":"Organizador personal","color":"#2563EB"}
```

Response `201`:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "name": "Nexo",
  "description": "Organizador personal",
  "color": "#2563EB",
  "status": "active",
  "archivedAt": null,
  "createdAt": "2026-01-01T12:00:00.000Z",
  "updatedAt": "2026-01-01T12:00:00.000Z"
}
```

### `GET /projects`

Lista proyectos. Se puede filtrar por estado con `?status=active` o `?status=archived`.

Request:

```http
GET /projects?status=active
```

Response `200`:

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "name": "Nexo",
    "description": "Organizador personal",
    "color": "#2563EB",
    "status": "active",
    "archivedAt": null,
    "createdAt": "2026-01-01T12:00:00.000Z",
    "updatedAt": "2026-01-01T12:00:00.000Z"
  }
]
```

### `GET /projects/:id`

Consulta un proyecto por UUID.

Request:

```http
GET /projects/550e8400-e29b-41d4-a716-446655440002
```

Response `200`:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "name": "Nexo",
  "description": "Organizador personal",
  "color": "#2563EB",
  "status": "active",
  "archivedAt": null,
  "createdAt": "2026-01-01T12:00:00.000Z",
  "updatedAt": "2026-01-01T12:00:00.000Z"
}
```

### `PATCH /projects/:id`

Actualiza `name`, `description` o `color`. `description` y `color` aceptan `null`.

Request:

```http
PATCH /projects/550e8400-e29b-41d4-a716-446655440002
Content-Type: application/json

{"name":"Nexo personal","description":null}
```

Response `200`:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "name": "Nexo personal",
  "description": null,
  "color": "#2563EB",
  "status": "active",
  "archivedAt": null,
  "createdAt": "2026-01-01T12:00:00.000Z",
  "updatedAt": "2026-01-01T12:05:00.000Z"
}
```

### `POST /projects/:id/archive`

Archiva un proyecto. La operación es idempotente: archivar un proyecto ya archivado también
devuelve `200` y conserva su fecha de archivado.

Request:

```http
POST /projects/550e8400-e29b-41d4-a716-446655440002/archive
```

Response `200`:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "name": "Nexo personal",
  "description": null,
  "color": "#2563EB",
  "status": "archived",
  "archivedAt": "2026-01-01T12:10:00.000Z",
  "createdAt": "2026-01-01T12:00:00.000Z",
  "updatedAt": "2026-01-01T12:10:00.000Z"
}
```

### `POST /projects/:id/restore`

Restaura un proyecto archivado. La operación es idempotente y devuelve el proyecto activo.

```http
POST /projects/550e8400-e29b-41d4-a716-446655440002/restore
```

### `GET /projects/:id/activity`

Devuelve hasta 30 eventos recientes del proyecto. Registra creación, archivado y restauración del
proyecto, creación y asignación de tareas, y cambios de estado. La web combina estos eventos con
los commits recientes de GitHub en una sola cronología.

```http
GET /projects/550e8400-e29b-41d4-a716-446655440002/activity
```

## Tareas

Las tareas pueden permanecer en el inbox (`projectId: null`) o pertenecer a un proyecto activo.
Los proyectos inexistentes devuelven `404` y los archivados no aceptan tareas nuevas (`400`).
Cada tarea puede guardar hasta 20 etiquetas personalizadas de hasta 40 caracteres.

### `POST /tasks`

Crea una tarea. `status` por defecto es `pending` y `priority` por defecto es `medium`.

Request para el inbox:

```http
POST /tasks
Content-Type: application/json

{"title":"Procesar notas","priority":"high"}
```

Request dentro de un proyecto:

```http
POST /tasks
Content-Type: application/json

{"title":"Preparar entrega","projectId":"550e8400-e29b-41d4-a716-446655440002","status":"in_review"}
```

Response `201`:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "title": "Procesar notas",
  "notes": null,
  "projectId": null,
  "status": "pending",
  "priority": "high",
  "scheduledFor": null,
  "dueAt": null,
  "startedAt": null,
  "completedAt": null,
  "blockedReason": null,
  "createdAt": "2026-01-01T12:00:00.000Z",
  "updatedAt": "2026-01-01T12:00:00.000Z"
}
```

Los estados posibles son `pending` (Pendiente), `in_progress` (En progreso), `in_review` (En revisión), `done` (Completada) y `blocked` (Bloqueada). Una tarea `blocked` requiere `blockedReason`. Una tarea `done` requiere `completedAt` cuando se crea directamente.

### `GET /tasks`

Lista tareas. Se pueden combinar los filtros `projectId`, `status` y `priority`; también admite
`scheduledFor` y `dueAt`.

Request:

```http
GET /tasks?projectId=550e8400-e29b-41d4-a716-446655440002&status=in_review&priority=high
```

Response `200`:

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "title": "Preparar entrega",
    "notes": null,
    "projectId": "550e8400-e29b-41d4-a716-446655440002",
    "status": "in_review",
    "priority": "high",
    "scheduledFor": null,
    "dueAt": null,
    "startedAt": null,
    "completedAt": null,
    "blockedReason": null,
    "createdAt": "2026-01-01T12:00:00.000Z",
    "updatedAt": "2026-01-01T12:00:00.000Z"
  }
]
```

### `GET /tasks/:id`

Consulta una tarea por UUID. Un UUID válido pero inexistente devuelve `404`.

### `PATCH /tasks/:id`

Actualiza los campos de una tarea. Para bloquearla se envía un motivo:

```http
PATCH /tasks/550e8400-e29b-41d4-a716-446655440003
Content-Type: application/json

{"status":"blocked","blockedReason":"Esperando aprobación"}
```

Response `200`:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "title": "Preparar entrega",
  "notes": null,
  "projectId": "550e8400-e29b-41d4-a716-446655440002",
  "status": "blocked",
  "priority": "high",
  "scheduledFor": null,
  "dueAt": null,
  "startedAt": null,
  "completedAt": null,
  "blockedReason": "Esperando aprobación",
  "createdAt": "2026-01-01T12:00:00.000Z",
  "updatedAt": "2026-01-01T12:05:00.000Z"
}
```

### Acciones de tareas

`POST /tasks/:id/complete` marca una tarea como `done`, `POST /tasks/:id/reopen` la devuelve a
`in_review`, y `POST /tasks/:id/move-to-inbox` elimina su proyecto y la devuelve al inbox con estado
`pending`. Todas devuelven la tarea actualizada con `200`.

```http
POST /tasks/550e8400-e29b-41d4-a716-446655440003/complete
POST /tasks/550e8400-e29b-41d4-a716-446655440003/reopen
POST /tasks/550e8400-e29b-41d4-a716-446655440003/move-to-inbox
```

### Archivos adjuntos

`GET /tasks/:id/attachments` lista los archivos; `POST /tasks/:id/attachments` recibe un formulario
multipart con el campo `file`; `GET /tasks/:id/attachments/:attachmentId` devuelve el archivo y
`DELETE` elimina el adjunto. Se admiten PNG, JPEG, WebP, PDF y TXT de hasta 10 MB. Los datos del
archivo se guardan en PostgreSQL y el contenido en el directorio `NEXO_UPLOADS_DIR` (por defecto,
`uploads`). En Docker Compose, el directorio usa el volumen persistente `uploads_data`.
