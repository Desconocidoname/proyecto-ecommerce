"""Gráficas de evaluación del modelo (rúbrica, criterio 3: matrices y curvas).

Genera en la carpeta de modelos:
    curva_roc.png                    Curva ROC: Random Forest vs. baseline
    curva_precision_recall.png       Curva precisión-recall con el umbral elegido
                                     y la regla manual como referencia
    distribucion_probabilidades.png  Probabilidades según la respuesta real
    importancia_variables.png        Las 10 variables con más peso en el modelo

train.py la llama al final del entrenamiento. También se puede ejecutar sola
con los modelos ya guardados, sin reentrenar:
    python graficas.py --data data/processed --models ml/models
"""
import argparse
import json
import sys
from pathlib import Path

import joblib
import matplotlib
import numpy as np
import pandas as pd
from sklearn.metrics import (average_precision_score, precision_recall_curve,
                             precision_score, recall_score, roc_auc_score, roc_curve)

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from columnas import FEATURES, OBJETIVO  # noqa: E402

AZUL_OSCURO, AZUL, AZUL_CLARO, GRIS, CORAL = "#13294b", "#1d6fb5", "#93c8ef", "#8a94a6", "#c2412d"

NOMBRES = {
    "satisfaction_score": "Satisfacción", "return_count": "Devoluciones", "complaint_count": "Quejas",
    "total_purchases": "Compras totales", "total_spent_usd": "Gasto total", "avg_order_value_usd": "Valor por pedido",
    "tenure_months": "Antigüedad", "email_open_rate": "Apertura de correos", "click_through_rate": "Tasa de clics",
    "conversion_rate": "Conversión", "customer_lifetime_value_usd": "Valor del cliente (CLV)",
    "customer_acquisition_cost_usd": "Costo de adquisición", "customer_profitability_usd": "Rentabilidad",
    "monetary_score": "Puntaje monetario", "age": "Edad", "loyalty_tier": "Nivel de lealtad",
    "engagement_level": "Engagement", "customer_segment": "Segmento", "country": "País",
    "preferred_category_1": "Categoría 1", "preferred_category_2": "Categoría 2", "preferred_category_3": "Categoría 3",
    "payment_method": "Método de pago", "shopping_channel": "Canal de compra", "device_used": "Dispositivo",
    "income_bracket": "Ingresos", "education_level": "Escolaridad", "employment_type": "Empleo",
    "marital_status": "Estado civil", "gender": "Género",
}


def _estilo(ax, titulo):
    ax.set_title(titulo, fontsize=11.5, fontweight="bold", color=AZUL_OSCURO, loc="left", pad=12)
    for lado in ("top", "right"):
        ax.spines[lado].set_visible(False)
    ax.spines["left"].set_color("#c9d3e3")
    ax.spines["bottom"].set_color("#c9d3e3")
    ax.tick_params(colors="#3b4660", labelsize=9)
    ax.grid(alpha=0.25, linestyle="--")


def _guardar(fig, ruta):
    fig.tight_layout()
    fig.savefig(ruta, dpi=180)
    plt.close(fig)


