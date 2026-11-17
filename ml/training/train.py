"""Entrena, compara y guarda los modelos del proyecto Retención.

Estrategia comparativa (Entrega 3):
  - Baseline:  Regresión Logística
  - Candidato: Random Forest (configuración por defecto, regularizada y ajustada)

Metodología:
  1. Lee data/processed/train.csv y test.csv (generados por preparar_datos.py).
  2. Separa una validación interna (20 % de train) para comparar experimentos
     y elegir el umbral. El conjunto de prueba NO se usa para decidir nada.
  3. Reentrena cada experimento con todo train y reporta métricas en test.
  4. Guarda el modelo ganador, el baseline, el preprocesador y los reportes.

Uso (desde la raíz del repositorio):
    python ml/training/train.py --data data/processed --output ml/models
"""
import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (classification_report, confusion_matrix, f1_score,
                             precision_recall_curve, precision_score,
                             recall_score, roc_auc_score, average_precision_score)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parent))
from columnas import CATEGORICAS, FEATURES, ID, NUMERICAS, OBJETIVO, SEMILLA  # noqa: E402

VERSION = "v1"
RECALL_MINIMO = 0.70      # compromiso de la Entrega 2
F1_OBJETIVO = 0.66        # objetivo mínimo de la Entrega 2
F1_REGLA_MANUAL = 0.626   # baseline ingenuo: satisfaction_score <= 2


def log(nivel: str, mensaje: str) -> None:
    print(f"[{nivel}] {mensaje}", flush=True)


def preprocesador() -> ColumnTransformer:
    return ColumnTransformer([
        ("num", StandardScaler(), NUMERICAS),
        ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAS),
    ])


def experimentos() -> list[dict]:
    """Configuraciones evaluadas. Todas usan el mismo preprocesamiento."""
    return [
        {
            "id": "Exp 1: Baseline",
            "modelo": "Regresión Logística",
            "hiper": "C=1.0, penalización L2, class_weight='balanced'",
            "estimador": LogisticRegression(C=1.0, max_iter=3000, class_weight="balanced",
                                            random_state=SEMILLA),
        },
        {
            "id": "Exp 2: RF por defecto",
            "modelo": "Random Forest",
            "hiper": "n_estimators=100, max_depth=None, min_samples_leaf=1",
            "estimador": RandomForestClassifier(n_estimators=100, n_jobs=-1, random_state=SEMILLA),
        },
        {
            "id": "Exp 3: RF regularizado",
            "modelo": "Random Forest",
            "hiper": "n_estimators=300, min_samples_leaf=5, class_weight='balanced'",
            "estimador": RandomForestClassifier(n_estimators=300, min_samples_leaf=5,
                                                class_weight="balanced", n_jobs=-1,
                                                random_state=SEMILLA),
        },
        {
            "id": "Exp 4: RF ajustado",
            "modelo": "Random Forest",
            "hiper": "n_estimators=300, max_depth=12, min_samples_leaf=20, class_weight='balanced'",
            "estimador": RandomForestClassifier(n_estimators=300, max_depth=12, min_samples_leaf=20,
                                                class_weight="balanced", n_jobs=-1,
                                                random_state=SEMILLA),
        },
    ]


def metricas(y, prob, umbral: float) -> dict:
    pred = (prob >= umbral).astype(int)
    return {
        "f1": f1_score(y, pred),
        "precision": precision_score(y, pred, zero_division=0),
        "recall": recall_score(y, pred),
    }


def elegir_umbral(y, prob) -> float:
    """Umbral con mejor F1 entre los que cumplen recall >= RECALL_MINIMO."""
    precision, recall, umbrales = precision_recall_curve(y, prob)
    precision, recall = precision[:-1], recall[:-1]
    f1 = 2 * precision * recall / (precision + recall + 1e-12)
    validos = recall >= RECALL_MINIMO
    if not validos.any():
        return 0.5
    return float(round(umbrales[np.argmax(np.where(validos, f1, -1))], 2))


def diagnostico(f1_train: float, f1_test: float) -> str:
    brecha = f1_train - f1_test
    if brecha > 0.15:
        return f"Overfitting (F1 {f1_train:.2f} en train, {f1_test:.2f} en test)"
    if f1_test <= F1_REGLA_MANUAL:
        return f"Underfitting (no supera la regla manual, F1 {F1_REGLA_MANUAL})"
    return f"Óptimo (F1 {f1_train:.2f} en train, {f1_test:.2f} en test)"


