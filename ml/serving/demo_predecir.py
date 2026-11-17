"""Demostración de la función predecir() con un cliente real del dataset.

Uso (desde la raíz del repositorio):
    python ml/serving/demo_predecir.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from modelo import predecir  # noqa: E402

# Cliente real CUST-013446 (30 variables del contrato de la Entrega 2)
ENTRADA = {
    "age": 57, "gender": "Female", "country": "United Kingdom",
    "income_bracket": "0-25K", "education_level": "Masters",
    "employment_type": "Employed", "marital_status": "Widowed",
    "customer_segment": "Consumer", "tenure_months": 45,
    "total_purchases": 160, "avg_order_value_usd": 447.49,
    "total_spent_usd": 71598.40, "monetary_score": 5,
    "preferred_category_1": "Books", "preferred_category_2": "Grocery",
    "preferred_category_3": "Toys", "shopping_channel": "Mobile App",
    "device_used": "Tablet", "payment_method": "Cash on Delivery",
    "return_count": 14, "complaint_count": 14, "satisfaction_score": 2,
    "loyalty_tier": "Diamond", "email_open_rate": 0.63,
    "click_through_rate": 0.466, "conversion_rate": 0.007,
    "engagement_level": "High", "customer_lifetime_value_usd": 62034.20,
    "customer_acquisition_cost_usd": 184.60,
    "customer_profitability_usd": 61849.60,
}


def mostrar(titulo: str, entrada: dict) -> None:
    print(f"\n=== {titulo} ===")
    print(json.dumps(predecir(entrada), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    print("Entrada (cliente real CUST-013446):")
    print(json.dumps(ENTRADA, indent=2, ensure_ascii=False))
    predecir(ENTRADA)  # primera llamada: carga el modelo en memoria
    mostrar("Salida real del modelo", ENTRADA)
    mostrar("Mismo cliente, pero satisfecho y sin quejas",
            {**ENTRADA, "satisfaction_score": 5, "complaint_count": 0, "return_count": 0})
    mostrar("Entrada inválida (satisfacción = 7)", {**ENTRADA, "satisfaction_score": 7})
