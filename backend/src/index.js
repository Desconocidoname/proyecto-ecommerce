// API principal del dashboard de retención.
// Solo la consume el frontend (a través de Nginx en /api/). Es el único
// servicio que habla con PostgreSQL y con el servicio de IA.
import express from 'express';
import { config } from './config.js';
import { pool } from './db.js';
import { manejadorErrores, ErrorApi } from './errores.js';
import { rutasAuth, requiereSesion } from './auth.js';
import { rutasResumen } from './rutas/resumen.js';
import { rutasClientes, rutasAlertas } from './rutas/clientes.js';
import { rutasPrediccion } from './rutas/prediccion.js';
import { rutasPublicas } from './rutas/publico.js';
import { saludIa } from './ml.js';
import { ejecutarPrediccionMasiva, prediccionPendiente } from './prediccion-masiva.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // detrás de Nginx: req.ip es la IP real del navegador
app.use(express.json({ limit: '100kb' }));

// --- Rutas sin sesión ---
app.get('/api/health', async (_req, res) => {
  const db = await pool.query('SELECT 1').then(() => 'ok').catch(() => 'error');
  const ia = await saludIa();
  res.status(db === 'ok' ? 200 : 503).json({
    status: db === 'ok' && ia ? 'ok' : 'degradado',
    db,
    mlService: ia ? 'ok' : 'error',
    modelVersion: ia?.modelVersion ?? null,
  });
});
app.use('/api/auth', rutasAuth);
app.use('/api/publico', rutasPublicas);

// --- Rutas del administrador (requieren sesión) ---
app.use('/api', requiereSesion);
app.use('/api/resumen', rutasResumen);
app.use('/api/clientes', rutasClientes);
app.use('/api/alertas', rutasAlertas);
app.use('/api', rutasPrediccion);

app.use('/api', (_req, _res, next) => next(new ErrorApi(404, 'NOT_FOUND', 'Ruta no encontrada')));
app.use(manejadorErrores);

// Al arrancar (RF-08): si no hay predicciones o el modelo se reentrenó, calcula
// el riesgo de los 50,000 clientes. Después de entrenar basta con:
//   docker compose restart ml-service backend
async function prediccionInicial() {
  if (!config.prediccionAlIniciar) return;
  for (let intento = 1; intento <= 10; intento += 1) {
    try {
      if (await saludIa()) {
        const motivo = await prediccionPendiente();
        if (!motivo) {
          console.log('[INFO] Las predicciones ya corresponden al modelo actual');
          return;
        }
        console.log(`[INFO] Predicción masiva al iniciar (${motivo})...`);
        await ejecutarPrediccionMasiva();
        return;
      }
    } catch (error) {
      console.warn(`[WARN] Predicción inicial, intento ${intento}: ${error.message}`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.warn('[WARN] No se pudo hacer la predicción inicial. Úsala desde el botón "Ejecutar predicción".');
}

const servidor = app.listen(config.puerto, () => {
  console.log(`[INFO] Backend escuchando en el puerto ${config.puerto}`);
  prediccionInicial();
});

// Apagado limpio (docker compose stop envía SIGTERM)
for (const senal of ['SIGTERM', 'SIGINT']) {
  process.on(senal, () => {
    servidor.close(() => pool.end().then(() => process.exit(0)));
  });
}
