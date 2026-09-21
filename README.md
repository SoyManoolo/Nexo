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

El backend aplica las capas `routes → services → repositories → db`. El servidor MCP y la
web consumirán la API privada; ninguno accederá directamente a SQLite.
