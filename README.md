# Nexo

Nexo es un organizador personal de proyectos y tareas. Su objetivo es mostrar con claridad
qué hacer ahora, sin la complejidad de un tablero genérico.

El proyecto incluye una aplicación web y un servidor MCP que compartirán las mismas reglas
de negocio y contratos.

## Estructura

```text
apps/
  web/          Interfaz Astro
  api/          Backend HTTP y acceso a SQLite
  mcp/          Adaptador MCP para Codex
packages/
  contracts/    Tipos y esquemas compartidos
  api-client/   Cliente HTTP tipado para web y MCP
infra/          Configuración de despliegue
```

## Desarrollo

```sh
pnpm install
pnpm dev
```

La web quedará disponible normalmente en `http://localhost:4321`.

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
web consumirán la API privada; ninguno accederá directamente a SQLite.