def generar_graficas(modelo, X_test, y_test, umbral, importancia, salida, baseline=None):
    """Crea las 4 gráficas y devuelve la lista de archivos generados."""
    salida = Path(salida)
    y = np.asarray(y_test)
    prob = modelo.predict_proba(X_test)[:, 1]
    prob_base = baseline.predict_proba(X_test)[:, 1] if baseline is not None else None
    regla = (X_test["satisfaction_score"].astype(float) <= 2).astype(int)
    archivos = []

    # 1. Curva ROC
    fig, ax = plt.subplots(figsize=(6.2, 4.8))
    fpr, tpr, _ = roc_curve(y, prob)
    ax.plot(fpr, tpr, color=AZUL, lw=2.4, label=f"Random Forest (AUC {roc_auc_score(y, prob):.3f})")
    if prob_base is not None:
        f2, t2, _ = roc_curve(y, prob_base)
        ax.plot(f2, t2, color=AZUL_CLARO, lw=1.8, label=f"Regresión logística (AUC {roc_auc_score(y, prob_base):.3f})")
    ax.plot([0, 1], [0, 1], color=GRIS, lw=1.2, linestyle=":", label="Azar (AUC 0.500)")
    ax.set_xlabel("Tasa de falsas alarmas (clientes sin riesgo marcados en riesgo)")
    ax.set_ylabel("Recall (clientes en riesgo detectados)")
    ax.legend(loc="lower right", fontsize=8.5, frameon=False)
    _estilo(ax, "Curva ROC en el conjunto de prueba")
    _guardar(fig, salida / "curva_roc.png")
    archivos.append("curva_roc.png")

    # 2. Curva precisión-recall
    fig, ax = plt.subplots(figsize=(6.2, 4.8))
    precision, recall, umbrales = precision_recall_curve(y, prob)
    ax.plot(recall, precision, color=AZUL, lw=2.4, label=f"Random Forest (PR-AUC {average_precision_score(y, prob):.3f})")
    if prob_base is not None:
        p2, r2, _ = precision_recall_curve(y, prob_base)
        ax.plot(r2, p2, color=AZUL_CLARO, lw=1.8, label=f"Regresión logística (PR-AUC {average_precision_score(y, prob_base):.3f})")
    ax.axhline(y.mean(), color=GRIS, lw=1.2, linestyle=":", label=f"Azar ({y.mean():.1%} en riesgo)")
    pred = (prob >= umbral).astype(int)
    ax.scatter([recall_score(y, pred)], [precision_score(y, pred)], s=70, color=AZUL_OSCURO, zorder=5,
               label=f"Umbral elegido {umbral:.2f}")
    ax.scatter([recall_score(y, regla)], [precision_score(y, regla)], s=70, marker="X", color=CORAL, zorder=5,
               label="Regla manual (satisfacción ≤ 2)")
    ax.set_xlabel("Recall (clientes en riesgo detectados)")
    ax.set_ylabel("Precisión (aciertos entre las alertas)")
    ax.set_ylim(0, 1.05)
    ax.legend(loc="upper right", fontsize=8.5, frameon=False)
    _estilo(ax, "Curva precisión-recall en el conjunto de prueba")
    _guardar(fig, salida / "curva_precision_recall.png")
    archivos.append("curva_precision_recall.png")

    # 3. Distribución de probabilidades por clase real
    fig, ax = plt.subplots(figsize=(6.2, 4.4))
    bins = np.linspace(0, 1, 41)
    ax.hist(prob[y == 0], bins=bins, color=AZUL_CLARO, alpha=0.9, label="Sin riesgo real")
    ax.hist(prob[y == 1], bins=bins, color=AZUL, alpha=0.85, label="En riesgo real")
    ax.axvline(umbral, color=AZUL_OSCURO, lw=2, linestyle="--", label=f"Umbral {umbral:.2f}")
    ax.set_xlabel("Probabilidad de abandono estimada por el modelo")
    ax.set_ylabel("Clientes")
    ax.legend(fontsize=8.5, frameon=False)
    _estilo(ax, "¿Separa el modelo a los clientes en riesgo?")
    _guardar(fig, salida / "distribucion_probabilidades.png")
    archivos.append("distribucion_probabilidades.png")

    # 4. Importancia de variables
    if importancia:
        pares = sorted(importancia.items(), key=lambda kv: kv[1])
        fig, ax = plt.subplots(figsize=(6.2, 4.6))
        etiquetas = [NOMBRES.get(k, k) for k, _ in pares]
        valores = [v * 100 for _, v in pares]
        colores = [AZUL if i >= len(pares) - 3 else AZUL_CLARO for i in range(len(pares))]
        ax.barh(etiquetas, valores, color=colores, height=0.62)
        for i, v in enumerate(valores):
            ax.text(v + 0.4, i, f"{v:.1f} %", va="center", fontsize=8.5, color="#3b4660")
        ax.set_xlabel("Importancia en el modelo (%)")
        ax.grid(axis="y", visible=False)
        _estilo(ax, "Variables con más peso en la predicción")
        _guardar(fig, salida / "importancia_variables.png")
        archivos.append("importancia_variables.png")

    return archivos


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", default="data/processed", help="Carpeta con test.csv")
    parser.add_argument("--models", default="ml/models", help="Carpeta con los modelos y metadata.json")
    args = parser.parse_args()

    modelos = Path(args.models)
    test = pd.read_csv(Path(args.data) / "test.csv", keep_default_na=False)
    meta = json.loads((modelos / "metadata.json").read_text())
    modelo = joblib.load(modelos / "modelo_candidato_rf.joblib")
    ruta_base = modelos / "modelo_baseline_lr.joblib"
    baseline = joblib.load(ruta_base) if ruta_base.exists() else None

    archivos = generar_graficas(modelo, test[FEATURES], test[OBJETIVO], float(meta["umbral"]),
                                meta.get("importancia_variables", {}), modelos, baseline)
    for archivo in archivos:
        print(f"[SUCCESS] Gráfica guardada en: {modelos / archivo}")


if __name__ == "__main__":
    main()
