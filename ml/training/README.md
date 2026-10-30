# ml/training

Análisis exploratorio, limpieza y entrenamiento del modelo.

**Responsable:** Juan Daniel Ladino Hernández · **Respaldo:** Ángel De Anda Gómez

## Qué va aquí

- `eda.ipynb`: análisis exploratorio.
- `train.py`: lee los clientes desde PostgreSQL (`DATABASE_URL`), crea `riesgo` (`churn_risk_score >= 40`), entrena el Random Forest dentro de un `Pipeline` y guarda en `MODEL_DIR`:
  - `model.joblib` (preprocesamiento + modelo)
  - `metadata.json` (versión, fecha, umbral, métricas y lista de columnas)
- `requirements.txt` con versiones fijas y `Dockerfile`.

## Reglas

- Solo las 30 columnas permitidas del diccionario de datos (Entrega 2). Nunca las columnas de fuga listadas en `AGENTS.md`.
- Partición 80/20 estratificada, `random_state = 42`.
- Meta: F1 ≥ 0.66 en la clase «en riesgo», por encima de la regla `satisfaction_score <= 2`.

Ejecutar: `docker compose --profile training run --rm training`
