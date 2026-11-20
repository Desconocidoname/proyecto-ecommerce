// GET /api/resumen?pais=&lealtad=  · Pantalla Resumen (RF-03)
import { Router } from 'express';
import { consulta } from '../db.js';
import { config } from '../config.js';
import { manejar } from '../errores.js';
import { construirFiltros, DIAS_ACTIVO } from './filtros.js';

export const rutasResumen = Router();

const ORDEN_ESTADO = ['Active', 'At Risk', 'Dormant', 'Inactive'];
const ORDEN_LEALTAD = ['Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Sin nivel'];

rutasResumen.get('/', manejar(async (req, res) => {
  const { where, parametros } = construirFiltros({ pais: req.query.pais, lealtad: req.query.lealtad });
  const u = parametros.length + 1; // posición del parámetro del umbral
  const p = [...parametros, config.umbralAlerta];
  const alerta = `churn_probability >= $${u} AND days_since_last_purchase < ${DIAS_ACTIVO}`;
  const y = where ? 'AND' : 'WHERE';

  const [kpis, estados, segmentos, lealtad, alertasLealtad, alertasSatisfaccion, paises, opciones, modelo] = await Promise.all([
    consulta(`
      SELECT COUNT(*) AS clientes,
             COUNT(*) FILTER (WHERE ${alerta}) AS alertas,
             COUNT(*) FILTER (WHERE days_since_last_purchase >= ${DIAS_ACTIVO}) AS inactivos,
             COUNT(cupon_codigo) AS cupones,
             COUNT(*) FILTER (WHERE churn_probability >= $${u}) AS en_riesgo,
             COUNT(*) FILTER (WHERE churn_probability IS NOT NULL) AS con_prediccion,
             ROUND(AVG(total_spent_usd)) AS gasto_promedio,
             ROUND(AVG(avg_order_value_usd)) AS valor_pedido,
             ROUND(AVG(satisfaction_score), 1) AS satisfaccion,
             ROUND(AVG(tenure_months), 1) AS antiguedad,
             ROUND(SUM(customer_lifetime_value_usd) FILTER (WHERE ${alerta})) AS valor_en_riesgo,
             COUNT(cupon_codigo) FILTER (WHERE ${alerta}) AS alertas_atendidas
      FROM v_clientes_dashboard ${where}`, p),
    consulta(`SELECT activity_status AS nombre, COUNT(*) AS clientes,
                     ROUND(AVG(days_since_last_purchase)) AS dias
              FROM v_clientes_dashboard ${where} GROUP BY 1`, parametros),
    consulta(`SELECT customer_segment AS nombre, COUNT(*) AS clientes
              FROM v_clientes_dashboard ${where} GROUP BY 1 ORDER BY 2 DESC`, parametros),
    consulta(`SELECT nivel_lealtad AS nombre, COUNT(*) AS clientes
              FROM v_clientes_dashboard ${where} GROUP BY 1`, parametros),
    consulta(`SELECT nivel_lealtad AS nombre, COUNT(*) AS clientes
              FROM v_clientes_dashboard ${where} ${y} ${alerta} GROUP BY 1`, p),
    consulta(`SELECT satisfaction_score AS nombre, COUNT(*) AS clientes
              FROM v_clientes_dashboard ${where} ${y} ${alerta} GROUP BY 1 ORDER BY 1`, p),
    consulta(`SELECT country AS nombre, COUNT(*) AS clientes
              FROM v_clientes_dashboard ${where} ${y} ${alerta} GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 6`, p),
    consulta(`SELECT ARRAY(SELECT DISTINCT country FROM customers ORDER BY 1) AS paises`),
    consulta(`SELECT mv.version, mv.trained_at, mv.threshold, mv.f1_score, mv.recall_score, mv.precision_score,
                     (SELECT MAX(created_at) FROM predictions WHERE model_version = mv.version) AS ultima_prediccion
              FROM model_versions mv
              WHERE mv.version = (SELECT model_version FROM predictions ORDER BY created_at DESC LIMIT 1)`),
  ]);

  const k = kpis[0];
  const ordenar = (filas, orden) => orden.map((n) => filas.find((f) => f.nombre === n) || { nombre: n, clientes: 0 });
  const m = modelo[0];

  res.json({
    kpis: {
      clientes: k.clientes,
      inactivos: k.inactivos,
      alertas: k.alertas,
      cuponesEnviados: k.cupones,
      enRiesgo: k.en_riesgo,
      tasaRiesgo: k.con_prediccion ? k.en_riesgo / k.con_prediccion : null,
      gastoPromedio: k.gasto_promedio,
      valorPedido: k.valor_pedido,
      satisfaccion: k.satisfaccion,
      antiguedad: k.antiguedad,
      valorEnRiesgo: k.valor_en_riesgo,
      alertasAtendidas: k.alertas_atendidas,
    },
    porEstado: ordenar(estados, ORDEN_ESTADO),
    porSegmento: segmentos,
    porLealtad: ordenar(lealtad, ORDEN_LEALTAD).filter((f) => f.clientes > 0),
    alertasPorLealtad: ordenar(alertasLealtad, ORDEN_LEALTAD).filter((f) => f.clientes > 0),
    alertasPorSatisfaccion: [1, 2, 3, 4, 5].map((n) => ({
      nombre: n, clientes: alertasSatisfaccion.find((f) => f.nombre === n)?.clientes || 0,
    })),
    paisesConMasAlertas: paises,
    opciones: { paises: opciones[0].paises, lealtades: ORDEN_LEALTAD },
    modelo: m ? {
      version: m.version,
      entrenado: m.trained_at,
      umbral: m.threshold,
      f1: m.f1_score,
      recall: m.recall_score,
      precision: m.precision_score,
      ultimaPrediccion: m.ultima_prediccion,
    } : null,
    umbralAlerta: config.umbralAlerta,
  });
}));
