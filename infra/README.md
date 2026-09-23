# Despliegue con Docker Compose

El archivo `docker-compose.yml` arranca PostgreSQL, ejecuta las migraciones pendientes y después
inicia la API, la web y el servidor MCP. Los servicios se comunican por sus nombres de Compose:
`postgres` y `api`. API, web y MCP escuchan en `0.0.0.0` dentro de sus contenedores.

## Arranque

1. Copia `.env.example` a `.env` y define valores privados para `POSTGRES_PASSWORD`,
   `GITHUB_TOKEN_ENCRYPTION_KEY` y `MCP_AUTH_TOKEN` antes de desplegar.
2. Arranca el conjunto con `docker compose up --build -d`.
3. Consulta el estado con `docker compose ps` y los registros con `docker compose logs -f`.
4. Abre la web en `http://127.0.0.1:4321`.

Solo se publica el puerto de la web, enlazado a `127.0.0.1` por defecto para que Tailscale Serve
pueda actuar como entrada externa controlada. PostgreSQL, API y MCP permanecen en la red interna
de Compose. Cambia `WEB_BIND_ADDRESS` o `WEB_PORT` solo si el proxy de entrada lo requiere.

## Migraciones y datos

Compose espera el estado saludable de PostgreSQL (`pg_isready`) y ejecuta el servicio puntual
`migrate`, que usa `drizzle-kit migrate`. Drizzle registra las migraciones aplicadas y ejecuta solo
las pendientes. La API no arranca si la migración falla. El volumen nombrado `postgres_data`
conserva la base de datos al recrear o reiniciar contenedores; `docker compose down -v` lo elimina.

La API responde en `/health` solo si puede consultar PostgreSQL. MCP ofrece `/health` y responde
saludable solo cuando la API también lo está. La web comprueba que la página principal responda.
Estas comprobaciones confirman disponibilidad, pero conviene verificar también la creación y
lectura de un proyecto o una tarea después del despliegue.

## Configuración

- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`: credenciales de PostgreSQL.
- `GITHUB_TOKEN_ENCRYPTION_KEY`: clave estable para conservar la capacidad de descifrar el token de
  GitHub guardado en Ajustes.
- `MCP_AUTH_TOKEN`: token Bearer para los clientes MCP.
- `NEXO_TIME_ZONE`: zona horaria de la interfaz.
- `WEB_ALLOWED_HOSTNAME`: hostname adicional permitido por Astro, si se accede mediante un dominio.

Las URLs internas se forman con los nombres de servicio: `postgres:5432` y `api:3000`. No se debe
usar `localhost` entre contenedores.
