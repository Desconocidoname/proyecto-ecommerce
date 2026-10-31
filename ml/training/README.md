# ml/training

Preparación de datos, análisis exploratorio y entrenamiento del modelo.

**Responsable:** Juan Daniel Ladino Hernández · **Respaldo:** Ángel De Anda Gómez

## Cómo fluyen los datos

```
data/raw/customers.csv ──► PostgreSQL: customers ──► vista v_entrenamiento ──► preparar_datos.py
                                                    (30 columnas + riesgo)       │
                                                                                 ├─► data/processed/train.csv  (40,000)
                                                                                 ├─► data/processed/test.csv   (10,000)
                                                                                 └─► data/processed/resumen.json
```

## Archivos

| Archivo | Qué hace |
|---|---|
| `columnas.py` | **Lista única** de las 30 columnas de entrada, la variable objetivo, las columnas de fuga, el umbral (40) y la semilla (42). Todo el código importa de aquí. |
| `preparar_datos.py` | Lee `v_entrenamiento` (o el CSV con `--csv`), valida que no haya fuga ni nulos, divide 80/20 estratificado y guarda los archivos en `data/processed/`. |
| `train.py` | *(por hacer)* Entrena el Random Forest con `train.csv`, lo evalúa con `test.csv` y guarda `model.joblib` y `metadata.json` en `MODEL_DIR`. |
| `requirements.txt` | Librerías con versiones fijas. |

## Uso

```bash
# Con la base de datos de Docker funcionando (lee DATABASE_URL):
python ml/training/preparar_datos.py

# Sin base de datos, directo del CSV (útil para el análisis exploratorio):
python ml/training/preparar_datos.py --csv data/raw/customers.csv
```

Resultado esperado: 50,000 clientes, 40,000 de entrenamiento y 10,000 de prueba, con 25.9 % en riesgo en ambos.

## Reglas

- Al leer `train.csv` o `test.csv` con pandas usa **`keep_default_na=False`**. Si no, pandas convierte el texto `None` en un valor nulo.
- Solo las 30 columnas de `columnas.py`. Nunca las de `FUGA`.
- El conjunto de prueba (`test.csv`) **no se usa para ajustar el modelo**: solo para medir el resultado final.
- Meta: F1 ≥ 0.66 en la clase «en riesgo», por encima de la regla `satisfaction_score <= 2` (F1 = 0.626).
