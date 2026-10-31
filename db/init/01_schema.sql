-- =====================================================================
-- 01_schema.sql
-- PostgreSQL ejecuta este archivo automáticamente la primera vez que se
-- crea la base de datos (volumen vacío). Para volver a ejecutarlo:
--   docker compose down -v && docker compose up -d
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. customers: copia fiel del CSV (53 columnas, mismo orden y nombres).
--    No se modifica nada al cargar; la limpieza para la IA se hace en la
--    vista v_entrenamiento (sección 3).
--    Nota: el CSV no tiene celdas vacías; los "nulos" vienen como el
--    texto 'None' en preferred_category_2, preferred_category_3,
--    loyalty_tier y social_media_presence.
-- ---------------------------------------------------------------------
CREATE TABLE customers (
    customer_id                    VARCHAR(20)   PRIMARY KEY,
    customer_segment               TEXT          NOT NULL,
    segment_category               TEXT          NOT NULL,
    age                            SMALLINT      NOT NULL CHECK (age BETWEEN 0 AND 120),
    age_group                      TEXT          NOT NULL,
    gender                         TEXT          NOT NULL,
    country                        TEXT          NOT NULL,
    city                           TEXT          NOT NULL,
    income_bracket                 TEXT          NOT NULL,
    education_level                TEXT          NOT NULL,
    employment_type                TEXT          NOT NULL,
    marital_status                 TEXT          NOT NULL,
    tenure_months                  SMALLINT      NOT NULL CHECK (tenure_months >= 0),
    total_purchases                INTEGER       NOT NULL CHECK (total_purchases >= 0),
    avg_order_value_usd            NUMERIC(12,2) NOT NULL,
    total_spent_usd                NUMERIC(12,2) NOT NULL,
    purchase_frequency             TEXT          NOT NULL,
    days_since_last_purchase       SMALLINT      NOT NULL CHECK (days_since_last_purchase >= 0),
    preferred_category_1           TEXT          NOT NULL,
    preferred_category_2           TEXT          NOT NULL,
    preferred_category_3           TEXT          NOT NULL,
    shopping_channel               TEXT          NOT NULL,
    device_used                    TEXT          NOT NULL,
    payment_method                 TEXT          NOT NULL,
    return_count                   SMALLINT      NOT NULL CHECK (return_count >= 0),
    complaint_count                SMALLINT      NOT NULL CHECK (complaint_count >= 0),
    satisfaction_score             SMALLINT      NOT NULL CHECK (satisfaction_score BETWEEN 1 AND 5),
    satisfaction_level             TEXT          NOT NULL,
    loyalty_tier                   TEXT          NOT NULL,
    email_open_rate                NUMERIC(5,3)  NOT NULL CHECK (email_open_rate BETWEEN 0 AND 1),
    click_through_rate             NUMERIC(5,3)  NOT NULL CHECK (click_through_rate BETWEEN 0 AND 1),
    conversion_rate                NUMERIC(5,3)  NOT NULL CHECK (conversion_rate BETWEEN 0 AND 1),
    social_media_presence          TEXT          NOT NULL,
    customer_lifetime_value_usd    NUMERIC(12,2) NOT NULL,
    customer_acquisition_cost_usd  NUMERIC(12,2) NOT NULL,
    customer_profitability_usd     NUMERIC(12,2) NOT NULL,
    recency_score                  SMALLINT      NOT NULL,
    frequency_score                SMALLINT      NOT NULL,
    monetary_score                 SMALLINT      NOT NULL CHECK (monetary_score BETWEEN 1 AND 5),
    rfm_score                      SMALLINT      NOT NULL,
    churn_risk_score               SMALLINT      NOT NULL CHECK (churn_risk_score BETWEEN 0 AND 100),
    customer_health_score          SMALLINT      NOT NULL,
    dataset_year                   SMALLINT      NOT NULL,
    customer_value_category        TEXT          NOT NULL,
    activity_status                TEXT          NOT NULL,
    health_status                  TEXT          NOT NULL,
    churn_risk_category            TEXT          NOT NULL,
    rfm_category                   TEXT          NOT NULL,
    profitability_category         TEXT          NOT NULL,
    engagement_level               TEXT          NOT NULL,
    behavior_segment               TEXT          NOT NULL,
    device_preference              TEXT          NOT NULL,
    clv_category                   TEXT          NOT NULL
);

