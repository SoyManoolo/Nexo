# Nexo

Nexo es un organizador personal de proyectos y tareas. Su objetivo es mostrar con claridad
qué hacer ahora, sin la complejidad de un tablero genérico.

El proyecto incluye una aplicación web y un servidor MCP que compartirán las mismas reglas
de negocio y contratos.

## Estructura

```text
apps/
  web/          Interfaz Astro
  api/          Backend HTTP y acceso a PostgreSQL
  mcp/          Adaptador MCP para Codex
packages/
  contracts/    Tipos y esquemas compartidos
  api-client/   Cliente HTTP tipado para web y MCP
infra/          Configuración de despliegue
```

## Desarrollo

Instala las dependencias con `pnpm install`. Para probar la web con datos reales, arranca
PostgreSQL, aplica las migraciones y levanta API y web en dos terminales. En PowerShell:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose up -d postgres
$env:DATABASE_URL = 'postgresql://nexo:nexo@localhost:5432/nexo'
pnpm --filter @nexo/api db:migrate
pnpm dev:api
```

En otra terminal:

```powershell
if (-not (Test-Path apps/web/.env)) { Copy-Item apps/web/.env.example apps/web/.env }
pnpm dev
```

Abre `http://localhost:4321`. Astro consulta la API desde el servidor mediante
`API_BASE_URL`; esta variable no se envía al navegador. Si tu PostgreSQL ya usa otra
contraseña, ajusta `DATABASE_URL` a sus credenciales actuales antes de migrar.
Los formularios locales admiten `localhost` y `127.0.0.1`. Para servir la web bajo otro
nombre de host, configura `WEB_ALLOWED_HOSTNAME` al compilar Astro.
La vista «Hoy» usa `NEXO_TIME_ZONE` (por defecto `Europe/Madrid`) para decidir cuándo
empieza y termina el día, con independencia de la zona horaria del servidor.

```sh
pnpm check
pnpm build
```

### PostgreSQL local

PostgreSQL se ejecuta con Docker Compose y conserva los datos en el volumen `postgres_data`.

```sh
cp .env.example .env
docker compose up -d postgres
docker compose ps
```

Para detener el servicio sin borrar los datos:

```sh
docker compose down
```

El volumen solo se elimina explícitamente con `docker compose down -v`.

### Migraciones de base de datos

Desde `apps/api`, con `DATABASE_URL` configurada:

```sh
pnpm db:generate
pnpm db:check
pnpm db:migrate
pnpm db:rollback
```

`db:rollback` retira una migración del directorio local de Drizzle Kit. Drizzle Kit no
genera migraciones inversas automáticamente; para revertir una migración ya aplicada hay
que crear y aplicar una nueva migración que deshaga sus cambios.

El backend aplica las capas `routes → services → repositories → db`. El servidor MCP y la
web consumirán la API privada; ninguno accederá directamente a PostgreSQL.
