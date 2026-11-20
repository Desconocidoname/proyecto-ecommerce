# ml/serving

Servicio de IA en **FastAPI**. Carga el modelo entrenado y responde predicciones. Solo lo consume el backend, dentro de la red de Docker (`http://ml-service:8000`); no se publica hacia afuera.

**Responsable:** Ángel De Anda Gómez · **Respaldo:** Juan Daniel Ladino Hernández

## Archivos

| Archivo | Qué hace |
|---|---|
| `modelo.py` | `predecir(entrada)` para un cliente y `predecir_lote(clientes)` para muchos. Carga una sola vez `modelo_candidato_rf.joblib` y `metadata.json`, valida la entrada (30 campos, tipos y rangos) y devuelve la salida del contrato. |
| `main.py` | Servicio FastAPI con las rutas de abajo. |
| `demo_predecir.py` | Demostración sin servidor: caso válido, caso modificado y caso inválido. |
| `requirements.txt` | Mismas versiones de numpy, pandas, scikit-learn y joblib que `ml/training`. |
| `Dockerfile` | Imagen `python:3.12-slim` con usuario sin privilegios. |

## Rutas

| Ruta | Para qué | Respuesta |
|---|---|---|
| `GET /health` | ¿Está vivo y tiene modelo? | `{"status": "ok", "modelLoaded": true, "modelVersion": "v1", "versionesCompatibles": true, ...}` |
| `GET /model/info` | Versión, umbral, métricas e importancia de variables (Gráfica 5) | `{"version": "v1", "umbral": 0.5, "metricas": {...}, "importancia_variables": {...}}` |
| `POST /predict` | Un cliente (Simulador) | Contrato de `predecir()`; **422** con `campo` y `rango` si la entrada no es válida (RNF-02) |
| `POST /predict/lote` | Hasta 5,000 clientes (predicción masiva) | `{"predicciones": [...], "errores": [...], "modelo_version": "v1"}` |

Documentación interactiva generada por FastAPI: `/docs`.

## Cómo se prueba

```bash
docker compose up -d --build ml-service
docker compose exec ml-service python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/health').read().decode())"
pytest tests/          # pruebas de predecir() y predecir_lote() (necesita el entorno de Python)
```

## Reglas

- El modelo llega por el volumen `./ml/models:/models` (solo lectura). No se copia dentro de la imagen: reentrenar no obliga a reconstruirla, solo a reiniciar (`docker compose restart ml-service`).
- Un modelo se abre con la **misma versión de scikit-learn** con la que se guardó. `GET /health` avisa con `"versionesCompatibles": false` si no coinciden; la solución es reentrenar con el contenedor `training`.
- Si la entrada no es válida, se responde 422 con el campo y el rango. El servicio nunca se detiene por una entrada mala.
- No se entrena aquí: los modelos los genera `ml/training`.
