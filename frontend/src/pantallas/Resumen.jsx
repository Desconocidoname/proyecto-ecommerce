// Pantalla Resumen (RF-03): panorama de los clientes y de las alertas del modelo.
import React, { useState } from 'react';
import { api } from '../api.js';
import { Icono } from '../componentes/Iconos.jsx';
import {
  Banner, Barras, COLOR_ESTADO, Cargando, Columnas, Desplegable, ESTADOS, Encabezado,
  dinero, fecha, num, pct, useAviso, useDatos,
} from '../componentes/ui.jsx';

function Kpi({ etiqueta, valor, unidad, detalle, destacado }) {
  return (
    <div className={`card kpi${destacado ? ' destacado' : ''}`}>
      <div className="l">{etiqueta}</div>
      <div className="v">{valor}{unidad && <small>{unidad}</small>}</div>
      {detalle && <div className="d">{detalle}</div>}
    </div>
  );
}

function Grafica({ titulo, sub, children }) {
  return <div className="card chart"><h2>{titulo}</h2><div className="sub">{sub}</div>{children}</div>;
}

export default function Resumen({ alCambiarAlertas }) {
  const [filtros, setFiltros] = useState({ pais: 'Todos', lealtad: 'Todos' });
  const [ejecutando, setEjecutando] = useState(false);
  const avisar = useAviso();
  const { datos, error, cargando, recargar } = useDatos(() => api.resumen(filtros), [filtros.pais, filtros.lealtad]);

  const ejecutar = async () => {
    setEjecutando(true);
    try {
      const r = await api.ejecutarPrediccion();
      avisar(`${num(r.predicted)} clientes evaluados en ${(r.durationMs / 1000).toFixed(1)} s`);
      recargar();
      alCambiarAlertas();
    } catch (e) {
      avisar(e.message);
    } finally {
      setEjecutando(false);
    }
  };

  const filtrosUi = datos && (
    <>
      <Desplegable etiqueta="País" valor={filtros.pais} opciones={datos.opciones.paises} onCambio={(pais) => setFiltros({ ...filtros, pais })} />
      <Desplegable etiqueta="Lealtad" valor={filtros.lealtad} opciones={datos.opciones.lealtades} onCambio={(lealtad) => setFiltros({ ...filtros, lealtad })} />
    </>
  );

  if (!datos) {
    return (
      <div className="page">
        <Encabezado titulo="Resumen" subtitulo="Panorama general de los clientes de la tienda" />
        {error ? <Banner error>{error.message}</Banner> : <Cargando />}
      </div>
    );
  }

  const { kpis, modelo } = datos;
  const totalEstados = datos.porEstado.reduce((s, e) => s + e.clientes, 0) || 1;
  const sinPrediccion = kpis.tasaRiesgo === null;

  return (
    <div className="page" style={{ opacity: cargando ? 0.6 : 1, transition: 'opacity .2s' }}>
      <Encabezado titulo="Resumen" subtitulo="Panorama general de los clientes de la tienda">{filtrosUi}</Encabezado>
      {error && <Banner error>{error.message}</Banner>}

      <div className="grid kpis">
        <Kpi etiqueta="Clientes totales" valor={num(kpis.clientes)} detalle={`Gasto promedio ${dinero(kpis.gastoPromedio)}`} />
        <Kpi etiqueta="Inactivos" valor={num(kpis.inactivos)} detalle={`${pct(kpis.inactivos / (kpis.clientes || 1))} · 90 días o más sin comprar`} />
        <Kpi destacado etiqueta="En alerta" valor={num(kpis.alertas)} detalle={sinPrediccion ? 'Sin predicciones todavía' : 'Activos con riesgo alto'} />
        <Kpi etiqueta="Cupones enviados" valor={num(kpis.cuponesEnviados)} detalle={`Satisfacción promedio ${kpis.satisfaccion?.toFixed(1) ?? '—'} de 5`} />
      </div>

      <div className="grid charts wide">
        <Grafica titulo="Estado de actividad" sub="Según los días desde la última compra">
          <div className="stack">
            {datos.porEstado.map((e) => (
              <i key={e.nombre} style={{ flex: e.clientes / totalEstados, background: COLOR_ESTADO[e.nombre] }} />
            ))}
          </div>
          <div className="legend">
            {datos.porEstado.map((e) => (
              <div key={e.nombre}>
                <i style={{ background: COLOR_ESTADO[e.nombre] }} />
                <div><b>{num(e.clientes)}</b><span>{ESTADOS[e.nombre]} · {num(e.dias)} días en promedio</span></div>
              </div>
            ))}
          </div>
        </Grafica>
        <Grafica titulo="Segmento de cliente" sub="Tipo de cliente"><Barras filas={datos.porSegmento} /></Grafica>
        <Grafica titulo="Nivel de lealtad" sub="Programa de lealtad"><Barras filas={datos.porLealtad} /></Grafica>
      </div>

      <div className="head" style={{ marginTop: 16 }}>
        <div>
          <h1 style={{ fontSize: 28 }}>Riesgo de <span className="hl">abandono</span></h1>
          <p>
            {sinPrediccion
              ? 'Aún no hay predicciones. Ejecuta el modelo para calcular el riesgo de cada cliente.'
              : <>{num(kpis.enRiesgo)} clientes con riesgo alto ({pct(kpis.tasaRiesgo)}); {num(kpis.alertas)} siguen activos y están en alerta · valor en alerta {dinero(kpis.valorEnRiesgo)} · {num(kpis.alertasAtendidas)} atendidos</>}
          </p>
          {modelo && (
            <p className="hint" style={{ marginTop: 4 }}>
              Modelo {modelo.version} · F1 {modelo.f1?.toFixed(2)} · recall {modelo.recall?.toFixed(2)} · umbral {modelo.umbral} · última predicción {fecha(modelo.ultimaPrediccion)}
            </p>
          )}
        </div>
        <button type="button" className="btn btn-secondary" onClick={ejecutar} disabled={ejecutando}>
          {ejecutando ? <><span className="spinner" /> Evaluando clientes</> : <><Icono n="refresh" /> Ejecutar predicción</>}
        </button>
      </div>

      {!sinPrediccion && (
        <div className="grid charts">
          <Grafica titulo="Alertas por lealtad" sub="Clientes en alerta por nivel"><Barras tono="alerta" filas={datos.alertasPorLealtad} /></Grafica>
          <Grafica titulo="Alertas por satisfacción" sub="Calificación de 1 a 5"><Columnas tono="alerta" filas={datos.alertasPorSatisfaccion} /></Grafica>
          <Grafica titulo="Países con más alertas" sub="Los 6 países principales"><Barras tono="alerta" filas={datos.paisesConMasAlertas} /></Grafica>
        </div>
      )}
    </div>
  );
}
