# Base de datos

Este módulo configura el pool de PostgreSQL desde `DATABASE_URL` y expone la comprobación de
conexión. Los repositories son la única capa autorizada para usar el cliente de base de datos.
