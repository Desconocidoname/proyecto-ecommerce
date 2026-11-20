// Piezas visuales reutilizables del dashboard.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Icono } from './Iconos.jsx';

// ---------- formato ----------
const nf = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
export const num = (v) => (v === null || v === undefined ? '—' : nf.format(v));
export const dinero = (v) => (v === null || v === undefined ? '—' : `$${nf.format(v)}`);
export const pct = (v, dec = 0) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(dec)} %`);
export const fecha = (v) => (v ? new Date(v).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const ESTADOS = { Active: 'Activo', 'At Risk': 'En riesgo', Dormant: 'Dormido', Inactive: 'Inactivo' };
export const COLOR_ESTADO = { Active: 'var(--s-active)', 'At Risk': 'var(--s-risk)', Dormant: 'var(--s-dormant)', Inactive: 'var(--s-inactive)' };
export const RIESGOS = { alto: 'Alto', medio: 'Medio', bajo: 'Bajo' };

// ---------- datos ----------
// Carga datos de la API y vuelve a cargar cuando cambian las dependencias.
export function useDatos(cargar, deps) {
  const [estado, setEstado] = useState({ datos: null, error: null, cargando: true });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let vigente = true;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    cargar()
      .then((datos) => vigente && setEstado({ datos, error: null, cargando: false }))
      .catch((error) => vigente && setEstado((e) => ({ ...e, error, cargando: false })));
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);
  return { ...estado, recargar: () => setVersion((v) => v + 1) };
}

// ---------- tema claro / oscuro ----------
export function useTema() {
  const [tema, setTema] = useState(document.documentElement.getAttribute('data-theme') || 'light');
  const cambiar = () => {
    const nuevo = tema === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nuevo);
    try { localStorage.setItem('tema', nuevo); } catch { /* sin almacenamiento */ }
    setTema(nuevo);
  };
  return [tema, cambiar];
}

// ---------- avisos (toasts) ----------
const ContextoAvisos = createContext(() => {});
export const useAviso = () => useContext(ContextoAvisos);
export function ProveedorAvisos({ children }) {
  const [avisos, setAvisos] = useState([]);
  const avisar = useCallback((texto) => {
    const id = Math.random();
    setAvisos((a) => [...a, { id, texto }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 3000);
  }, []);
  return (
    <ContextoAvisos.Provider value={avisar}>
      {children}
      <div className="toasts" aria-live="polite">
        {avisos.map((a) => <div key={a.id} className="toast"><Icono n="check" /><span>{a.texto}</span></div>)}
      </div>
    </ContextoAvisos.Provider>
  );
}

// ---------- estados de carga ----------
export const Cargando = () => <div className="loading"><span className="spinner" /></div>;
export function Banner({ error, children }) {
  return <div className={`banner${error ? ' error' : ''}`}><Icono n="info" /><span>{children}</span></div>;
}

// ---------- gráficas ----------
// Anima de 0 al valor real después de pintar.
function useAnimado() {
  const [listo, setListo] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setListo(true)); return () => cancelAnimationFrame(t); }, []);
  return listo;
}

export function Barras({ filas }) {
  const listo = useAnimado();
  const max = Math.max(1, ...filas.map((f) => f.clientes));
  return (
    <div className="bars">
      {filas.map((f) => (
        <div className="bar" key={f.nombre}>
          <span title={f.nombre}>{f.etiqueta ?? f.nombre}</span>
          <div className="t"><div className="f" style={{ width: listo ? `${(f.clientes / max) * 100}%` : 0 }} /></div>
          <b>{num(f.clientes)}</b>
        </div>
      ))}
    </div>
  );
}

export function Columnas({ filas }) {
  const listo = useAnimado();
  const max = Math.max(1, ...filas.map((f) => f.clientes));
  return (
    <div className="cols">
      {filas.map((f) => (
        <div className="col" key={f.nombre}>
          <b>{num(f.clientes)}</b>
          <div className="c" style={{ height: listo ? `${(f.clientes / max) * 78}%` : 0 }} />
          <span>{f.nombre}</span>
        </div>
      ))}
    </div>
  );
}

export function BarraProb({ p }) {
  if (p === null || p === undefined) return <span className="hint">Sin predicción</span>;
  const color = p >= 0.5 ? 'var(--accent)' : p >= 0.3 ? 'var(--lvl-mid)' : 'var(--lvl-lo)';
  return (
    <div className="prob">
      <div className="t"><div className="f" style={{ width: `${p * 100}%`, background: color }} /></div>
      <b>{Math.round(p * 100)}%</b>
    </div>
  );
}

// ---------- controles ----------
export function Desplegable({ etiqueta, valor, opciones, onCambio, sinTodos = false }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const cerrar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);
  const lista = sinTodos ? opciones : ['Todos', ...opciones];
  const texto = (v) => (typeof v === 'object' ? v.texto : v);
  const val = (v) => (typeof v === 'object' ? v.valor : v);
  const actual = lista.find((o) => val(o) === valor) ?? lista[0];
  return (
    <div className={`dd${abierto ? ' open' : ''}`} ref={ref}>
      <button type="button" className={`dd-btn${!sinTodos && valor !== 'Todos' ? ' active' : ''}`} onClick={() => setAbierto(!abierto)}>
        <span>{etiqueta}</span><b>{texto(actual)}</b><Icono n="chev" />
      </button>
      <div className="dd-menu" role="listbox">
        {lista.map((o) => (
          <button type="button" key={val(o)} className={val(o) === valor ? 'sel' : ''}
            onClick={() => { onCambio(val(o)); setAbierto(false); }}>
            {texto(o)}{val(o) === valor && <Icono n="check" />}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Buscador({ valor, onCambio, placeholder = 'Buscar por ID' }) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => { setTexto(valor); }, [valor]);
  useEffect(() => {
    const t = setTimeout(() => { if (texto !== valor) onCambio(texto); }, 300); // espera a que deje de escribir
    return () => clearTimeout(t);
  }, [texto]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <label className="search"><Icono n="search" />
      <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
  );
}

export function Paginador({ pagina, porPagina, total, onCambio }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const desde = total ? (pagina - 1) * porPagina + 1 : 0;
  const hasta = Math.min(total, pagina * porPagina);
  const visibles = [...new Set([1, pagina - 1, pagina, pagina + 1, paginas])].filter((p) => p >= 1 && p <= paginas).sort((a, b) => a - b);
  return (
    <div className="pager">
      <span>{num(desde)}–{num(hasta)} de {num(total)}</span>
      <div className="pages">
        <button type="button" disabled={pagina <= 1} onClick={() => onCambio(pagina - 1)} aria-label="Anterior">‹</button>
        {visibles.map((p, i) => (
          <React.Fragment key={p}>
            {i > 0 && p - visibles[i - 1] > 1 && <span>…</span>}
            <button type="button" className={p === pagina ? 'on' : ''} onClick={() => onCambio(p)}>{p}</button>
          </React.Fragment>
        ))}
        <button type="button" disabled={pagina >= paginas} onClick={() => onCambio(pagina + 1)} aria-label="Siguiente">›</button>
      </div>
    </div>
  );
}

export function Encabezado({ titulo, subtitulo, children }) {
  return (
    <div className="head">
      <div><h1>{titulo}</h1>{subtitulo && <p>{subtitulo}</p>}</div>
      {children && <div className="filters">{children}</div>}
    </div>
  );
}

export function ColumnaOrden({ k, orden, onOrden, children, derecha }) {
  const activa = orden.k === k;
  return (
    <th className={`sortable${activa ? ' sorted' : ''}${derecha ? ' r' : ''}`}
      onClick={() => onOrden({ k, dir: activa && orden.dir === 'desc' ? 'asc' : 'desc' })}>
      {children}<span className="arrow">{activa && orden.dir === 'asc' ? '↑' : '↓'}</span>
    </th>
  );
}

export function Modal({ onCerrar, children, ancho }) {
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [onCerrar]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal" role="dialog" aria-modal="true" style={ancho ? { maxWidth: ancho } : undefined}>{children}</div>
    </div>
  );
}
