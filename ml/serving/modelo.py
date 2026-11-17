"""Función de inferencia desacoplada: predecir(entrada) -> resultado.

Es el contrato entre el motor de IA y el dashboard (Entrega 2, sección 5).
No depende de la interfaz ni de la base de datos: solo de los archivos que
genera ml/training/train.py en la carpeta de modelos.

La carpeta de modelos se toma de la variable de entorno MODEL_DIR; si no
existe, se usa ml/models/ dentro del repositorio (ruta relativa a este archivo).
"""
import json
import os
import time
from pathlib import Path

import joblib
import pandas as pd

MODEL_DIR = Path(os.environ.get("MODEL_DIR", Path(__file__).resolve().parents[1] / "models"))

# Rangos válidos de las variables numéricas (diccionario de datos, Entrega 2)
RANGOS = {
    "age": (18, 120), "tenure_months": (0, 600), "total_purchases": (0, 10_000),
    "avg_order_value_usd": (0, 100_000), "total_spent_usd": (0, 10_000_000),
    "monetary_score": (1, 5), "return_count": (0, 1_000), "complaint_count": (0, 1_000),
    "satisfaction_score": (1, 5), "email_open_rate": (0, 1), "click_through_rate": (0, 1),
    "conversion_rate": (0, 1), "customer_lifetime_value_usd": (0, 10_000_000),
    "customer_acquisition_cost_usd": (0, 100_000),
    "customer_profitability_usd": (-10_000_000, 10_000_000),
}

_cache = {}


def _artefactos():
    """Carga el modelo y sus metadatos una sola vez y los deja en memoria."""
    if not _cache:
        _cache["modelo"] = joblib.load(MODEL_DIR / "modelo_candidato_rf.joblib")
        _cache["meta"] = json.loads((MODEL_DIR / "metadata.json").read_text())
    return _cache["modelo"], _cache["meta"]


def _error(mensaje: str, campo: str | None = None, rango: str | None = None) -> dict:
    return {"status": "error", "error": mensaje, "campo": campo, "rango": rango}


def _etiqueta(probabilidad: float, umbral: float) -> str:
    if probabilidad >= umbral:
        return "Riesgo alto"
    return "Riesgo medio" if probabilidad >= umbral * 0.6 else "Riesgo bajo"


def predecir(entrada: dict) -> dict:
    """Estima el riesgo de abandono de un cliente.

    Parámetros:
        entrada (dict): las 30 variables del cliente (nombres del diccionario
            de datos), tal como llegan del formulario del Simulador.

    Retorna:
        dict: predicción (0/1), probabilidad de riesgo, etiqueta, umbral,
        versión del modelo y tiempo de respuesta. Si la entrada no es válida,
        devuelve status "error" con el campo y el rango esperado.
    """
    inicio = time.perf_counter()
    try:
        modelo, meta = _artefactos()
    except FileNotFoundError:
        return _error(f"No hay modelo entrenado en {MODEL_DIR}. Ejecuta ml/training/train.py")

    if not isinstance(entrada, dict):
        return _error("La entrada debe ser un diccionario con las variables del cliente")

    # 1. Validación: campos completos, tipos y rangos
    for campo in meta["features"]:
        if campo not in entrada or entrada[campo] in (None, ""):
            return _error(f"Falta el campo {campo}", campo)
    limpio = {}
    for campo in meta["features"]:
        valor = entrada[campo]
        if campo in RANGOS:
            try:
                valor = float(valor)
            except (TypeError, ValueError):
                return _error(f"{campo} debe ser un número", campo)
            minimo, maximo = RANGOS[campo]
            if not minimo <= valor <= maximo:
                return _error(f"{campo} fuera de rango", campo, f"{minimo}-{maximo}")
        else:
            valor = str(valor)
        limpio[campo] = valor

    # 2. DataFrame con las columnas en el mismo orden que en el entrenamiento
    fila = pd.DataFrame([limpio], columns=meta["features"])

    # 3. El pipeline aplica el mismo preprocesamiento del entrenamiento y predice
    probabilidad = float(modelo.predict_proba(fila)[0, 1])
    umbral = float(meta["umbral"])
    prediccion = int(probabilidad >= umbral)

    # 4. Salida estructurada que consume el dashboard
    return {
        "status": "success",
        "prediccion": prediccion,
        "probabilidad_riesgo": round(probabilidad, 3),
        "clase_etiqueta": _etiqueta(probabilidad, umbral),
        "confianza_o_score": round(probabilidad if prediccion else 1 - probabilidad, 3),
        "umbral": umbral,
        "modelo_version": meta["version"],
        "tiempo_ms": round((time.perf_counter() - inicio) * 1000, 1),
    }
