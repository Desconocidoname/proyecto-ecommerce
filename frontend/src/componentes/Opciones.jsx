// Detalle de un cliente y ventana de Opciones de retención (RF-06):
//   1. Cupón por correo      (el envío es simulado; el cupón sí se guarda)
//   2. QR para tienda física (abre /cupon/:codigo en el celular)
//   3. Contactar cliente     (registra una nota en el historial)
import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api.js';
import { Icono } from './Iconos.jsx';
import { BarraProb, Banner, Cargando, ESTADOS, Modal, RIESGOS, dinero, fecha, num, pct, useAviso, useDatos } from './ui.jsx';

function Codigo({ codigo }) {
  const avisar = useAviso();
  const copiar = async () => {
    try { await navigator.clipboard.writeText(codigo); avisar('Código copiado'); } catch { avisar('No se pudo copiar'); }
  };
  return (
    <div className="code">
      <b>{codigo}</b>
      <button type="button" className="btn btn-secondary btn-sm" onClick={copiar}><Icono n="copy" /> Copiar</button>
    </div>
  );
}

function CuponGenerado({ cliente, canal, onListo }) {
  const [cupon, setCupon] = useState(null);
  const [qr, setQr] = useState('');
  const [error, setError] = useState(null);
  const pedido = useRef(false);

  useEffect(() => {
    if (pedido.current) return; // evita pedirlo dos veces (React.StrictMode en desarrollo)
    pedido.current = true;
    api.cupon(cliente.id, canal)
      .then((c) => { setCupon(c); onListo(); })
      .catch(setError);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cupon && canal === 'qr') {
      QRCode.toDataURL(cupon.url, { width: 440, margin: 1, color: { dark: '#0c0a09', light: '#ffffff' } }).then(setQr);
    }
  }, [cupon, canal]);

  if (error) return <Banner error>{error.message}</Banner>;
  if (!cupon) return <Cargando />;

  return (
    <>
      {cupon.yaExistia && <Banner>Este cliente ya tenía un cupón ({cupon.canal}). Se muestra el mismo: solo hay uno por cliente.</Banner>}
      {canal === 'qr' ? (
        <>
          <div className="qr">{qr ? <img src={qr} alt={`Código QR del cupón ${cupon.codigo}`} /> : <Cargando />}</div>
          <p className="url">{cupon.url}</p>
          <Codigo codigo={cupon.codigo} />
          <div className="note">Muestra este QR en la tienda física. Al escanearlo, el celular abre la página del cupón con {cupon.descuento} % de descuento.</div>
          <div className="actions">
            <a className="btn btn-secondary" href={cupon.url} target="_blank" rel="noreferrer">Abrir página</a>
          </div>
        </>
      ) : (
        <>
          <div className="facts" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div><div className="k">Descuento</div><div className="v">{cupon.descuento} %</div></div>
            <div><div className="k">Riesgo del cliente</div><div className="v">{pct(cliente.probabilidad)}</div></div>
          </div>
          <Codigo codigo={cupon.codigo} />
          <div className="note">El envío es simulado: el cupón se genera y se guarda, pero no se manda correo al cliente.</div>
        </>
      )}
    </>
  );
}

function Contactar({ cliente, onListo }) {
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const avisar = useAviso();
  const guardar = async () => {
    if (!nota.trim()) { setError('Escribe qué se habló o qué se acordó'); return; }
    setGuardando(true);
    try {
      await api.contacto(cliente.id, nota.trim());
      avisar('Contacto registrado');
      onListo(true);
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
  };
  return (
    <>
      <div className="facts">
        <div><div className="k">Ciudad</div><div className="v" style={{ fontSize: 15 }}>{cliente.ciudad ?? cliente.pais}</div></div>
        <div><div className="k">Canal preferido</div><div className="v" style={{ fontSize: 15 }}>{cliente.canal ?? '—'}</div></div>
        <div><div className="k">Quejas</div><div className="v" style={{ fontSize: 15 }}>{cliente.quejas}</div></div>
        <div><div className="k">Satisfacción</div><div className="v" style={{ fontSize: 15 }}>{cliente.satisfaccion} de 5</div></div>
        <div><div className="k">Valor (CLV)</div><div className="v" style={{ fontSize: 15 }}>{dinero(cliente.valor)}</div></div>
        <div><div className="k">Días sin comprar</div><div className="v" style={{ fontSize: 15 }}>{num(cliente.dias)}</div></div>
      </div>
      <div className="note">El dataset no incluye teléfono ni correo del cliente: aquí se registra el contacto que haga la tienda por sus propios medios.</div>
      <div className="field" style={{ marginTop: 18 }}>
        <label htmlFor="nota">Nota del contacto</label>
        <textarea id="nota" className={`input${error ? ' err' : ''}`} maxLength={500} value={nota} autoFocus
          placeholder="Ej. Llamada: comentó que tuvo problemas con su último envío. Se le ofreció envío gratis."
          onChange={(e) => { setNota(e.target.value); setError(''); }} />
        <div className="msg">{error}</div>
        <div className="hint" style={{ textAlign: 'right' }}>{nota.length}/500</div>
      </div>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? <><span className="spinner" /> Guardando</> : 'Guardar contacto'}
        </button>
      </div>
    </>
  );
}

