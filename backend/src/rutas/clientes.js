// Pantallas Clientes y Alertas (RF-04), detalle de un cliente y acciones de
// retención: cupón por correo, cupón QR y registro de contacto (RF-06).
import crypto from 'node:crypto';
import { Router } from 'express';
import { consulta } from '../db.js';
import { config } from '../config.js';
import { ErrorApi, manejar } from '../errores.js';
import { FEATURES } from '../columnas.js';
import { construirFiltros, nivelRiesgo, DIAS_ACTIVO } from './filtros.js';

export const rutasClientes = Router();
export const rutasAlertas = Router();

const POR_PAGINA = 20;
const ID_VALIDO = /^CUST-\d{6}$/;

// Columnas por las que se puede ordenar (lista cerrada: nunca se pega texto del usuario al SQL).
const ORDENES = {
  id: 'customer_id',
  edad: 'age',
  pais: 'country',
  lealtad: 'nivel_lealtad',
  compras: 'total_purchases',
  gasto: 'total_spent_usd',
  satisfaccion: 'satisfaction_score',
  dias: 'days_since_last_purchase',
  valor: 'customer_lifetime_value_usd',
  prob: 'churn_probability',
};

const COLUMNAS_LISTA = `customer_id, age, gender, country, customer_segment, nivel_lealtad, total_purchases,
  total_spent_usd, satisfaction_score, complaint_count, activity_status, days_since_last_purchase,
  customer_lifetime_value_usd, churn_probability, cupon_codigo, cupon_canal, cupon_descuento`;

const aCliente = (f) => ({
  id: f.customer_id,
  edad: f.age,
  genero: f.gender,
  pais: f.country,
  segmento: f.customer_segment,
  lealtad: f.nivel_lealtad,
  compras: f.total_purchases,
  gasto: f.total_spent_usd,
  satisfaccion: f.satisfaction_score,
  quejas: f.complaint_count,
  estado: f.activity_status,
  dias: f.days_since_last_purchase,
  valor: f.customer_lifetime_value_usd,
  probabilidad: f.churn_probability,
  riesgo: nivelRiesgo(f.churn_probability),
  cupon: f.cupon_codigo ? { codigo: f.cupon_codigo, canal: f.cupon_canal, descuento: f.cupon_descuento } : null,
});

async function listar(query, { soloAlertas }) {
  const { where, parametros } = construirFiltros(query, { soloAlertas });
  const columna = ORDENES[query.orden] || (soloAlertas ? 'churn_probability' : 'customer_id');
  const direccion = query.dir === 'asc' ? 'ASC' : query.dir === 'desc' ? 'DESC' : (soloAlertas ? 'DESC' : 'ASC');
  const pagina = Math.max(1, Number.parseInt(query.pagina, 10) || 1);

  const filas = await consulta(
    `SELECT ${COLUMNAS_LISTA}, COUNT(*) OVER () AS total
     FROM v_clientes_dashboard ${where}
     ORDER BY ${columna} ${direccion} NULLS LAST, customer_id
     LIMIT ${POR_PAGINA} OFFSET ${(pagina - 1) * POR_PAGINA}`,
    parametros,
  );
  return {
    pagina,
    porPagina: POR_PAGINA,
    total: filas[0]?.total ?? 0,
    items: filas.map(aCliente),
  };
}

// GET /api/clientes?q=&pais=&lealtad=&segmento=&estado=&riesgo=&orden=&dir=&pagina=
rutasClientes.get('/', manejar(async (req, res) => {
  res.json(await listar(req.query, { soloAlertas: false }));
}));

// GET /api/clientes/opciones · valores de los filtros
rutasClientes.get('/opciones', manejar(async (_req, res) => {
  const [fila] = await consulta(`
    SELECT ARRAY(SELECT DISTINCT country FROM customers ORDER BY 1) AS paises,
           ARRAY(SELECT DISTINCT customer_segment FROM customers ORDER BY 1) AS segmentos,
           ARRAY(SELECT DISTINCT activity_status FROM customers ORDER BY 1) AS estados`);
  res.json({ ...fila, lealtades: ['Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Sin nivel'] });
}));

// GET /api/alertas?q=&lealtad=&atencion=pendientes|atendidos&orden=prob|valor&pagina=
rutasAlertas.get('/', manejar(async (req, res) => {
  const lista = await listar(req.query, { soloAlertas: true });
  const [conteo] = await consulta(
    `SELECT COUNT(*) AS total, COUNT(cupon_codigo) AS atendidos
     FROM v_clientes_dashboard WHERE churn_probability >= $1 AND days_since_last_purchase < ${DIAS_ACTIVO}`,
    [config.umbralAlerta],
  );
  res.json({ ...lista, conteo: { ...conteo, pendientes: conteo.total - conteo.atendidos }, umbral: config.umbralAlerta, diasActivo: DIAS_ACTIVO });
}));