def guardar_matriz(y, pred, ruta: Path, titulo: str) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    cm = confusion_matrix(y, pred)
    fig, ax = plt.subplots(figsize=(5.6, 4.6))
    ax.imshow(cm, cmap="Blues")
    etiquetas = ["Sin riesgo (0)", "En riesgo (1)"]
    ax.set_xticks([0, 1], etiquetas)
    ax.set_yticks([0, 1], etiquetas, rotation=90, va="center")
    ax.set_xlabel("Predicción del modelo")
    ax.set_ylabel("Valor real")
    ax.set_title(titulo, fontsize=11, fontweight="bold")
    total = cm.sum()
    for i in range(2):
        for j in range(2):
            color = "white" if cm[i, j] > cm.max() / 2 else "#1F3A5F"
            ax.text(j, i, f"{cm[i, j]:,}\n({cm[i, j] / total:.1%})", ha="center", va="center",
                    color=color, fontsize=12, fontweight="bold")
    fig.tight_layout()
    fig.savefig(ruta, dpi=180)
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", default="data/processed", help="Carpeta con train.csv y test.csv")
    parser.add_argument("--output", default="ml/models", help="Carpeta donde se guardan los modelos")
    args = parser.parse_args()
    datos, salida = Path(args.data), Path(args.output)
    salida.mkdir(parents=True, exist_ok=True)

    # ---------- 1. Carga ----------
    # keep_default_na=False conserva el texto "None" como categoría (no como nulo).
    train = pd.read_csv(datos / "train.csv", keep_default_na=False)
    test = pd.read_csv(datos / "test.csv", keep_default_na=False)
    log("INFO", f"Cargando datos: {datos}/train.csv y {datos}/test.csv")
    log("INFO", f"Conjunto Train: {len(train):,} clientes | Conjunto Test: {len(test):,} clientes")
    log("INFO", f"Variables de entrada: {len(FEATURES)} ({len(NUMERICAS)} numéricas, {len(CATEGORICAS)} categóricas)")
    log("INFO", f"Clientes en riesgo: {train[OBJETIVO].mean():.1%} en train, {test[OBJETIVO].mean():.1%} en test")

    X_train, y_train = train[FEATURES], train[OBJETIVO]
    X_test, y_test = test[FEATURES], test[OBJETIVO]

    # Validación interna: se usa para comparar y elegir umbral, nunca el test.
    X_sub, X_val, y_sub, y_val = train_test_split(
        X_train, y_train, test_size=0.20, stratify=y_train, random_state=SEMILLA)
    log("INFO", f"Validación interna: {len(X_sub):,} para ajustar y {len(X_val):,} para comparar")

    # ---------- 2. Experimentos ----------
    filas, pipelines = [], {}
    for exp in experimentos():
        log("INFO", f"Entrenando {exp['id']} · {exp['modelo']} ({exp['hiper']})...")
        # a) F1 de validación (para elegir ganador sin tocar el test)
        pipe_val = Pipeline([("pre", preprocesador()), ("modelo", clone(exp["estimador"]))])
        pipe_val.fit(X_sub, y_sub)
        f1_val = f1_score(y_val, (pipe_val.predict_proba(X_val)[:, 1] >= 0.5).astype(int))

        # b) Entrenamiento final con todo train
        pipe = Pipeline([("pre", preprocesador()), ("modelo", clone(exp["estimador"]))])
        inicio = time.perf_counter()
        pipe.fit(X_train, y_train)
        t_entrena = time.perf_counter() - inicio

        prob_train = pipe.predict_proba(X_train)[:, 1]
        inicio = time.perf_counter()
        prob_test = pipe.predict_proba(X_test)[:, 1]
        t_infer = (time.perf_counter() - inicio) / len(X_test) * 1000  # ms por cliente

        m_train, m_test = metricas(y_train, prob_train, 0.5), metricas(y_test, prob_test, 0.5)
        fila = {
            "experimento": exp["id"], "modelo": exp["modelo"], "hiperparametros": exp["hiper"],
            "umbral": 0.5, "f1_validacion": round(f1_val, 3),
            "f1_train": round(m_train["f1"], 3), "f1_test": round(m_test["f1"], 3),
            "precision_test": round(m_test["precision"], 3), "recall_test": round(m_test["recall"], 3),
            "roc_auc_test": round(roc_auc_score(y_test, prob_test), 3),
            "pr_auc_test": round(average_precision_score(y_test, prob_test), 3),
            "entrenamiento_s": round(t_entrena, 2), "inferencia_ms_por_cliente": round(t_infer, 4),
            "diagnostico": diagnostico(m_train["f1"], m_test["f1"]),
        }
        filas.append(fila)
        pipelines[exp["id"]] = (pipe, pipe_val)
        log("INFO", f"  Entrenado en {t_entrena:.2f} s | F1 validación {f1_val:.3f} | "
                    f"F1 test {m_test['f1']:.3f} (precisión {m_test['precision']:.3f}, recall {m_test['recall']:.3f})")
        log("INFO", f"  Diagnóstico: {fila['diagnostico']}")

    # ---------- 3. Ganador (por F1 de validación) y ajuste del umbral ----------
    candidatos = [f for f in filas if f["modelo"] == "Random Forest" and not f["diagnostico"].startswith("Overfitting")]
    ganador = max(candidatos or filas, key=lambda f: f["f1_validacion"])
    pipe_final, pipe_val = pipelines[ganador["experimento"]]
    umbral = elegir_umbral(y_val, pipe_val.predict_proba(X_val)[:, 1])
    log("INFO", f"Ganador por F1 de validación: {ganador['experimento']}")
    log("INFO", f"Umbral elegido en validación (recall >= {RECALL_MINIMO}): {umbral:.2f}")

    prob_train = pipe_final.predict_proba(X_train)[:, 1]
    prob_test = pipe_final.predict_proba(X_test)[:, 1]
    m_train, m_test = metricas(y_train, prob_train, umbral), metricas(y_test, prob_test, umbral)
    if umbral != 0.5:
        # El umbral ajustado cambia las métricas: se registra como experimento adicional.
        filas.append({
            **ganador, "experimento": "Exp 5: Ganador + umbral ajustado",
            "hiperparametros": ganador["hiperparametros"] + f", umbral={umbral:.2f}", "umbral": umbral,
            "f1_train": round(m_train["f1"], 3), "f1_test": round(m_test["f1"], 3),
            "precision_test": round(m_test["precision"], 3), "recall_test": round(m_test["recall"], 3),
            "diagnostico": "Modelo ganador · " + diagnostico(m_train["f1"], m_test["f1"]),
        })
    else:
        ganador["diagnostico"] = "Modelo ganador · " + ganador["diagnostico"]

    pred_test = (prob_test >= umbral).astype(int)
    print("\n[RESULTADOS EN TEST SET] Modelo ganador:", ganador["modelo"], f"(umbral {umbral:.2f})")
    print(classification_report(y_test, pred_test, target_names=["sin riesgo (0)", "en riesgo (1)"], digits=3))
    cm = confusion_matrix(y_test, pred_test)
    print("Matriz de confusión [filas = real, columnas = predicción]:")
    print(f"  Sin riesgo: {cm[0, 0]:>5,} correctos | {cm[0, 1]:>5,} falsas alarmas")
    print(f"  En riesgo:  {cm[1, 0]:>5,} no detectados | {cm[1, 1]:>5,} detectados\n")
    cumple = m_test["f1"] >= F1_OBJETIVO and m_test["recall"] >= RECALL_MINIMO
    log("INFO", f"Objetivo Entrega 2 (F1 >= {F1_OBJETIVO}, recall >= {RECALL_MINIMO}): "
                f"{'CUMPLIDO' if cumple else 'NO CUMPLIDO'} · F1 {m_test['f1']:.3f}, recall {m_test['recall']:.3f} "
                f"(regla manual: F1 {F1_REGLA_MANUAL})")

    # ---------- 4. Guardado ----------
    baseline_pipe = pipelines["Exp 1: Baseline"][0]
    joblib.dump(pipe_final, salida / "modelo_candidato_rf.joblib", compress=3)
    joblib.dump(baseline_pipe, salida / "modelo_baseline_lr.joblib", compress=3)
    joblib.dump(pipe_final.named_steps["pre"], salida / "preprocesador.joblib", compress=3)
    pd.DataFrame(filas).to_csv(salida / "experimentos.csv", index=False)
    guardar_matriz(y_test, pred_test, salida / "matriz_confusion.png",
                   f"Matriz de confusión en test · {ganador['modelo']} (umbral {umbral:.2f})")

    nombres = pipe_final.named_steps["pre"].get_feature_names_out()
    importancias = pipe_final.named_steps["modelo"].feature_importances_
    agrupada = {}
    for nombre, valor in zip(nombres, importancias):
        base = nombre.split("__", 1)[1]
        clave = next((c for c in CATEGORICAS if base.startswith(c + "_")), base)
        agrupada[clave] = agrupada.get(clave, 0.0) + float(valor)
    top = dict(sorted(agrupada.items(), key=lambda kv: -kv[1])[:10])

    metadata = {
        "version": VERSION,
        "entrenado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "modelo": ganador["modelo"], "hiperparametros": ganador["hiperparametros"],
        "umbral": umbral, "features": FEATURES,
        "metricas_test": {k: round(float(v), 3) for k, v in m_test.items()}
                         | {"roc_auc": ganador["roc_auc_test"], "pr_auc": ganador["pr_auc_test"]},
        "f1_train": round(float(m_train["f1"]), 3),
        "clientes_train": len(train), "clientes_test": len(test), "semilla": SEMILLA,
        "importancia_variables": {k: round(v, 4) for k, v in top.items()},
        "scikit_learn": sklearn.__version__,
    }
    (salida / "metadata.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False))

    for archivo, que in [("modelo_candidato_rf.joblib", "Modelo ganador (preprocesamiento + Random Forest)"),
                         ("modelo_baseline_lr.joblib", "Modelo baseline (Regresión Logística)"),
                         ("preprocesador.joblib", "Preprocesador (StandardScaler + OneHotEncoder)"),
                         ("metadata.json", "Metadatos (versión, umbral, métricas)"),
                         ("experimentos.csv", "Matriz de experimentación"),
                         ("matriz_confusion.png", "Matriz de confusión")]:
        log("SUCCESS", f"{que} guardado en: {salida / archivo}")


if __name__ == "__main__":
    main()
