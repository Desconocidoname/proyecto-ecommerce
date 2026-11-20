#!/bin/sh
# Pasos del job de entrenamiento dentro del contenedor:
#   1. Lee los clientes de PostgreSQL (vista v_entrenamiento) y divide 80/20.
#   2. Entrena, compara y guarda los modelos en MODEL_DIR (/models).
set -e

DATOS=/app/data/processed
MODELOS="${MODEL_DIR:-/models}"

echo "[INFO] Paso 1/2: preparando datos desde PostgreSQL"
python preparar_datos.py --salida "$DATOS"

echo "[INFO] Paso 2/2: entrenando modelos"
python train.py --data "$DATOS" --output "$MODELOS"

echo "[SUCCESS] Entrenamiento terminado. Modelos en $MODELOS"
