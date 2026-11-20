-- =====================================================================
-- 03_dashboard.sql · Vistas que consulta el backend para el dashboard.
--
-- Se ejecuta solo en una base vacía (como 01 y 02). Si tu base ya existe,
-- aplícalo a mano sin borrar nada:
--   docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < db/init/03_dashboard.sql
-- =====================================================================

-- Última predicción de cada cliente (la tabla predictions guarda historial).
CREATE OR REPLACE VIEW v_ultima_prediccion AS
SELECT DISTINCT ON (customer_id)
       customer_id, churn_probability, churn_label, model_version, created_at
FROM predictions
ORDER BY customer_id, created_at DESC, id DESC;

-- Una fila por cliente con lo que muestra el dashboard:
-- datos del cliente + última predicción + cupón (si ya se le dio uno).
CREATE OR REPLACE VIEW v_clientes_dashboard AS
SELECT c.*,
       COALESCE(NULLIF(c.loyalty_tier, 'None'), 'Sin nivel') AS nivel_lealtad,
       p.churn_probability,
       p.churn_label,
       p.model_version,
       p.created_at        AS prediccion_fecha,
       cu.code             AS cupon_codigo,
       cu.channel          AS cupon_canal,
       cu.discount_percent AS cupon_descuento,
       cu.created_at       AS cupon_fecha
FROM customers c
LEFT JOIN v_ultima_prediccion p USING (customer_id)
LEFT JOIN coupons cu USING (customer_id);

-- Índice para que las alertas y el orden por probabilidad respondan rápido.
CREATE INDEX IF NOT EXISTS idx_predictions_version ON predictions (model_version);
