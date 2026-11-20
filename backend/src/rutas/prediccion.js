// Simulador (RF-02), predicción masiva (RF-08) e información del modelo.
import { Router } from 'express';
import { consulta } from '../db.js';
import { manejar } from '../errores.js';
import { FEATURES } from '../columnas.js';
import { infoModelo, predecirUno } from '../ml.js';
import { ejecutarPrediccionMasiva, prediccionEnCurso } from '../prediccion-masiva.js';

export const rutasPrediccion = Router();

// POST /api/simulador · las 30 variables del formulario -> resultado de predecir()
rutasPrediccion.post('/simulador', manejar(async (req, res) => {
  const entrada = Object.fromEntries(FEATURES.map((c) => [c, req.body?.[c]]));
  res.json(await predecirUno(entrada));
}));

// POST /api/predicciones/ejecutar · recalcula a los 50,000 clientes
rutasPrediccion.post('/predicciones/ejecutar', manejar(async (_req, res) => {
  res.json(await ejecutarPrediccionMasiva());
}));

// GET /api/modelo · versión, métricas e importancia de variables
rutasPrediccion.get('/modelo', manejar(async (_req, res) => {
  const [info, ultima] = await Promise.all([
    infoModelo().catch(() => null),
    consulta(`SELECT model_version, MAX(created_at) AS fecha, COUNT(*) AS clientes
              FROM predictions GROUP BY model_version ORDER BY fecha DESC LIMIT 1`),
  ]);
  res.json({
    ia: info,
    ultimaPrediccion: ultima[0] ? { version: ultima[0].model_version, fecha: ultima[0].fecha, clientes: ultima[0].clientes } : null,
    enCurso: prediccionEnCurso(),
  });
}));
