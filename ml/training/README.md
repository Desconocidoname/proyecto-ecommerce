# ml/training

Preparación de datos, entrenamiento y experimentación del modelo.

**Responsable:** Juan Daniel Ladino Hernández · **Respaldo:** Ángel De Anda Gómez

## Entrenar con Docker (forma recomendada)

Desde la raíz del repositorio, con la base de datos encendida:

```bash
docker compose up -d db
docker compose run --rm --build --user "$(id -u):$(id -g)" training
```

El contenedor lee los clientes de PostgreSQL (vista `v_entrenamiento`), divide 80/20 y guarda los modelos en `ml/models/` de tu computadora. `--user` hace que los archivos generados sean tuyos y no del usuario `root`.

Después de reentrenar, reinicia el servicio de IA para que cargue el modelo nuevo: `docker compose restart ml-service`.

## Entrenar sin Docker (opcional)

```bash
python ml/training/preparar_datos.py --csv data/raw/customers.csv
python ml/training/train.py --data data/processed --output ml/models
```

Si entrenas sin Docker, tu versión local de scikit-learn debe ser la misma que la de `requirements.txt` (1.6.1); si no, el servicio de IA no podrá abrir el modelo.

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
| `graficas.py` | Curvas ROC y precisión-recall, distribución de probabilidades e importancia de variables. `train.py` la llama al final; también se puede ejecutar sola. |
| `requirements.txt` | Librerías con versiones fijas (las mismas que usa `ml/serving`). |
| `entrenar.sh` | Pasos que ejecuta el contenedor: preparar datos y entrenar. |
| `Dockerfile` | Imagen del job de entrenamiento (`python:3.12-slim`). |

## Qué genera `train.py` en `ml/models/`

| Archivo | Contenido |
|---|---|
| `modelo_candidato_rf.joblib` | Modelo ganador: preprocesamiento + Random Forest. |
| `modelo_baseline_lr.joblib` | Modelo baseline: preprocesamiento + Regresión Logística. |
| `preprocesador.joblib` | StandardScaler + OneHotEncoder ajustados. |
| `metadata.json` | Versión, umbral, métricas, columnas e importancia de variables. |
| `experimentos.csv` | Matriz de experimentación. |
| `matriz_confusion.png` | Matriz de confusión en el conjunto de prueba. |
| `curva_roc.png` | Curva ROC: Random Forest frente a la regresión logística y al azar. |
| `curva_precision_recall.png` | Curva precisión-recall con el umbral elegido y la regla manual como referencia. |
| `distribucion_probabilidades.png` | Probabilidades estimadas según la respuesta real, con el umbral marcado. |
| `importancia_variables.png` | Las 10 variables con más peso en el modelo. |

Para regenerar solo las gráficas, sin reentrenar:

```bash
docker compose run --rm --build --user "$(id -u):$(id -g)" training python graficas.py --data /app/data/processed --models /models
```

## Reglas

- Al leer `train.csv` o `test.csv` con pandas usa `keep_default_na=False`, para conservar el texto `None` como categoría.
- Solo las 30 columnas de `columnas.py`. Nunca las de `FUGA`.
- El conjunto de prueba no se usa para decidir nada: los experimentos se comparan con una validación interna.
- Metas (Entrega 2): F1 ≥ 0.66, recall ≥ 0.70 y precisión ≥ 0.60 en la clase «en riesgo».
