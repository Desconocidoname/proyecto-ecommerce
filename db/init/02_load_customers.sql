-- =====================================================================
-- 02_load_customers.sql
-- Carga el CSV original en la tabla customers.
-- Docker Compose monta la carpeta data/raw/ como /data dentro del
-- contenedor, así que el archivo debe estar en data/raw/customers.csv.
-- =====================================================================

COPY customers (
    customer_id,
    customer_segment,
    segment_category,
    age,
    age_group,
    gender,
    country,
    city,
    income_bracket,
    education_level,
    employment_type,
    marital_status,
    tenure_months,
    total_purchases,
    avg_order_value_usd,
    total_spent_usd,
    purchase_frequency,
    days_since_last_purchase,
    preferred_category_1,
    preferred_category_2,
    preferred_category_3,
    shopping_channel,
    device_used,
    payment_method,
    return_count,
    complaint_count,
    satisfaction_score,
    satisfaction_level,
    loyalty_tier,
    email_open_rate,
    click_through_rate,
    conversion_rate,
    social_media_presence,
    customer_lifetime_value_usd,
    customer_acquisition_cost_usd,
    customer_profitability_usd,
    recency_score,
    frequency_score,
    monetary_score,
    rfm_score,
    churn_risk_score,
    customer_health_score,
    dataset_year,
    customer_value_category,
    activity_status,
    health_status,
    churn_risk_category,
    rfm_category,
    profitability_category,
    engagement_level,
    behavior_segment,
    device_preference,
    clv_category
)
FROM '/data/customers.csv'
WITH (FORMAT csv, HEADER true);

-- Comprobación: debe mostrar 50000 en los registros del contenedor db.
DO $$
DECLARE total INTEGER;
BEGIN
    SELECT COUNT(*) INTO total FROM customers;
    RAISE NOTICE 'Clientes cargados: %', total;
END $$;