-- Índices para los filtros del dashboard (RF-04)
CREATE INDEX idx_customers_country         ON customers (country);
CREATE INDEX idx_customers_loyalty_tier    ON customers (loyalty_tier);
CREATE INDEX idx_customers_activity_status ON customers (activity_status);
CREATE INDEX idx_customers_segment         ON customers (customer_segment);

-- ---------------------------------------------------------------------
-- 2. Tablas que llena el sistema (vacías al inicio).
-- ---------------------------------------------------------------------
CREATE TABLE model_versions (
    version        VARCHAR(20)  PRIMARY KEY,           -- ej. 'v1'
    trained_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    model_type     TEXT         NOT NULL,              -- ej. 'RandomForestClassifier'
    threshold      NUMERIC(4,3) NOT NULL,              -- umbral de "en riesgo"
    f1_score        NUMERIC(4,3),
    precision_score NUMERIC(4,3),
    recall_score    NUMERIC(4,3),
    pr_auc          NUMERIC(4,3),
    features       JSONB        NOT NULL               -- lista de columnas usadas
);

CREATE TABLE predictions (
    id                  BIGSERIAL    PRIMARY KEY,
    customer_id         VARCHAR(20)  NOT NULL REFERENCES customers (customer_id),
    model_version       VARCHAR(20)  NOT NULL REFERENCES model_versions (version),
    churn_probability   NUMERIC(5,4) NOT NULL CHECK (churn_probability BETWEEN 0 AND 1),
    churn_label         SMALLINT     NOT NULL CHECK (churn_label IN (0, 1)),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_predictions_customer ON predictions (customer_id, created_at DESC);

CREATE TABLE coupons (
    id                  BIGSERIAL    PRIMARY KEY,
    customer_id         VARCHAR(20)  NOT NULL UNIQUE REFERENCES customers (customer_id),
    code                VARCHAR(30)  NOT NULL UNIQUE,  -- ej. 'VUELVE-7F3K2'
    discount_percent    SMALLINT     NOT NULL CHECK (discount_percent IN (10, 15, 20)),
    channel             VARCHAR(10)  NOT NULL CHECK (channel IN ('correo', 'qr')),
    churn_probability   NUMERIC(5,4),                  -- probabilidad al enviarlo
    model_version       VARCHAR(20),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE contacts (
    id           BIGSERIAL    PRIMARY KEY,
    customer_id  VARCHAR(20)  NOT NULL REFERENCES customers (customer_id),
    note         TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3. v_entrenamiento: los ÚNICOS datos que ve el modelo.
--    30 columnas permitidas + la variable objetivo "riesgo".
--    Las columnas de fuga de datos NO están aquí a propósito.
--    La lista debe coincidir con ml/training/columnas.py.
-- ---------------------------------------------------------------------
CREATE VIEW v_entrenamiento AS
SELECT
    customer_id,
    -- Demografía
    age, gender, country, income_bracket, education_level,
    employment_type, marital_status, customer_segment,
    -- Historial de compra
    tenure_months, total_purchases, avg_order_value_usd, total_spent_usd,
    monetary_score, preferred_category_1, preferred_category_2,
    preferred_category_3, shopping_channel, device_used, payment_method,
    -- Experiencia y engagement
    return_count, complaint_count, satisfaction_score, loyalty_tier,
    email_open_rate, click_through_rate, conversion_rate, engagement_level,
    -- Valor del cliente
    customer_lifetime_value_usd, customer_acquisition_cost_usd,
    customer_profitability_usd,
    -- Variable objetivo
    CASE WHEN churn_risk_score >= 40 THEN 1 ELSE 0 END AS riesgo
FROM customers;
