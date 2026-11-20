// Las 30 variables que recibe el modelo. Debe coincidir con ml/training/columnas.py.
export const NUMERICAS = [
  'age', 'tenure_months', 'total_purchases', 'avg_order_value_usd', 'total_spent_usd',
  'monetary_score', 'return_count', 'complaint_count', 'satisfaction_score',
  'email_open_rate', 'click_through_rate', 'conversion_rate',
  'customer_lifetime_value_usd', 'customer_acquisition_cost_usd', 'customer_profitability_usd',
];

export const CATEGORICAS = [
  'gender', 'country', 'income_bracket', 'education_level', 'employment_type',
  'marital_status', 'customer_segment', 'preferred_category_1', 'preferred_category_2',
  'preferred_category_3', 'shopping_channel', 'device_used', 'payment_method',
  'loyalty_tier', 'engagement_level',
];

export const FEATURES = [...NUMERICAS, ...CATEGORICAS];
