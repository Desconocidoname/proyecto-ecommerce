// Simulador (RF-01, RF-02, RF-05): 8 controles principales; las otras 22
// variables se toman del cliente cargado. "Calcular riesgo" llama a predecir()
// a través del backend y muestra la Gráfica 4 (indicador con el umbral) y la
// Gráfica 5 (importancia de variables del modelo).
import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Banner, Barras, Encabezado, pct, useAviso, useDatos } from '../componentes/ui.jsx';

export const NOMBRES = {
  age: 'Edad', gender: 'Género', country: 'País', income_bracket: 'Ingresos', education_level: 'Escolaridad',
  employment_type: 'Empleo', marital_status: 'Estado civil', customer_segment: 'Segmento',
  tenure_months: 'Antigüedad (meses)', total_purchases: 'Compras totales', avg_order_value_usd: 'Valor por pedido (USD)',
  total_spent_usd: 'Gasto total (USD)', monetary_score: 'Puntaje monetario', preferred_category_1: 'Categoría 1',
  preferred_category_2: 'Categoría 2', preferred_category_3: 'Categoría 3', shopping_channel: 'Canal de compra',
  device_used: 'Dispositivo', payment_method: 'Método de pago', return_count: 'Devoluciones', complaint_count: 'Quejas',
  satisfaction_score: 'Satisfacción', loyalty_tier: 'Nivel de lealtad', email_open_rate: 'Apertura de correos',
  click_through_rate: 'Tasa de clics', conversion_rate: 'Conversión', engagement_level: 'Engagement',
  customer_lifetime_value_usd: 'Valor del cliente (CLV)', customer_acquisition_cost_usd: 'Costo de adquisición',
  customer_profitability_usd: 'Rentabilidad',
};

// Los 8 controles del RF-01 con sus límites (diccionario de datos, Entrega 2)
const CONTROLES = [
  { campo: 'satisfaction_score', min: 1, max: 5, paso: 1 },
  { campo: 'complaint_count', min: 0, max: 14, paso: 1 },
  { campo: 'return_count', min: 0, max: 19, paso: 1 },
  { campo: 'total_purchases', min: 0, max: 199, paso: 1 },
  { campo: 'total_spent_usd', min: 0, max: 198574, paso: 1 },
  { campo: 'tenure_months', min: 1, max: 119, paso: 1 },
  { campo: 'loyalty_tier', opciones: ['Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze', 'None'] },
  { campo: 'customer_segment', opciones: ['Consumer', 'Premium', 'Small Business', 'Enterprise'] },
];
const PRINCIPALES = new Set(CONTROLES.map((c) => c.campo));
const EJEMPLOS = [
  { id: 'CUST-013446', texto: 'Riesgo alto' },
  { id: 'CUST-025815', texto: 'Riesgo medio' },
  { id: 'CUST-002293', texto: 'Riesgo bajo' },
];

function errorDe(control, valor) {
  if (control.opciones) return valor ? null : 'Elige una opción';
  if (valor === '' || valor === null || Number.isNaN(Number(valor))) return 'Escribe un número';
  const n = Number(valor);
  if (n < control.min || n > control.max) return `Debe estar entre ${control.min} y ${control.max.toLocaleString('es-MX')}`;
  return null;
}

// Gráfica 4: barra 0–100 % con una marca vertical en el umbral de alerta
function Indicador({ p, umbral }) {
  const color = p >= umbral ? 'var(--accent)' : p >= umbral * 0.6 ? 'var(--lvl-mid)' : 'var(--lvl-lo)';
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ position: 'relative', height: 10, borderRadius: 9999, background: 'var(--track)' }}>
        <div style={{ width: `${p * 100}%`, height: '100%', borderRadius: 9999, background: color, transition: 'width .6s cubic-bezier(.2,.8,.2,1)' }} />
        <div title="Umbral de alerta" style={{ position: 'absolute', left: `${umbral * 100}%`, top: -5, bottom: -5, width: 2, borderRadius: 2, background: 'var(--ink)' }} />
      </div>
      <div className="hint" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12 }}>
        <span>0 %</span><span>Umbral {pct(umbral)}</span><span>100 %</span>
      </div>
    </div>
  );
}

