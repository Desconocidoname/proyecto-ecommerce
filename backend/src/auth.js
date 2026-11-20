// Inicio de sesión del único administrador (RF-07).
// El correo y la contraseña vienen de ADMIN_EMAIL y ADMIN_PASSWORD (.env).
// La sesión es una cookie firmada con HMAC-SHA256 usando SESSION_SECRET:
// el navegador no puede alterarla sin que la firma deje de coincidir.
import crypto from 'node:crypto';
import { Router } from 'express';
import { config } from './config.js';
import { ErrorApi, manejar } from './errores.js';

const COOKIE = 'sesion';
const DURACION_MS = 8 * 60 * 60 * 1000; // 8 horas
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 30 * 1000;
const intentos = new Map(); // ip -> { fallos, hasta }

const firmar = (texto) => crypto.createHmac('sha256', config.sessionSecret).update(texto).digest('base64url');

// Compara sin filtrar información por el tiempo de respuesta.
function iguales(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function crearToken(email) {
  const datos = Buffer.from(JSON.stringify({ email, exp: Date.now() + DURACION_MS })).toString('base64url');
  return `${datos}.${firmar(datos)}`;
}

function leerToken(token) {
  if (!token || !token.includes('.')) return null;
  const [datos, firma] = token.split('.');
  if (!iguales(firma, firmar(datos))) return null;
  try {
    const sesion = JSON.parse(Buffer.from(datos, 'base64url').toString());
    return sesion.exp > Date.now() ? sesion : null;
  } catch {
    return null;
  }
}

function leerCookie(req, nombre) {
  const cabecera = req.headers.cookie || '';
  for (const parte of cabecera.split(';')) {
    const [clave, ...valor] = parte.trim().split('=');
    if (clave === nombre) return decodeURIComponent(valor.join('='));
  }
  return null;
}

function opcionesCookie(req) {
  const segura = req.secure || req.headers['x-forwarded-proto'] === 'https';
  return `Path=/; HttpOnly; SameSite=Lax${segura ? '; Secure' : ''}`;
}

// Middleware: deja pasar solo si hay una sesión válida.
export function requiereSesion(req, _res, next) {
  const sesion = leerToken(leerCookie(req, COOKIE));
  if (!sesion) return next(new ErrorApi(401, 'UNAUTHORIZED', 'Inicia sesión para continuar'));
  req.sesion = sesion;
  next();
}

export const rutasAuth = Router();

rutasAuth.post('/login', manejar(async (req, res) => {
  const ip = req.ip;
  const registro = intentos.get(ip) || { fallos: 0, hasta: 0 };
  if (registro.hasta > Date.now()) {
    const segundos = Math.ceil((registro.hasta - Date.now()) / 1000);
    throw new ErrorApi(429, 'LOCKED', `Demasiados intentos. Espera ${segundos} s`, { segundos });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) throw new ErrorApi(400, 'VALIDATION', 'Escribe tu correo y tu contraseña');

  const correcto = iguales(email, config.admin.email) & iguales(password, config.admin.password);
  if (!correcto) {
    registro.fallos += 1;
    if (registro.fallos >= MAX_INTENTOS) {
      registro.fallos = 0;
      registro.hasta = Date.now() + BLOQUEO_MS;
    }
    intentos.set(ip, registro);
    const restantes = registro.hasta > Date.now() ? 0 : MAX_INTENTOS - registro.fallos;
    throw new ErrorApi(401, 'BAD_CREDENTIALS', 'Correo o contraseña incorrectos', { restantes });
  }

  intentos.delete(ip);
  res.setHeader('Set-Cookie', `${COOKIE}=${crearToken(email)}; Max-Age=${DURACION_MS / 1000}; ${opcionesCookie(req)}`);
  res.json({ email });
}));

rutasAuth.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE}=; Max-Age=0; ${opcionesCookie(req)}`);
  res.json({ ok: true });
});

rutasAuth.get('/me', requiereSesion, (req, res) => {
  res.json({ email: req.sesion.email });
});
