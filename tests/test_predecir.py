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


def test_lote_predice_varios_y_reporta_errores():
    from modelo import predecir_lote
    bueno = {**ENTRADA, "customer_id": "CUST-013446"}
    malo = {**ENTRADA, "customer_id": "CUST-000001", "satisfaction_score": 9}
    r = predecir_lote([bueno, malo])
    assert r["status"] == "success"
    assert len(r["predicciones"]) == 1 and r["predicciones"][0]["customer_id"] == "CUST-013446"
    assert r["errores"][0]["campo"] == "satisfaction_score"


def test_lote_da_lo_mismo_que_uno_por_uno():
    from modelo import predecir, predecir_lote
    uno = predecir(ENTRADA)["probabilidad_riesgo"]
    lote = predecir_lote([{**ENTRADA, "customer_id": "X"}])["predicciones"][0]["probabilidad_riesgo"]
    assert round(lote, 3) == uno
