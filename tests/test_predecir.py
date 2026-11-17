"""Pruebas de la función predecir(). Ejecutar con:  pytest tests/"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ml" / "serving"))
from demo_predecir import ENTRADA  # noqa: E402
from modelo import predecir  # noqa: E402


def test_salida_cumple_el_contrato():
    r = predecir(ENTRADA)
    assert r["status"] == "success"
    assert r["prediccion"] in (0, 1)
    assert 0 <= r["probabilidad_riesgo"] <= 1
    assert r["clase_etiqueta"] in ("Riesgo alto", "Riesgo medio", "Riesgo bajo")
    assert {"umbral", "modelo_version", "tiempo_ms", "confianza_o_score"} <= r.keys()


def test_cliente_insatisfecho_tiene_mas_riesgo_que_uno_satisfecho():
    insatisfecho = predecir({**ENTRADA, "satisfaction_score": 1})
    satisfecho = predecir({**ENTRADA, "satisfaction_score": 5, "complaint_count": 0, "return_count": 0})
    assert insatisfecho["probabilidad_riesgo"] > satisfecho["probabilidad_riesgo"]


def test_valor_fuera_de_rango_devuelve_error_sin_romper():
    r = predecir({**ENTRADA, "satisfaction_score": 7})
    assert r["status"] == "error" and r["campo"] == "satisfaction_score" and r["rango"] == "1-5"


def test_campo_faltante_devuelve_error():
    incompleta = {k: v for k, v in ENTRADA.items() if k != "age"}
    r = predecir(incompleta)
    assert r["status"] == "error" and r["campo"] == "age"


def test_inferencia_tarda_menos_de_3_segundos():
    predecir(ENTRADA)                      # carga del modelo
    assert predecir(ENTRADA)["tiempo_ms"] < 3000   # RNF-01
