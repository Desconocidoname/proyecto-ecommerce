// Formato común de error (documento de diseño, sección 7):
//   { "error": { "code": "NOT_FOUND", "message": "Cliente no encontrado" } }

export class ErrorApi extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

// Envuelve rutas async para que cualquier error llegue al manejador central.
export const manejar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function manejadorErrores(err, req, res, _next) {
  if (err instanceof ErrorApi) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.extra } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'El cuerpo de la petición no es JSON válido' } });
  }
  console.error('[ERROR]', req.method, req.originalUrl, err);
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Error interno del servidor' } });
}
