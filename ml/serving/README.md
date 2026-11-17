# ml/serving

Motor de inferencia. Expone la función `predecir()`, que es el contrato entre la IA y el dashboard.

**Responsable:** Ángel De Anda Gómez · **Respaldo:** Juan Daniel Ladino Hernández

## Archivos

| Archivo | Qué hace |
|---|---|
| `modelo.py` | `predecir(entrada: dict) -> dict`. Carga una sola vez `modelo_candidato_rf.joblib` y `metadata.json`, valida la entrada (30 campos y rangos), predice y devuelve la salida del contrato. |
| `demo_predecir.py` | Demostración con un cliente real: caso válido, caso modificado y caso inválido. |
| `main.py` | *(Entrega 4)* Servicio FastAPI con `POST /predict`. |

## Uso

```bash
python ml/serving/demo_predecir.py     # demostración
pytest tests/                          # 5 pruebas automáticas
```

## Reglas

- La carpeta de modelos se toma de la variable `MODEL_DIR`; si no existe, se usa `ml/models/`. No hay rutas absolutas.
- Si la entrada no es válida, `predecir()` devuelve `{"status": "error", "campo": ..., "rango": ...}` y no se detiene.
- No se entrena aquí: los modelos los genera `ml/training/train.py`.