export function OpcionesModal({ cliente, onCerrar, onCambio }) {
  const [paso, setPaso] = useState('menu');
  const titulos = { menu: 'Opciones', correo: 'Cupón por correo', qr: 'QR para tienda física', contacto: 'Contactar cliente' };
  const opciones = [
    { paso: 'correo', icono: 'mail', titulo: 'Enviar cupón por correo', texto: 'Genera un código de descuento según su riesgo' },
    { paso: 'qr', icono: 'qr', titulo: 'QR para tienda física', texto: 'Muestra un QR que abre el cupón en el celular' },
    { paso: 'contacto', icono: 'phone', titulo: 'Contactar cliente', texto: 'Registra una llamada o mensaje en su historial' },
  ];
  return (
    <Modal onCerrar={onCerrar}>
      <div className="row-between" style={{ margin: 0, alignItems: 'flex-start' }}>
        <div>
          {paso !== 'menu' && <button type="button" className="back" style={{ marginBottom: 8 }} onClick={() => setPaso('menu')}><Icono n="left" /> Opciones</button>}
          <h3>{titulos[paso]}</h3>
          <div className="sub">{cliente.id} · {cliente.pais} · riesgo {pct(cliente.probabilidad)}</div>
        </div>
        <button type="button" className="icon-btn" onClick={onCerrar} aria-label="Cerrar"><Icono n="x" /></button>
      </div>
      {paso === 'menu' && (
        <div className="opciones">
          {opciones.map((o) => (
            <button type="button" key={o.paso} className="opcion" onClick={() => setPaso(o.paso)}>
              <span className="ic"><Icono n={o.icono} /></span>
              <span><b>{o.titulo}</b><span>{o.texto}</span></span>
            </button>
          ))}
        </div>
      )}
      {(paso === 'correo' || paso === 'qr') && <CuponGenerado cliente={cliente} canal={paso} onListo={onCambio} />}
      {paso === 'contacto' && <Contactar cliente={cliente} onListo={() => { onCambio(); onCerrar(); }} />}
    </Modal>
  );
}

export function DetalleCliente({ id, onCerrar, onCambio }) {
  const [opciones, setOpciones] = useState(false);
  const { datos: c, error, recargar } = useDatos(() => api.cliente(id), [id]);
  const cambio = () => { recargar(); onCambio?.(); };

  return (
    <>
      <div className="drawer-ov" onClick={onCerrar} />
      <aside className="drawer" role="dialog" aria-label={`Cliente ${id}`}>
        <div className="drawer-head">
          <div>
            <h3>{id}</h3>
            <div className="hint">{c ? `${c.ciudad}, ${c.pais} · ${c.segmento}` : ' '}</div>
          </div>
          <button type="button" className="icon-btn" onClick={onCerrar} aria-label="Cerrar"><Icono n="x" /></button>
        </div>
        <div className="drawer-body">
          {error && <Banner error>{error.message}</Banner>}
          {!c && !error && <Cargando />}
          {c && (
            <>
              <div className="big-prob">
                <div className="k hint">Probabilidad de abandono</div>
                <div className="v">{pct(c.probabilidad)}</div>
                <BarraProb p={c.probabilidad} />
                {c.riesgo && <div className="hint" style={{ marginTop: 6 }}>Riesgo {RIESGOS[c.riesgo].toLowerCase()} · modelo {c.prediccion?.modelo} · {fecha(c.prediccion?.fecha)}</div>}
              </div>
              <div className="dl">
                {[
                  ['Edad', `${c.edad} años`], ['Lealtad', c.lealtad], ['Estado', ESTADOS[c.estado]],
                  ['Días sin comprar', num(c.dias)], ['Compras', num(c.compras)], ['Gasto total', dinero(c.gasto)],
                  ['Valor del cliente', dinero(c.valor)], ['Satisfacción', `${c.satisfaccion} de 5`],
                  ['Quejas', num(c.quejas)], ['Devoluciones', num(c.devoluciones)],
                  ['Apertura de correos', pct(c.aperturaCorreo)], ['Canal', c.canal],
                ].map(([k, v]) => <div key={k}><div className="k">{k}</div><div className="v">{v}</div></div>)}
              </div>
              {c.cupon && (
                <div className="note">
                  Cupón <b>{c.cupon.codigo}</b> · {c.cupon.descuento} % · {c.cupon.canal === 'qr' ? 'QR' : 'correo'} · {fecha(c.cupon.fecha)}
                </div>
              )}
              <div>
                <div className="k hint">Historial de contacto</div>
                {c.contactos.length === 0
                  ? <p className="hint">Sin contactos registrados.</p>
                  : <div className="historial">{c.contactos.map((h) => <div key={h.id}>{h.nota}<small>{fecha(h.fecha)}</small></div>)}</div>}
              </div>
            </>
          )}
        </div>
        <div className="drawer-foot">
          <button type="button" className="btn btn-primary btn-block" disabled={!c || c.probabilidad === null} onClick={() => setOpciones(true)}>
            <Icono n="dots" /> Opciones
          </button>
        </div>
      </aside>
      {opciones && c && <OpcionesModal cliente={c} onCerrar={() => setOpciones(false)} onCambio={cambio} />}
    </>
  );
}
