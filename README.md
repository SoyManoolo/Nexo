# Nexo

Nexo es un organizador personal de proyectos y tareas, pensado para mostrar con claridad qué hacer ahora sin la complejidad de un tablero genérico.

## Estado actual

La aplicación web y la API están implementadas y usan PostgreSQL. Actualmente se puede:

- crear, editar, archivar, restaurar y eliminar proyectos;
- capturar tareas en el Inbox o asignarlas a un proyecto;
- organizar tareas por estado (Pendiente, En progreso, En revisión, Completada y Bloqueada), prioridad, fechas y anclado en inicio;
- completar, reabrir y devolver tareas al Inbox;
- consultar Inicio (calendario mensual o semanal, tareas ancladas y recientes), Inbox, Hoy y Proyectos;
- importar repositorios de GitHub como proyectos, vincularlos a proyectos existentes y consultar sus commits recientes;
- consultar el avance, las tareas abiertas, bloqueadas y vencidas de cada proyecto, y una cronología de actividad con cambios de tareas y commits de GitHub;
- revisar un resumen semanal, buscar tareas y proyectos, filtrar por estado, prioridad, proyecto y etiquetas;
- guardar etiquetas en tareas, notas de contexto en proyectos y adjuntar capturas/documentos a tareas;
- usar tema claro u oscuro y contraer la navegación lateral.

El servidor MCP expone proyectos y tareas por Streamable HTTP para conectarse a Codex y Claude Code.

## Estructura

```text
apps/
  web/          Aplicación Astro renderizada en servidor
  api/          API HTTP con Hono, Drizzle ORM y PostgreSQL
  mcp/          Servidor MCP Streamable HTTP
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

Para ejecutar el conjunto completo en contenedores, copia `.env.example` a `.env`, cambia los
secretos de despliegue y arranca Compose:

```sh
docker compose up --build -d
```

La web estará disponible en `http://127.0.0.1:4321`. PostgreSQL, API y MCP no publican puertos; para
usar la web y API como procesos locales de desarrollo, apunta `DATABASE_URL` a una instancia
PostgreSQL accesible desde el host.

En Docker, los archivos adjuntos se guardan en el volumen persistente `uploads_data` y sus metadatos
en PostgreSQL. Haz copia de seguridad de ambos volúmenes. `docker compose down -v` elimina también
los adjuntos.

Prepara las dependencias y los archivos de configuración para el desarrollo local. Usa el bloque
de tu sistema:

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

Con PostgreSQL disponible desde el host, aplica las migraciones. En PowerShell:

```powershell
$env:DATABASE_URL = 'postgresql://nexo:nexo@127.0.0.1:5432/nexo'
pnpm.cmd --filter @nexo/api db:migrate
```

En Linux/macOS:

```sh
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

Docker Compose lee las credenciales de PostgreSQL desde `.env` y construye las URLs internas con los nombres `postgres` y `api`. En desarrollo local, la API necesita `DATABASE_URL` en el entorno de su proceso y la web usa `apps/web/.env`:

- `API_BASE_URL`: URL de la API usada por Astro en el servidor. Por defecto, `http://127.0.0.1:3000`.
- `NEXO_TIME_ZONE`: zona horaria usada por las vistas Inicio y Hoy. Por defecto, `Europe/Madrid`.
- `WEB_ALLOWED_HOSTNAME`: nombre de host adicional permitido al compilar la web; es opcional y útil al servirla fuera de `localhost`.
- `GITHUB_TOKEN_ENCRYPTION_KEY`: secreto privado requerido por la API para cifrar el token de GitHub que se configura desde Ajustes.

La guía de contenedores, migraciones, comprobaciones de salud y puertos está en [infra/README.md](C:/Users/eriks/Documents/GitHub/Nexo/infra/README.md).

En **Ajustes → GitHub**, guarda un token de acceso personal con permisos de solo lectura para repositorios. Nexo lo cifra en PostgreSQL. Después puedes elegir un repositorio para importarlo desde la vista Proyectos, o vincularlo desde los detalles de un proyecto existente; ahí aparecerán sus últimos commits y podrás añadir tareas al proyecto. Define `GITHUB_TOKEN_ENCRYPTION_KEY` en el entorno del proceso de la API antes de guardar el token y conserva el mismo valor al reiniciar o desplegar la API.

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

## Servidor MCP

El servidor independiente de `apps/mcp` publica `http://127.0.0.1:3100/mcp` mediante Streamable HTTP y reutiliza el cliente de la API. Ofrece `list_projects`, `get_project`, `list_tasks`, `get_task`, `create_task` y `update_task`. Necesita que la API esté activa; configura `NEXO_API_BASE_URL` si no escucha en `http://127.0.0.1:3000`.

En otra terminal, arráncalo localmente:

```powershell
pnpm.cmd --filter @nexo/mcp dev
```

Comprueba el catálogo con el Inspector MCP:

```powershell
pnpm.cmd --filter @nexo/mcp inspect
```

Para abrir el Inspector visual en lugar del modo CLI, ejecuta `pnpm.cmd --filter @nexo/mcp exec mcp-inspector` y configura el transporte **Streamable HTTP** con `http://127.0.0.1:3100/mcp`.

### Conexión desde Codex y Claude Code

Cuando el servicio esté desplegado en el homelab, apunta ambos clientes a `https://<nombre-del-homelab>.<tailnet>.ts.net/mcp` o a la dirección HTTPS que publique Tailscale Serve. El MCP debe escuchar en una interfaz alcanzable por el proxy; establece `MCP_HOST=0.0.0.0` en ese despliegue. Define `MCP_AUTH_TOKEN` y envía el mismo valor como `Authorization: Bearer ...` en cada cliente. No publiques el puerto directamente en Internet.

Codex permite registrarlo con `codex mcp add nexo --url https://<host-tailnet>/mcp`; para enviar el bearer token, configura en `~/.codex/config.toml`:

```toml
[mcp_servers.nexo]
url = "https://<host-tailnet>/mcp"
bearer_token_env_var = "NEXO_MCP_TOKEN"
```

Para Claude Code, usa `claude mcp add --transport http --scope user nexo https://<host-tailnet>/mcp --header "Authorization: Bearer $NEXO_MCP_TOKEN"` (en PowerShell, sustituye `$NEXO_MCP_TOKEN` por `$env:NEXO_MCP_TOKEN`). Verifica la conexión con `codex mcp list` o `/mcp` en Claude Code.

## Base de datos

`docker compose up --build -d` crea PostgreSQL 16 y conserva sus datos en el volumen `postgres_data`, ejecuta las migraciones pendientes e inicia todos los servicios. Solo la web publica un puerto local para que Tailscale Serve pueda usarla; PostgreSQL, API y MCP no publican sus puertos. Para detener los servicios sin eliminar los datos:

```sh
docker compose down
```

`docker compose down -v` elimina también el volumen de datos.
