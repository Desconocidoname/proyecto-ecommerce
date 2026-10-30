# Instrucciones para asistentes de IA

Este archivo es para cualquier asistente de programación (Claude Code, Cursor, Codex, Copilot, etc.) que trabaje en este repositorio. Léelo completo antes de proponer o hacer cambios.

## Antes de cualquier cambio

1. Lee `README.md` completo: explica la arquitectura, la estructura de carpetas y las reglas del equipo.
2. Si la tarea toca requerimientos, datos, el modelo o la API, consulta `docs/entregas/Entrega2_Especificacion_Tecnica.pdf`. Es la fuente de verdad.
3. Lee el `README.md` de la carpeta en la que vas a trabajar.
4. Si la tarea pide algo que no está en el alcance cerrado de la Entrega 2 (sección 7), detente y avisa al usuario antes de programarlo.

## Arquitectura (no la cambies)

- `frontend/`: React + Vite servido con Nginx. Solo llama al backend en `/api/*`. No contiene lógica de IA ni acceso a la base de datos.
- `backend/`: Node.js + Express. Único servicio que consulta PostgreSQL y que llama al servicio de IA.
- `ml/serving/`: FastAPI. Expone `predecir(datos_entrada: dict) -> dict` mediante `POST /predict`.
- `ml/training/`: entrenamiento manual con scikit-learn; guarda el modelo en el volumen `models`.
- `db/init/`: scripts SQL que PostgreSQL ejecuta al crear la base de datos.
- Los servicios se comunican por nombre dentro de la red de Docker (`db`, `backend`, `ml-service`), nunca por `localhost`.

## Reglas obligatorias

- **Secretos:** nunca escribas contraseñas, claves ni tokens en el código. Léelos de variables de entorno. Si agregas una variable, agrégala también a `.env.example` con un valor de ejemplo. Nunca leas, muestres ni modifiques el archivo `.env` real.
- **Fuga de datos:** el modelo nunca usa estas columnas como entrada: `days_since_last_purchase`, `activity_status`, `recency_score`, `frequency_score`, `rfm_score`, `rfm_category`, `purchase_frequency`, `behavior_segment`, `segment_category`, `churn_risk_score`, `churn_risk_category`, `customer_health_score`, `health_status`.
- **Objetivo:** `riesgo = 1` si `churn_risk_score >= 40`. Partición 80/20 estratificada con `random_state = 42`.
- **Contratos:** no cambies nombres de endpoints, campos JSON ni tablas sin que el usuario lo confirme, porque otros integrantes dependen de ellos.
- **Datos y modelos:** no agregues a Git nada de `data/raw/`, `data/processed/` ni `ml/models/`.
- **Alcance:** no agregues funcionalidades, librerías grandes ni servicios nuevos que no estén en la Entrega 2 sin preguntar.

## Estilo

- Textos de la interfaz y mensajes de error para el usuario: en español.
- Commits con formato Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).
- Cambios pequeños y enfocados en la tarea pedida; no reformatees archivos completos.
- Si no estás seguro de algo del proyecto, pregunta en lugar de suponer.
