// Única puerta de salida del frontend: todas las llamadas van a /api/* del
// backend. El frontend nunca habla con la base de datos ni con el servicio de IA.

export class ErrorApi extends Error {
  constructor(status, cuerpo) {
    super(cuerpo?.error?.message || 'No se pudo completar la operación');
    this.status = status;
    this.codigo = cuerpo?.error?.code;
    this.datos = cuerpo?.error || {};
  }
}

let alExpirar = () => {};
export const cuandoExpireSesion = (fn) => { alExpirar = fn; };

async function pedir(metodo, ruta, cuerpo) {
  let respuesta;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      credentials: 'same-origin',
      headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi(0, { error: { message: 'No hay conexión con el servidor' } });
  }
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    if (respuesta.status === 401 && !ruta.startsWith('/auth/login')) alExpirar();
    throw new ErrorApi(respuesta.status, datos);
  }
  return datos;
}

const consulta = (parametros) => {
  const limpio = Object.entries(parametros).filter(([, v]) => v !== '' && v !== null && v !== undefined && v !== 'Todos');
  return limpio.length ? `?${new URLSearchParams(limpio)}` : '';
};

export const api = {
  login: (email, password) => pedir('POST', '/auth/login', { email, password }),
  logout: () => pedir('POST', '/auth/logout'),
  yo: () => pedir('GET', '/auth/me'),
  resumen: (filtros) => pedir('GET', `/resumen${consulta(filtros)}`),
  clientes: (filtros) => pedir('GET', `/clientes${consulta(filtros)}`),
  opciones: () => pedir('GET', '/clientes/opciones'),
  cliente: (id) => pedir('GET', `/clientes/${encodeURIComponent(id)}`),
  alertas: (filtros) => pedir('GET', `/alertas${consulta(filtros)}`),
  cupon: (id, canal) => pedir('POST', `/clientes/${encodeURIComponent(id)}/cupon`, { canal }),
  contacto: (id, nota) => pedir('POST', `/clientes/${encodeURIComponent(id)}/contactos`, { nota }),
  simular: (variables) => pedir('POST', '/simulador', variables),
  ejecutarPrediccion: () => pedir('POST', '/predicciones/ejecutar'),
  modelo: () => pedir('GET', '/modelo'),
  cuponPublico: (codigo) => pedir('GET', `/publico/cupon/${encodeURIComponent(codigo)}`),
};
