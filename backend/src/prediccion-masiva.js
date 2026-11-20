// Predicción masiva (RF-08): calcula el riesgo de los 50,000 clientes con el
// modelo vigente y lo guarda en la tabla predictions.
//
// Pasos:
//   1. Pide al servicio de IA la versión y métricas del modelo y las registra
//      en model_versions.
//   2. Lee los clientes de PostgreSQL en bloques de 2,000 (solo las 30 variables).
//   3. Envía cada bloque a POST /predict/lote del servicio de IA.
//   4. Reemplaza, en una sola transacción, las predicciones de esa versión.
import { consulta, transaccion } from './db.js';
import { FEATURES } from './columnas.js';
import { infoModelo, predecirLote } from './ml.js';
import { ErrorApi } from './errores.js';

const TAMANO_BLOQUE = 2000;
let enCurso = null;

export function prediccionEnCurso() {
  return enCurso !== null;
}

// ¿Hace falta predecir? Sí, si no hay predicciones o si el modelo del servicio
// de IA es distinto (se reentrenó) al de la última predicción guardada.
export async function prediccionPendiente() {
  const info = await infoModelo();
  const [fila] = await consulta(
    `SELECT mv.trained_at
     FROM model_versions mv
     WHERE mv.version = $1 AND EXISTS (SELECT 1 FROM predictions p WHERE p.model_version = mv.version)`,
    [info.version],
  );
  if (!fila) return 'no hay predicciones del modelo actual';
  if (info.entrenado && new Date(fila.trained_at).getTime() !== new Date(info.entrenado).getTime()) {
    return 'el modelo se reentrenó';
  }
  return null;
}

async function registrarModelo(cliente, info) {
  const m = info.metricas || {};
  await cliente.query(
    `INSERT INTO model_versions (version, trained_at, model_type, threshold, f1_score, precision_score, recall_score, pr_auc, features)
     VALUES ($1, COALESCE($2::timestamptz, now()), $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (version) DO UPDATE SET
       trained_at = EXCLUDED.trained_at, model_type = EXCLUDED.model_type, threshold = EXCLUDED.threshold,
       f1_score = EXCLUDED.f1_score, precision_score = EXCLUDED.precision_score,
       recall_score = EXCLUDED.recall_score, pr_auc = EXCLUDED.pr_auc, features = EXCLUDED.features`,
    [info.version, info.entrenado, info.modelo || 'Random Forest', info.umbral,
      m.f1 ?? null, m.precision ?? null, m.recall ?? null, m.pr_auc ?? null, JSON.stringify(info.features)],
  );
}

async function ejecutar() {
  const inicio = Date.now();
  const info = await infoModelo();
  const columnas = ['customer_id', ...FEATURES].join(', ');
  const ids = [];
  const probabilidades = [];
  const etiquetas = [];
  let errores = 0;
  let ultimoId = '';

  // Paginación por llave (customer_id > último): no se hace más lenta al avanzar.
  for (;;) {
    const bloque = await consulta(
      `SELECT ${columnas} FROM customers WHERE customer_id > $1 ORDER BY customer_id LIMIT $2`,
      [ultimoId, TAMANO_BLOQUE],
    );
    if (bloque.length === 0) break;
    ultimoId = bloque[bloque.length - 1].customer_id;

    const resultado = await predecirLote(bloque);
    errores += resultado.errores.length;
    for (const p of resultado.predicciones) {
      ids.push(p.customer_id);
      probabilidades.push(p.probabilidad_riesgo);
      etiquetas.push(p.prediccion);
    }
  }

  if (ids.length === 0) throw new ErrorApi(500, 'NO_PREDICTIONS', 'El modelo no devolvió predicciones');

  await transaccion(async (cliente) => {
    await registrarModelo(cliente, info);
    await cliente.query('DELETE FROM predictions WHERE model_version = $1', [info.version]);
    // unnest convierte los tres arreglos en filas: un solo INSERT para todos los clientes.
    await cliente.query(
      `INSERT INTO predictions (customer_id, model_version, churn_probability, churn_label)
       SELECT id, $4, prob, etiqueta FROM unnest($1::varchar[], $2::numeric[], $3::smallint[]) AS t(id, prob, etiqueta)`,
      [ids, probabilidades, etiquetas, info.version],
    );
  });

  const resumen = {
    status: 'completed',
    predicted: ids.length,
    errores,
    modelVersion: info.version,
    durationMs: Date.now() - inicio,
  };
  console.log(`[INFO] Predicción masiva: ${resumen.predicted} clientes con el modelo ${resumen.modelVersion} en ${resumen.durationMs} ms`);
  return resumen;
}

export async function ejecutarPrediccionMasiva() {
  if (enCurso) throw new ErrorApi(409, 'IN_PROGRESS', 'Ya hay una predicción en curso');
  enCurso = ejecutar();
  try {
    return await enCurso;
  } finally {
    enCurso = null;
  }
}
