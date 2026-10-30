# backend

API principal en **Node.js + Express** (`/api/*`). Es el único servicio que consulta PostgreSQL y que llama al servicio de IA.

**Responsable:** Rebeca Fields Gómez · **Respaldo:** Ángel De Anda Gómez

## Qué va aquí

- Inicio de sesión del administrador con `ADMIN_EMAIL` y `ADMIN_PASSWORD` del `.env` (RF-07).
- Consultas para Resumen, Clientes y Alertas con sus filtros (RF-03, RF-04).
- `POST /api/predict`: recibe el formulario del Simulador y lo reenvía a `ML_SERVICE_URL/predict` (RF-02).
- Predicción masiva de los 50,000 clientes y su guardado (RF-08).
- Registro de cupones y contactos (RF-06).
- `Dockerfile` del servicio.

## Reglas

- Lee todas las credenciales de variables de entorno (`process.env`).
- Se conecta a la base de datos con el host `db` y al servicio de IA con `ml-service`, nunca con `localhost`.
