// Pantalla Alertas (RF-04): clientes con probabilidad >= umbral, priorizados
// por probabilidad o por valor, con acceso directo a las Opciones de retención.
import React, { useLayoutEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Icono } from '../componentes/Iconos.jsx';
import { DetalleCliente, OpcionesModal } from '../componentes/Opciones.jsx';
import {
  Banner, BarraProb, Buscador, Desplegable, Encabezado, Paginador, dinero, num, useDatos,
} from '../componentes/ui.jsx';

const LEALTADES = ['Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Sin nivel'];
const ORDENES = [{ valor: 'prob', texto: 'Mayor probabilidad' }, { valor: 'valor', texto: 'Mayor valor (CLV)' }];

function Segmentado({ valor, opciones, onCambio }) {
  const ref = useRef(null);
  const [ind, setInd] = useState({ left: 3, width: 0 });
  useLayoutEffect(() => {
    const boton = ref.current?.querySelector('button.on');
    if (boton) setInd({ left: boton.offsetLeft, width: boton.offsetWidth });
  }, [valor, opciones]);
  return (
    <div className="seg" ref={ref}>
      <span className="ind" style={ind} />
      {opciones.map((o) => (
        <button type="button" key={o.valor} className={o.valor === valor ? 'on' : ''} onClick={() => onCambio(o.valor)}>
          {o.texto}{o.cuenta !== undefined && <em>{num(o.cuenta)}</em>}
        </button>
      ))}
    </div>
  );
}

export default function Alertas({ alCambiarAlertas }) {
  const [atencion, setAtencion] = useState('pendientes');
  const [q, setQ] = useState('');
  const [lealtad, setLealtad] = useState('Todos');
  const [orden, setOrden] = useState('prob');
  const [pagina, setPagina] = useState(1);
  const [detalle, setDetalle] = useState(null);
  const [opciones, setOpciones] = useState(null);
  const { datos, error, cargando, recargar } = useDatos(
    () => api.alertas({ atencion: atencion === 'todas' ? '' : atencion, q, lealtad, orden, dir: 'desc', pagina }),
    [atencion, q, lealtad, orden, pagina],
  );
  const cambio = () => { recargar(); alCambiarAlertas(); };
  const reiniciar = (fn) => (v) => { fn(v); setPagina(1); };
  const conteo = datos?.conteo;

  return (
    <div className="page">
      <Encabezado
        titulo="Alertas"
        subtitulo={datos ? `Clientes activos (menos de ${datos.diasActivo} días sin comprar) con probabilidad de abandono de ${Math.round(datos.umbral * 100)} % o más` : 'Clientes en riesgo de abandono'}
      />
      {error && <Banner error>{error.message}</Banner>}
      <div className="card">
        <div className="toolbar">
          <Segmentado valor={atencion} onCambio={reiniciar(setAtencion)} opciones={[
            { valor: 'pendientes', texto: 'Sin atender', cuenta: conteo?.pendientes },
            { valor: 'atendidos', texto: 'Con cupón', cuenta: conteo?.atendidos },
            { valor: 'todas', texto: 'Todas', cuenta: conteo?.total },
          ]} />
          <Buscador valor={q} onCambio={reiniciar(setQ)} />
          <Desplegable etiqueta="Lealtad" valor={lealtad} opciones={LEALTADES} onCambio={reiniciar(setLealtad)} />
          <span className="spacer" />
          <Desplegable etiqueta="Ordenar" valor={orden} opciones={ORDENES} sinTodos onCambio={reiniciar(setOrden)} />
        </div>
        <div className="tbl-wrap" style={{ opacity: cargando ? 0.55 : 1, transition: 'opacity .15s' }}>
          <table>
            <thead>
              <tr>
                <th>Cliente</th><th>País</th><th>Lealtad</th><th className="r">Valor (CLV)</th>
                <th className="r">Satisfacción</th><th className="r">Quejas</th><th>Probabilidad</th><th className="r">Acción</th>
              </tr>
            </thead>
            <tbody>
              {datos?.items.map((c) => (
                <tr key={c.id} className="click" onClick={() => setDetalle(c.id)}>
                  <td className="id">{c.id}</td>
                  <td>{c.pais}</td>
                  <td>{c.lealtad}</td>
                  <td className="r">{dinero(c.valor)}</td>
                  <td className="r">{c.satisfaccion}</td>
                  <td className="r">{c.quejas}</td>
                  <td><BarraProb p={c.probabilidad} /></td>
                  <td className="r" onClick={(e) => e.stopPropagation()}>
                    {c.cupon
                      ? <span className="btn btn-sm btn-sent"><Icono n="check" /> {c.cupon.codigo}</span>
                      : <button type="button" className="btn btn-sm btn-accent" onClick={() => setOpciones(c)}>Opciones</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {datos && datos.items.length === 0 && (
            <div className="empty"><b>{atencion === 'pendientes' ? 'Todo atendido' : 'Sin resultados'}</b>No hay alertas con estos filtros.</div>
          )}
        </div>
        {datos && datos.total > 0 && <Paginador pagina={datos.pagina} porPagina={datos.porPagina} total={datos.total} onCambio={setPagina} />}
      </div>
      {detalle && <DetalleCliente id={detalle} onCerrar={() => setDetalle(null)} onCambio={cambio} />}
      {opciones && <OpcionesModal cliente={opciones} onCerrar={() => setOpciones(null)} onCambio={cambio} />}
    </div>
  );
}
