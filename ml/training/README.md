# ml/training

Preparación de datos, entrenamiento y experimentación del modelo.

**Responsable:** Juan Daniel Ladino Hernández · **Respaldo:** Ángel De Anda Gómez

## Reproducir todo con un solo comando (desde la raíz del repositorio)

```bash
python ml/training/preparar_datos.py --csv data/raw/customers.csv && python ml/training/train.py --data data/processed --output ml/models
```

## Cómo fluyen los datos

```
data/raw/customers.csv ─► preparar_datos.py ─► data/processed/train.csv (40,000) ─► train.py ─► ml/models/
   (o PostgreSQL:                              data/processed/test.csv  (10,000)
    v_entrenamiento)
```

## Archivos

| Archivo | Qué hace |
|---|---|
| `columnas.py` | Lista única de las 30 columnas de entrada, la variable objetivo, las columnas de fuga, el umbral (40) y la semilla (42). |
| `preparar_datos.py` | Lee el CSV (o la vista `v_entrenamiento`), valida que no haya fuga ni nulos y divide 80/20 estratificado. |
| `train.py` | Entrena y compara Regresión Logística (baseline) y Random Forest (3 configuraciones), elige el ganador con una validación interna y guarda los resultados. |
| `requirements.txt` | Librerías con versiones fijas. |

## Qué genera `train.py` en `ml/models/`

| Archivo | Contenido |
|---|---|
| `modelo_candidato_rf.joblib` | Modelo ganador: preprocesamiento + Random Forest. |
| `modelo_baseline_lr.joblib` | Modelo baseline: preprocesamiento + Regresión Logística. |
| `preprocesador.joblib` | StandardScaler + OneHotEncoder ajustados. |
| `metadata.json` | Versión, umbral, métricas, columnas e importancia de variables. |
| `experimentos.csv` | Matriz de experimentación. |
| `matriz_confusion.png` | Matriz de confusión en el conjunto de prueba. |

## Reglas

- Al leer `train.csv` o `test.csv` con pandas usa `keep_default_na=False`, para conservar el texto `None` como categoría.
- Solo las 30 columnas de `columnas.py`. Nunca las de `FUGA`.
- El conjunto de prueba no se usa para decidir nada: los experimentos se comparan con una validación interna.
- Metas (Entrega 2): F1 ≥ 0.66, recall ≥ 0.70 y precisión ≥ 0.60 en la clase «en riesgo».
