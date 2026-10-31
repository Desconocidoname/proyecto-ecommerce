"""Lista única de columnas que usa el modelo.

Debe coincidir con la vista v_entrenamiento de db/init/01_schema.sql.
Si se cambia aquí, se cambia también allá (y se avisa al equipo).
"""

NUMERICAS = [
    "age", "tenure_months", "total_purchases", "avg_order_value_usd",
    "total_spent_usd", "monetary_score", "return_count", "complaint_count",
    "satisfaction_score", "email_open_rate", "click_through_rate",
    "conversion_rate", "customer_lifetime_value_usd",
    "customer_acquisition_cost_usd", "customer_profitability_usd",
]

CATEGORICAS = [
    "gender", "country", "income_bracket", "education_level",
    "employment_type", "marital_status", "customer_segment",
    "preferred_category_1", "preferred_category_2", "preferred_category_3",
    "shopping_channel", "device_used", "payment_method", "loyalty_tier",
    "engagement_level",
]

FEATURES = NUMERICAS + CATEGORICAS          # 30 columnas de entrada
OBJETIVO = "riesgo"                         # 1 si churn_risk_score >= 40
ID = "customer_id"

# Columnas que delatan la respuesta: el modelo NUNCA debe verlas.
FUGA = [
    "days_since_last_purchase", "activity_status", "recency_score",
    "frequency_score", "rfm_score", "rfm_category", "purchase_frequency",
    "behavior_segment", "segment_category", "churn_risk_score",
    "churn_risk_category", "customer_health_score", "health_status",
]

UMBRAL_RIESGO = 40
SEMILLA = 42
PROPORCION_PRUEBA = 0.20
