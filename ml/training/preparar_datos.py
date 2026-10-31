"""Prepara los datos de entrenamiento y prueba.

Lee los clientes desde la vista v_entrenamiento de PostgreSQL (o desde el
CSV original con --csv), valida que no haya fuga de datos ni nulos, divide
80/20 estratificado con semilla 42 y guarda:

    data/processed/train.csv   (40,000 clientes)
    data/processed/test.csv    (10,000 clientes)
    data/processed/resumen.json

Uso:
    python preparar_datos.py                          # desde PostgreSQL (DATABASE_URL)
    python preparar_datos.py --csv data/raw/customers.csv
"""
import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

from columnas import (CATEGORICAS, FEATURES, FUGA, ID, NUMERICAS, OBJETIVO,
                      PROPORCION_PRUEBA, SEMILLA, UMBRAL_RIESGO)


def desde_postgres() -> pd.DataFrame:
    from sqlalchemy import create_engine
    url = os.environ["DATABASE_URL"]
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    engine = create_engine(url)
    columnas = ", ".join([ID] + FEATURES + [OBJETIVO])
    return pd.read_sql(f"SELECT {columnas} FROM v_entrenamiento", engine)


def desde_csv(ruta: str) -> pd.DataFrame:
    # keep_default_na=False: el texto "None" del CSV se conserva como categoría.
    crudo = pd.read_csv(ruta, keep_default_na=False)
    datos = crudo[[ID] + FEATURES].copy()
    datos[OBJETIVO] = (crudo["churn_risk_score"] >= UMBRAL_RIESGO).astype(int)
    return datos


def validar(datos: pd.DataFrame) -> None:
    columnas = set(datos.columns)
    fuga = columnas.intersection(FUGA)
    assert not fuga, f"Columnas de fuga en los datos: {sorted(fuga)}"
    faltan = set(FEATURES + [OBJETIVO]) - columnas
    assert not faltan, f"Faltan columnas: {sorted(faltan)}"
    assert len(FEATURES) == 30, "Deben ser exactamente 30 columnas de entrada"
    assert datos[ID].is_unique, "Hay customer_id repetidos"
    nulos = datos[FEATURES + [OBJETIVO]].isna().sum()
    assert nulos.sum() == 0, f"Hay valores nulos:\n{nulos[nulos > 0]}"
    for col in NUMERICAS:
        datos[col] = pd.to_numeric(datos[col])
    for col in CATEGORICAS:
        datos[col] = datos[col].astype(str)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", help="Leer desde el CSV en lugar de PostgreSQL")
    parser.add_argument("--salida", default="data/processed")
    args = parser.parse_args()

    datos = desde_csv(args.csv) if args.csv else desde_postgres()
    validar(datos)

    train, test = train_test_split(
        datos, test_size=PROPORCION_PRUEBA, stratify=datos[OBJETIVO],
        random_state=SEMILLA,
    )

    salida = Path(args.salida)
    salida.mkdir(parents=True, exist_ok=True)
    train.to_csv(salida / "train.csv", index=False)
    test.to_csv(salida / "test.csv", index=False)

    resumen = {
        "generado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "origen": args.csv or "postgres:v_entrenamiento",
        "clientes_total": len(datos),
        "clientes_train": len(train),
        "clientes_test": len(test),
        "proporcion_riesgo_train": round(float(train[OBJETIVO].mean()), 4),
        "proporcion_riesgo_test": round(float(test[OBJETIVO].mean()), 4),
        "semilla": SEMILLA,
        "features": FEATURES,
    }
    (salida / "resumen.json").write_text(json.dumps(resumen, indent=2, ensure_ascii=False))

    print(f"Clientes: {len(datos):,} | train: {len(train):,} | test: {len(test):,}")
    print(f"En riesgo: {resumen['proporcion_riesgo_train']:.1%} (train) "
          f"y {resumen['proporcion_riesgo_test']:.1%} (test)")
    print(f"Archivos guardados en {salida}/")


if __name__ == "__main__":
    main()
