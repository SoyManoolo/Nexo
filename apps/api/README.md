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