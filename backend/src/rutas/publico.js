// GET /api/publico/cupon/:codigo · SIN inicio de sesión.
// La abre el celular del cliente al escanear el QR (ruta /cupon/:codigo del
// frontend). Solo devuelve el código y el descuento: ningún dato personal.
import { Router } from 'express';
import { consulta } from '../db.js';
import { ErrorApi, manejar } from '../errores.js';

export const rutasPublicas = Router();

const VIGENCIA_DIAS = 30;
const CODIGO_VALIDO = /^[A-Z0-9]{2,12}-[A-Z0-9]{5}$/;

rutasPublicas.get('/cupon/:codigo', manejar(async (req, res) => {
  const codigo = String(req.params.codigo).toUpperCase();
  if (!CODIGO_VALIDO.test(codigo)) throw new ErrorApi(404, 'NOT_FOUND', 'Cupón no encontrado');
  const [cupon] = await consulta(
    `SELECT code, discount_percent, created_at, created_at + make_interval(days => $2) AS vence
     FROM coupons WHERE code = $1`,
    [codigo, VIGENCIA_DIAS],
  );
  if (!cupon) throw new ErrorApi(404, 'NOT_FOUND', 'Cupón no encontrado');
  res.json({
    codigo: cupon.code,
    descuento: cupon.discount_percent,
    vence: cupon.vence,
    vigente: new Date(cupon.vence) > new Date(),
  });
}));
