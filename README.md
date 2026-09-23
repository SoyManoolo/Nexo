# Nexo

Nexo es un organizador personal de proyectos y tareas, pensado para mostrar con claridad qué hacer ahora sin la complejidad de un tablero genérico.

## Estado actual

La aplicación web y la API están implementadas y usan PostgreSQL. Actualmente se puede:

- crear, editar, archivar y eliminar proyectos;
- capturar tareas en el Inbox o asignarlas a un proyecto;
- organizar tareas por estado (`inbox`, `next`, `in_progress`, `blocked` y `done`), prioridad, fechas y anclado en inicio;
- completar, reabrir y devolver tareas al Inbox;
- consultar Inicio (calendario mensual o semanal, tareas ancladas y recientes), Inbox, Hoy y Proyectos;
- usar tema claro u oscuro y contraer la navegación lateral.

El servidor MCP está creado como espacio reservado, pero todavía no ofrece herramientas ni se distribuye como integración funcional.

## Estructura

```text
apps/
  web/          Aplicación Astro renderizada en servidor
  api/          API HTTP con Hono, Drizzle ORM y PostgreSQL
  mcp/          Punto de entrada MCP pendiente de implementación
packages/
  contracts/    Esquemas Zod y tipos compartidos
  api-client/   Cliente HTTP tipado para los consumidores de la API
infra/          Notas de infraestructura y despliegue
```

La web consume la API mediante `@nexo/api-client`; no accede directamente a la base de datos. En la API se separan rutas, servicios, repositorios y acceso a datos.

## Requisitos

- Node.js compatible con pnpm 11
- pnpm 11 (`corepack enable` permite gestionarlo con el `packageManager` del proyecto)
- Docker y Docker Compose para ejecutar PostgreSQL localmente

## Puesta en marcha local

Prepara las dependencias y los archivos de configuración. Usa el bloque de tu sistema:

```powershell
pnpm.cmd install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path apps/web/.env)) { Copy-Item apps/web/.env.example apps/web/.env }
```

```sh
pnpm install
[ -f .env ] || cp .env.example .env
[ -f apps/web/.env ] || cp apps/web/.env.example apps/web/.env
```

Inicia PostgreSQL y aplica las migraciones. En PowerShell:

```powershell
docker compose up -d postgres
$env:DATABASE_URL = 'postgresql://nexo:nexo@127.0.0.1:5432/nexo'
pnpm.cmd --filter @nexo/api db:migrate
```

En Linux/macOS:

```sh
docker compose up -d postgres
export DATABASE_URL='postgresql://nexo:nexo@127.0.0.1:5432/nexo'
pnpm --filter @nexo/api db:migrate
```

Arranca la API en una terminal y Astro en otra. En PowerShell, define `DATABASE_URL` también en la terminal de la API: las variables `$env:` solo viven en la sesión donde se asignan, y la API no carga automáticamente el archivo `.env`.

```powershell
$env:DATABASE_URL = 'postgresql://nexo:nexo@127.0.0.1:5432/nexo'
pnpm.cmd dev:api
```

En Linux/macOS, ejecuta esto en la terminal de la API:

```sh
export DATABASE_URL='postgresql://nexo:nexo@127.0.0.1:5432/nexo'
pnpm dev:api
```

En la otra terminal, inicia Astro. PowerShell:

```powershell
pnpm.cmd dev
```

Linux/macOS:

```sh
pnpm dev
```

Abre [http://localhost:4321](http://localhost:4321). La API escucha por defecto en `http://127.0.0.1:3000`.

## Configuración

Docker Compose lee la configuración de PostgreSQL desde `.env`. La API necesita `DATABASE_URL` en el entorno de su proceso; el ejemplo de arranque de arriba la define en la terminal de la API. La configuración de la web vive en `apps/web/.env`:

- `API_BASE_URL`: URL de la API usada por Astro en el servidor. Por defecto, `http://127.0.0.1:3000`.
- `NEXO_TIME_ZONE`: zona horaria usada por las vistas Inicio y Hoy. Por defecto, `Europe/Madrid`.
- `WEB_ALLOWED_HOSTNAME`: nombre de host adicional permitido al compilar la web; es opcional y útil al servirla fuera de `localhost`.

Si PostgreSQL local usa otras credenciales o puerto, actualiza `DATABASE_URL` en las terminales donde ejecutas la migración y la API. En PowerShell, usa `pnpm.cmd` si la política de ejecución bloquea `pnpm.ps1`; en Linux/macOS usa `pnpm`. Cambiar `POSTGRES_PASSWORD` en `.env` no cambia la contraseña de un volumen PostgreSQL que ya se haya inicializado.

## Comandos

```sh
pnpm dev                 # Web Astro en desarrollo (Linux/macOS)
pnpm dev:api             # API HTTP en desarrollo (Linux/macOS)
pnpm check
pnpm build
pnpm --filter @nexo/web test
pnpm --filter @nexo/api test
pnpm --filter @nexo/api-client test
```

En PowerShell, sustituye `pnpm` por `pnpm.cmd` si la política de ejecución bloquea el script `pnpm.ps1`.

Para las migraciones, desde la raíz:

```sh
pnpm --filter @nexo/api db:generate
pnpm --filter @nexo/api db:check
pnpm --filter @nexo/api db:migrate
pnpm --filter @nexo/api db:push
pnpm --filter @nexo/api db:studio
```

`db:generate` crea migraciones a partir del esquema. `db:migrate` aplica las migraciones existentes; para revertir una migración aplicada, crea una nueva que deshaga el cambio.

## API HTTP

La API expone `GET /health`, recursos de proyectos bajo `/projects` y tareas bajo `/tasks`. Los contratos de entrada y salida se validan con Zod y están compartidos con los consumidores. La documentación detallada de rutas y ejemplos está en [apps/api/README.md](C:/Users/eriks/Documents/GitHub/Nexo/apps/api/README.md).

## Base de datos

`docker compose up -d postgres` crea PostgreSQL 16 y conserva sus datos en el volumen `postgres_data`. El puerto solo se publica en `127.0.0.1` por defecto; configura `POSTGRES_BIND_ADDRESS` únicamente si necesitas que otro equipo pueda acceder directamente. Para detenerlo sin eliminar los datos:

```sh
docker compose down
```

`docker compose down -v` elimina también el volumen de datos.