async function buscarCliente(id) {
  if (!ID_VALIDO.test(id)) throw new ErrorApi(400, 'VALIDATION', 'El ID debe tener el formato CUST-000000');
  const [fila] = await consulta('SELECT * FROM v_clientes_dashboard WHERE customer_id = $1', [id]);
  if (!fila) throw new ErrorApi(404, 'NOT_FOUND', 'Cliente no encontrado');
  return fila;
}

// GET /api/clientes/:id · detalle + las 30 variables (para el Simulador) + historial de contactos
rutasClientes.get('/:id', manejar(async (req, res) => {
  const f = await buscarCliente(req.params.id.toUpperCase());
  const contactos = await consulta(
    'SELECT id, note AS nota, created_at AS fecha FROM contacts WHERE customer_id = $1 ORDER BY created_at DESC',
    [f.customer_id],
  );
  res.json({
    ...aCliente(f),
    ciudad: f.city,
    ingresos: f.income_bracket,
    canal: f.shopping_channel,
    devoluciones: f.return_count,
    aperturaCorreo: f.email_open_rate,
    antiguedad: f.tenure_months,
    valorPedido: f.avg_order_value_usd,
    categoria: f.preferred_category_1,
    prediccion: f.churn_probability === null ? null : {
      probabilidad: f.churn_probability,
      etiqueta: f.churn_label,
      modelo: f.model_version,
      fecha: f.prediccion_fecha,
    },
    cupon: f.cupon_codigo ? {
      codigo: f.cupon_codigo, canal: f.cupon_canal, descuento: f.cupon_descuento,
      fecha: f.cupon_fecha, url: config.cupon.urlPublica + f.cupon_codigo,
    } : null,
    contactos,
    variables: Object.fromEntries(FEATURES.map((c) => [c, f[c]])),
  });
}));

// Descuento según la probabilidad: más riesgo, más descuento (10, 15 o 20 %).
function descuentoPara(probabilidad) {
  const [bajo, medio, alto] = config.cupon.descuentos;
  if (probabilidad >= 0.8) return alto ?? medio ?? bajo;
  if (probabilidad >= 0.65) return medio ?? bajo;
  return bajo;
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para no confundir
const nuevoCodigo = () => `${config.cupon.prefijo}-${Array.from({ length: 5 }, () => ALFABETO[crypto.randomInt(ALFABETO.length)]).join('')}`;

const aCupon = (c, yaExistia) => ({
  codigo: c.code,
  descuento: c.discount_percent,
  canal: c.channel,
  fecha: c.created_at,
  url: config.cupon.urlPublica + c.code,
  yaExistia,
});

// POST /api/clientes/:id/cupon  { "canal": "correo" | "qr" }
// Un cupón por cliente: si ya tiene uno, se devuelve el mismo.
rutasClientes.post('/:id/cupon', manejar(async (req, res) => {
  const canal = req.body?.canal;
  if (!['correo', 'qr'].includes(canal)) throw new ErrorApi(400, 'VALIDATION', 'El canal debe ser "correo" o "qr"');
  const cliente = await buscarCliente(req.params.id.toUpperCase());
  if (cliente.churn_probability === null) throw new ErrorApi(409, 'NO_PREDICTION', 'El cliente aún no tiene predicción');

  const [existente] = await consulta('SELECT * FROM coupons WHERE customer_id = $1', [cliente.customer_id]);
  if (existente) return res.json(aCupon(existente, true));

  for (let intento = 0; intento < 5; intento += 1) {
    try {
      const [nuevo] = await consulta(
        `INSERT INTO coupons (customer_id, code, discount_percent, channel, churn_probability, model_version)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [cliente.customer_id, nuevoCodigo(), descuentoPara(cliente.churn_probability), canal,
          cliente.churn_probability, cliente.model_version],
      );
      return res.status(201).json(aCupon(nuevo, false));
    } catch (error) {
      if (error.code !== '23505') throw error; // 23505 = valor repetido
      const [otro] = await consulta('SELECT * FROM coupons WHERE customer_id = $1', [cliente.customer_id]);
      if (otro) return res.json(aCupon(otro, true)); // dos clics al mismo tiempo
    }
  }
  throw new ErrorApi(500, 'COUPON_CODE', 'No se pudo generar un código único');
}));

// POST /api/clientes/:id/contactos  { "nota": "Llamada: ..." }
rutasClientes.post('/:id/contactos', manejar(async (req, res) => {
  const nota = String(req.body?.nota || '').trim();
  if (!nota) throw new ErrorApi(400, 'VALIDATION', 'Escribe una nota del contacto');
  if (nota.length > 500) throw new ErrorApi(400, 'VALIDATION', 'La nota admite máximo 500 caracteres');
  const cliente = await buscarCliente(req.params.id.toUpperCase());
  const [contacto] = await consulta(
    'INSERT INTO contacts (customer_id, note) VALUES ($1, $2) RETURNING id, note AS nota, created_at AS fecha',
    [cliente.customer_id, nota],
  );
  res.status(201).json(contacto);
}));
