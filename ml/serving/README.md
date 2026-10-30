# ml/serving

Servicio de IA en **FastAPI**. Carga el modelo entrenado y expone `predecir()`.

**Responsable:** Ángel De Anda Gómez · **Respaldo:** Juan Daniel Ladino Hernández

## Qué va aquí

- `modelo.py` con `predecir(datos_entrada: dict) -> dict` (contrato completo en la sección 5 de la Entrega 2).
- `main.py` con los endpoints `GET /health`, `GET /model/info` y `POST /predict` (acepta un cliente o una lista).
- `requirements.txt` con versiones fijas y `Dockerfile`.

## Reglas

- Valida que lleguen las 30 columnas y sus rangos; si algo falla, responde 422 con el campo y el rango válido.
- Si no hay modelo en `MODEL_DIR`, `/health` responde `modelLoaded: false` y `/predict` responde 503.
- Después de reentrenar: `docker compose restart ml-service`.
