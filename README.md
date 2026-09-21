# Nexo

Nexo es un organizador personal de proyectos y tareas. Su objetivo es mostrar con claridad
qué hacer ahora, sin la complejidad de un tablero genérico.

El proyecto incluye una aplicación web y un servidor MCP que compartirán las mismas reglas
de negocio y contratos.

## Estructura

```text
apps/
  web/          Interfaz Astro y API HTTP
  mcp/          Futuro servidor MCP para Codex
packages/
  contracts/    Tipos y esquemas compartidos
  core/         Reglas de negocio
  db/           Esquema, migraciones y acceso a datos
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
