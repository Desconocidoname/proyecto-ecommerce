// Construye el WHERE de las consultas de clientes a partir de los filtros de
// la URL. Los valores SIEMPRE van como parámetros ($1, $2...), nunca pegados
// al texto SQL: así se evita la inyección de SQL.
import { config } from '../config.js';

// Un cliente con 90 días o más sin comprar ya se considera perdido (Inactive):
// las alertas son para los que todavía están activos y se pueden retener.
export const DIAS_ACTIVO = 90;

export function construirFiltros(query, { soloAlertas = false } = {}) {
  const condiciones = [];
  const parametros = [];
  const agregar = (sql, valor) => {
    parametros.push(valor);
    condiciones.push(sql.replace('?', `$${parametros.length}`));
  };
  const valor = (v) => (typeof v === 'string' && v.trim() && v !== 'Todos' ? v.trim() : null);
  const umbral = config.umbralAlerta;

  if (valor(query.q)) agregar('customer_id ILIKE ?', `%${valor(query.q)}%`);
  if (valor(query.pais)) agregar('country = ?', valor(query.pais));
  if (valor(query.lealtad)) agregar('nivel_lealtad = ?', valor(query.lealtad));
  if (valor(query.segmento)) agregar('customer_segment = ?', valor(query.segmento));
  if (valor(query.estado)) agregar('activity_status = ?', valor(query.estado));

  // En alerta (RF-08): probabilidad >= umbral Y cliente activo (menos de 90 días sin comprar).
  if (soloAlertas) {
    agregar('churn_probability >= ?', umbral);
    condiciones.push(`days_since_last_purchase < ${DIAS_ACTIVO}`);
  }
  const riesgo = soloAlertas ? null : valor(query.riesgo);
  if (riesgo === 'alto') agregar('churn_probability >= ?', umbral);
  if (riesgo === 'medio') {
    agregar('churn_probability >= ?', umbral * 0.6);
    agregar('churn_probability < ?', umbral);
  }
  if (riesgo === 'bajo') agregar('churn_probability < ?', umbral * 0.6);

  if (valor(query.atencion) === 'pendientes') condiciones.push('cupon_codigo IS NULL');
  if (valor(query.atencion) === 'atendidos') condiciones.push('cupon_codigo IS NOT NULL');

  return {
    where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '',
    parametros,
  };
}

// Nivel de riesgo con la misma regla del servicio de IA.
export function nivelRiesgo(probabilidad) {
  if (probabilidad === null || probabilidad === undefined) return null;
  const umbral = config.umbralAlerta;
  if (probabilidad >= umbral) return 'alto';
  return probabilidad >= umbral * 0.6 ? 'medio' : 'bajo';
}
