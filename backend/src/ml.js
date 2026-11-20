// Cliente HTTP del servicio de IA. Usa el nombre del servicio en la red de
// Docker (ml-service), nunca localhost.
import { config } from './config.js';
import { ErrorApi } from './errores.js';

async function llamar(ruta, { metodo = 'GET', cuerpo, tiempoMs = 60000 } = {}) {
  let respuesta;
  try {
    respuesta = await fetch(`${config.mlServiceUrl}${ruta}`, {
      method: metodo,
      headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(tiempoMs),
    });
  } catch {
    throw new ErrorApi(503, 'ML_UNAVAILABLE', 'El servicio de IA no responde');
  }
  const datos = await respuesta.json().catch(() => ({}));
  return { status: respuesta.status, datos };
}

export async function saludIa() {
  try {
    const { status, datos } = await llamar('/health', { tiempoMs: 3000 });
    return status === 200 && datos.modelLoaded ? datos : null;
  } catch {
    return null;
  }
}

export async function infoModelo() {
  const { status, datos } = await llamar('/model/info');
  if (status !== 200) throw new ErrorApi(503, 'ML_NO_MODEL', datos.detail || 'El servicio de IA no tiene modelo');
  return datos;
}

// Un cliente (Simulador). Devuelve el contrato de predecir() tal cual.
export async function predecirUno(cliente) {
  const { status, datos } = await llamar('/predict', { metodo: 'POST', cuerpo: cliente, tiempoMs: 10000 });
  if (status === 422) {
    throw new ErrorApi(422, 'VALIDATION', datos.error, { campo: datos.campo, rango: datos.rango });
  }
  if (status !== 200) throw new ErrorApi(503, 'ML_ERROR', datos.error || 'El servicio de IA devolvió un error');
  return datos;
}

export async function predecirLote(clientes) {
  const { status, datos } = await llamar('/predict/lote', { metodo: 'POST', cuerpo: { clientes }, tiempoMs: 120000 });
  if (status !== 200) throw new ErrorApi(503, 'ML_ERROR', datos.detail || 'El servicio de IA devolvió un error');
  return datos;
}