export default function Simulador() {
  const [valores, setValores] = useState(null);
  const [origen, setOrigen] = useState('');
  const [idBuscar, setIdBuscar] = useState('');
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [tocados, setTocados] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const avisar = useAviso();
  const { datos: modelo } = useDatos(() => api.modelo(), []);

  const cargar = async (id, silencioso = false) => {
    const limpio = id.trim().toUpperCase();
    if (!limpio) return;
    setCargando(true);
    try {
      const c = await api.cliente(limpio);
      setValores(Object.fromEntries(Object.entries(c.variables).map(([k, v]) => [k, String(v)])));
      setOrigen(limpio);
      setResultado(null);
      setError(null);
      setTocados(false);
      if (!silencioso) avisar(`Datos de ${limpio} cargados`);
    } catch (e) {
      setError({ mensaje: e.message });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(EJEMPLOS[0].id, true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const errores = valores ? Object.fromEntries(CONTROLES.map((c) => [c.campo, errorDe(c, valores[c.campo])])) : {};
  const hayErrores = Object.values(errores).some(Boolean);

  const calcular = async (e) => {
    e.preventDefault();
    setTocados(true);
    if (hayErrores) return; // RNF-02: no se envía si hay campos fuera de rango
    setCalculando(true);
    setError(null);
    try {
      setResultado(await api.simular(valores));
    } catch (err) {
      setResultado(null);
      setError({ mensaje: err.message, campo: err.datos.campo, rango: err.datos.rango });
    } finally {
      setCalculando(false);
    }
  };

  const cambiar = (campo, valor) => setValores({ ...valores, [campo]: valor });
  const importancia = Object.entries(modelo?.ia?.importancia_variables || {})
    .slice(0, 10)
    .map(([campo, v]) => ({ nombre: campo, etiqueta: NOMBRES[campo] || campo, clientes: Math.round(v * 1000) / 10 }));

  return (
    <div className="page">
      <Encabezado titulo="Simulador" subtitulo="Prueba el modelo con un cliente y observa cómo cambia su riesgo al mover los controles">
        <div className="ejemplos">
          {EJEMPLOS.map((ej) => (
            <button type="button" key={ej.id} className={`btn btn-sm ${origen === ej.id ? 'btn-accent' : 'btn-secondary'}`}
              onClick={() => cargar(ej.id)} disabled={cargando} title={ej.texto}>{ej.id}</button>
          ))}
          <form onSubmit={(e) => { e.preventDefault(); cargar(idBuscar); }} style={{ display: 'flex', gap: 6 }}>
            <input className="input" style={{ height: 30, width: 150, borderRadius: 9999 }} placeholder="CUST-000000"
              value={idBuscar} onChange={(e) => setIdBuscar(e.target.value)} aria-label="ID de cliente" />
            <button type="submit" className="btn btn-secondary btn-sm" disabled={cargando}>Cargar</button>
          </form>
        </div>
      </Encabezado>

      <div className="sim">
        <div style={{ display: 'grid', gap: 16 }}>
          <form className="card sim-form" onSubmit={calcular} noValidate>
            {!valores ? <p className="hint">Cargando cliente…</p> : (
              <>
                <div className="sim-group">
                  <h2>Controles principales <span className="hint" style={{ fontWeight: 400 }}>· basado en {origen}</span></h2>
                  <div className="sim-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px 24px' }}>
                    {CONTROLES.map((c) => {
                      const err = (tocados || error?.campo === c.campo) && (errores[c.campo] || (error?.campo === c.campo && error.mensaje));
                      return (
                        <div key={c.campo}>
                          <label htmlFor={c.campo}>{NOMBRES[c.campo]}{c.max !== undefined && ` (${c.min}–${c.max.toLocaleString('es-MX')})`}</label>
                          {c.opciones ? (
                            <select id={c.campo} className={`input${err ? ' field-err' : ''}`} value={valores[c.campo]} onChange={(e) => cambiar(c.campo, e.target.value)}>
                              {c.opciones.map((o) => <option key={o} value={o}>{o === 'None' ? 'Sin nivel' : o}</option>)}
                            </select>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 10, alignItems: 'center' }}>
                              <input type="range" min={c.min} max={c.max} step={c.paso} value={Number(valores[c.campo]) || c.min}
                                onChange={(e) => cambiar(c.campo, e.target.value)} aria-label={NOMBRES[c.campo]} style={{ accentColor: 'var(--accent)' }} />
                              <input id={c.campo} className={`input${err ? ' field-err' : ''}`} type="number" min={c.min} max={c.max} step={c.paso}
                                value={valores[c.campo]} onChange={(e) => cambiar(c.campo, e.target.value)} />
                            </div>
                          )}
                          {err && <div className="msg">{err}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <details className="sim-group">
                  <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Otras 22 variables del cliente cargado</summary>
                  <div className="sim-grid" style={{ marginTop: 14 }}>
                    {Object.keys(valores).filter((k) => !PRINCIPALES.has(k)).map((k) => (
                      <div key={k}>
                        <label htmlFor={k}>{NOMBRES[k] || k}</label>
                        <input id={k} className={`input${error?.campo === k ? ' field-err' : ''}`} value={valores[k]} onChange={(e) => cambiar(k, e.target.value)} />
                      </div>
                    ))}
                  </div>
                </details>
                <div className="actions">
                  <button type="button" className="btn btn-ghost" onClick={() => cargar(origen, true)}>Restablecer</button>
                  <button type="submit" className="btn btn-primary" disabled={calculando}>
                    {calculando ? <><span className="spinner" /> Calculando</> : 'Calcular riesgo'}
                  </button>
                </div>
              </>
            )}
          </form>

          <div className="card chart">
            <h2>Importancia de variables</h2>
            <div className="sub">En qué se basa el modelo {modelo?.ia?.version} para estimar el riesgo (%)</div>
            {importancia.length ? <Barras filas={importancia} /> : <p className="hint" style={{ marginTop: 12 }}>El servicio de IA no respondió.</p>}
          </div>
        </div>

        <aside className="card sim-res" aria-live="polite">
          <div className="hint">Resultado del modelo</div>
          {error && !error.campo && <div style={{ marginTop: 14 }}><Banner error>{error.mensaje}</Banner></div>}
          {error?.campo && <div style={{ marginTop: 14 }}><Banner error>{error.mensaje}{error.rango ? ` (rango: ${error.rango})` : ''}</Banner></div>}
          {resultado ? (
            <>
              <div className="v">{pct(resultado.probabilidad_riesgo, 1)}</div>
              <span className={`lbl${resultado.prediccion === 1 ? ' alto' : ''}`}>{resultado.clase_etiqueta}</span>
              <Indicador p={resultado.probabilidad_riesgo} umbral={resultado.umbral} />
              <p className="hint" style={{ marginTop: 14 }}>
                {resultado.prediccion === 1
                  ? 'Supera el umbral: si el cliente sigue activo, aparecerá en Alertas y conviene ofrecerle un cupón o contactarlo.'
                  : 'No supera el umbral de alerta con estos datos.'}
              </p>
              <div className="meta">
                <div><span>Versión del modelo</span>{resultado.modelo_version}</div>
                <div><span>Umbral</span>{pct(resultado.umbral)}</div>
                <div><span>Confianza</span>{pct(resultado.confianza_o_score, 1)}</div>
                <div><span>Tiempo de respuesta</span>{resultado.tiempo_ms} ms</div>
              </div>
            </>
          ) : !error && (
            <>
              <div className="v" style={{ color: 'var(--stone)' }}>— %</div>
              <p className="hint">Mueve los controles y presiona «Calcular riesgo».</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
