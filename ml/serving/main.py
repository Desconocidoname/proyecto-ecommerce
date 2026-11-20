"""Servicio de IA (FastAPI). Solo lo consume el backend, dentro de la red de Docker.

Rutas:
    GET  /health         estado del servicio y del modelo
    GET  /model/info     versión, umbral, métricas e importancia de variables
    POST /predict        un cliente (Simulador)            -> contrato de predecir()
    POST /predict/lote   hasta 5,000 clientes (predicción masiva) -> predecir_lote()

Documentación interactiva: http://ml-service:8000/docs (dentro de la red).
"""
import logging
from typing import Any

import sklearn
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from modelo import MODEL_DIR, info_modelo, predecir, predecir_lote

MAXIMO_LOTE = 5_000

log = logging.getLogger("ml-service")
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")

app = FastAPI(title="Retención · Servicio de IA", version="1.0.0")


class Lote(BaseModel):
    clientes: list[dict[str, Any]] = Field(..., description="Cada cliente con customer_id y las 30 variables")


def _estado_modelo() -> dict:
    """Intenta cargar el modelo y compara la versión de scikit-learn."""
    try:
        meta = info_modelo()
    except FileNotFoundError:
        return {"modelLoaded": False, "error": f"No hay modelo en {MODEL_DIR}"}
    except Exception as exc:  # p. ej. el modelo se guardó con otra versión de scikit-learn
        return {"modelLoaded": False, "error": f"No se pudo abrir el modelo: {exc}"}
    entrenado_con = meta.get("scikit_learn")
    return {
        "modelLoaded": True,
        "modelVersion": meta["version"],
        "sklearnModelo": entrenado_con,
        "sklearnServicio": sklearn.__version__,
        "versionesCompatibles": entrenado_con == sklearn.__version__,
    }


@app.on_event("startup")
def al_iniciar() -> None:
    estado = _estado_modelo()
    if not estado["modelLoaded"]:
        log.error(estado["error"])
    elif not estado["versionesCompatibles"]:
        log.warning("El modelo se entrenó con scikit-learn %s y el servicio usa %s. "
                    "Reentrena con: docker compose run --rm training",
                    estado["sklearnModelo"], estado["sklearnServicio"])
    else:
        log.info("Modelo %s cargado desde %s", estado["modelVersion"], MODEL_DIR)


@app.get("/health")
def health() -> dict:
    estado = _estado_modelo()
    return {"status": "ok" if estado["modelLoaded"] else "sin_modelo", **estado}


@app.get("/model/info")
def model_info() -> dict:
    estado = _estado_modelo()
    if not estado["modelLoaded"]:
        raise HTTPException(status_code=503, detail=estado["error"])
    meta = info_modelo()
    return {
        "version": meta["version"],
        "entrenado": meta.get("entrenado"),
        "modelo": meta.get("modelo"),
        "hiperparametros": meta.get("hiperparametros"),
        "umbral": meta["umbral"],
        "metricas": meta.get("metricas_test", {}),
        "importancia_variables": meta.get("importancia_variables", {}),
        "features": meta["features"],
        "scikit_learn": meta.get("scikit_learn"),
    }


@app.post("/predict")
def predict(cliente: dict[str, Any]):
    """Un cliente. Respuesta 200 con el contrato de predecir(), o 422 si la entrada no es válida."""
    resultado = predecir(cliente)
    if resultado["status"] == "error":
        codigo = 503 if resultado.get("campo") is None and "modelo" in resultado["error"] else 422
        return JSONResponse(status_code=codigo, content=resultado)
    return resultado


@app.post("/predict/lote")
def predict_lote(lote: Lote):
    if not lote.clientes:
        raise HTTPException(status_code=422, detail="La lista de clientes está vacía")
    if len(lote.clientes) > MAXIMO_LOTE:
        raise HTTPException(status_code=413, detail=f"Máximo {MAXIMO_LOTE} clientes por petición")
    try:
        return predecir_lote(lote.clientes)
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail=f"No hay modelo en {MODEL_DIR}")
