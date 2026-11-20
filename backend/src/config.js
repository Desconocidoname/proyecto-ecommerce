// Toda la configuración sale de variables de entorno (archivo .env).
// Nunca escribas contraseñas ni secretos en el código.

function obligatoria(nombre) {
  const valor = process.env[nombre];
  if (!valor) {
    console.error(`[ERROR] Falta la variable de entorno ${nombre}. Revisa tu archivo .env`);
    process.exit(1);
  }
  return valor;
}

const descuentos = (process.env.COUPON_DISCOUNTS || '10,15,20')
  .split(',')
  .map((d) => Number(d.trim()))
  .filter((d) => Number.isInteger(d))
  .sort((a, b) => a - b);

export const config = {
  puerto: Number(process.env.PORT || 4000),
  databaseUrl: obligatoria('DATABASE_URL'),
  mlServiceUrl: (process.env.ML_SERVICE_URL || 'http://ml-service:8000').replace(/\/$/, ''),
  umbralAlerta: Number(process.env.ALERT_THRESHOLD || 0.5),
  admin: {
    email: obligatoria('ADMIN_EMAIL').trim().toLowerCase(),
    password: obligatoria('ADMIN_PASSWORD'),
  },
  sessionSecret: obligatoria('SESSION_SECRET'),
  cupon: {
    prefijo: process.env.COUPON_PREFIX || 'VUELVE',
    descuentos,
    urlPublica: (process.env.COUPON_PUBLIC_URL || 'http://localhost:3000/cupon/').replace(/\/?$/, '/'),
  },
  // Si es "false", el backend no ejecuta la predicción masiva al arrancar.
  prediccionAlIniciar: process.env.PREDICT_ON_START !== 'false',
};

if (config.sessionSecret.length < 32 || config.sessionSecret.startsWith('genera_')) {
  console.warn('[WARN] SESSION_SECRET es corto o es el valor de ejemplo. Genera uno con: openssl rand -hex 32');
}
