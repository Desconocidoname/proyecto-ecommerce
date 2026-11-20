// Pantalla Clientes (RF-04): búsqueda, 5 filtros, orden por columna y paginación de 20.
import React, { useState } from 'react';
import { api } from '../api.js';
import { DetalleCliente } from '../componentes/Opciones.jsx';
import {
  Banner, BarraProb, Buscador, COLOR_ESTADO, ColumnaOrden, Desplegable, ESTADOS, Encabezado,
  Paginador, dinero, num, useDatos,
} from '../componentes/ui.jsx';

const INICIAL = { q: '', pais: 'Todos', lealtad: 'Todos', segmento: 'Todos', estado: 'Todos', riesgo: 'Todos' };
const RIESGO = [{ valor: 'alto', texto: 'Alto' }, { valor: 'medio', texto: 'Medio' }, { valor: 'bajo', texto: 'Bajo' }];

export default function Clientes({ alCambiarAlertas }) {
  const [filtros, setFiltros] = useState(INICIAL);
  const [orden, setOrden] = useState({ k: 'prob', dir: 'desc' });
  const [pagina, setPagina] = useState(1);
  const [abierto, setAbierto] = useState(null);
  const { datos: opciones } = useDatos(() => api.opciones(), []);
  const { datos, error, cargando, recargar } = useDatos(
    () => api.clientes({ ...filtros, orden: orden.k, dir: orden.dir, pagina }),
    [JSON.stringify(filtros), orden.k, orden.dir, pagina],
  );

  const filtrar = (cambio) => { setFiltros({ ...filtros, ...cambio }); setPagina(1); };
  const ordenar = (o) => { setOrden(o); setPagina(1); };
  const activos = Object.entries(filtros).some(([k, v]) => v !== INICIAL[k]);
  const th = { orden, onOrden: ordenar };

  return (
    <div className="page">
      <Encabezado titulo="Clientes" subtitulo="Todos los clientes con su probabilidad de abandono" />
      {error && <Banner error>{error.message}</Banner>}
      <div className="card">
        <div className="toolbar">
          <Buscador valor={filtros.q} onCambio={(q) => filtrar({ q })} />
          {opciones && (
            <>
              <Desplegable etiqueta="País" valor={filtros.pais} opciones={opciones.paises} onCambio={(pais) => filtrar({ pais })} />
              <Desplegable etiqueta="Lealtad" valor={filtros.lealtad} opciones={opciones.lealtades} onCambio={(lealtad) => filtrar({ lealtad })} />
              <Desplegable etiqueta="Segmento" valor={filtros.segmento} opciones={opciones.segmentos} onCambio={(segmento) => filtrar({ segmento })} />
              <Desplegable etiqueta="Estado" valor={filtros.estado} opciones={opciones.estados.map((e) => ({ valor: e, texto: ESTADOS[e] || e }))} onCambio={(estado) => filtrar({ estado })} />
            </>
          )}
          <Desplegable etiqueta="Riesgo" valor={filtros.riesgo} opciones={RIESGO} onCambio={(riesgo) => filtrar({ riesgo })} />
          {activos && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFiltros(INICIAL); setPagina(1); }}>Limpiar</button>}
          <span className="spacer" />
          <span className="total">{datos ? `${num(datos.total)} clientes` : ''}</span>
        </div>
        <div className="tbl-wrap" style={{ opacity: cargando ? 0.55 : 1, transition: 'opacity .15s' }}>
          <table>
            <thead>
              <tr>
                <ColumnaOrden k="id" {...th}>Cliente</ColumnaOrden>
                <ColumnaOrden k="pais" {...th}>País</ColumnaOrden>
                <th>Segmento</th>
                <ColumnaOrden k="lealtad" {...th}>Lealtad</ColumnaOrden>
                <th>Estado</th>
                <ColumnaOrden k="gasto" {...th} derecha>Gasto total</ColumnaOrden>
                <ColumnaOrden k="valor" {...th} derecha>Valor (CLV)</ColumnaOrden>
                <ColumnaOrden k="satisfaccion" {...th} derecha>Satisfacción</ColumnaOrden>
                <ColumnaOrden k="prob" {...th}>Probabilidad de abandono</ColumnaOrden>
              </tr>
            </thead>
            <tbody>
              {datos?.items.map((c) => (
                <tr key={c.id} className="click" onClick={() => setAbierto(c.id)}>
                  <td className="id">{c.id}{c.cupon && <span className="tag-alert">Cupón</span>}</td>
                  <td>{c.pais}</td>
                  <td>{c.segmento}</td>
                  <td>{c.lealtad}</td>
                  <td><span className="chip"><i style={{ background: COLOR_ESTADO[c.estado] }} />{ESTADOS[c.estado]}</span></td>
                  <td className="r">{dinero(c.gasto)}</td>
                  <td className="r">{dinero(c.valor)}</td>
                  <td className="r">{c.satisfaccion}</td>
                  <td><BarraProb p={c.probabilidad} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {datos && datos.items.length === 0 && <div className="empty"><b>Sin resultados</b>Prueba con otros filtros.</div>}
        </div>
        {datos && datos.total > 0 && <Paginador pagina={datos.pagina} porPagina={datos.porPagina} total={datos.total} onCambio={setPagina} />}
      </div>
      {abierto && <DetalleCliente id={abierto} onCerrar={() => setAbierto(null)} onCambio={() => { recargar(); alCambiarAlertas(); }} />}
    </div>
  );
}
