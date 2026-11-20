// Rutas de la aplicación y sesión del administrador.
//   /cupon/:codigo  página pública del cupón (la abre el celular al escanear el QR)
//   /login          inicio de sesión
//   /resumen /clientes /alertas /simulador   dashboard (requiere sesión)
import React, { useCallback, useEffect, useState } from 'react';
import { api, cuandoExpireSesion } from './api.js';
import { Icono } from './componentes/Iconos.jsx';
import { Cargando, ProveedorAvisos, useAviso, useTema } from './componentes/ui.jsx';
import Login from './pantallas/Login.jsx';
import Resumen from './pantallas/Resumen.jsx';
import Clientes from './pantallas/Clientes.jsx';
import Alertas from './pantallas/Alertas.jsx';
import Simulador from './pantallas/Simulador.jsx';
import Cupon from './pantallas/Cupon.jsx';

const PANTALLAS = [
  { ruta: '/resumen', texto: 'Resumen', icono: 'grid', Componente: Resumen },
  { ruta: '/clientes', texto: 'Clientes', icono: 'users', Componente: Clientes },
  { ruta: '/alertas', texto: 'Alertas', icono: 'bell', Componente: Alertas },
  { ruta: '/simulador', texto: 'Simulador', icono: 'sliders', Componente: Simulador },
];

// Enrutador mínimo con la History API del navegador (sin librerías).
function useRuta() {
  const [ruta, setRuta] = useState(window.location.pathname);
  useEffect(() => {
    const alVolver = () => setRuta(window.location.pathname);
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, []);
  const navegar = useCallback((nueva, reemplazar = false) => {
    if (nueva === window.location.pathname) return;
    window.history[reemplazar ? 'replaceState' : 'pushState'](null, '', nueva);
    setRuta(nueva);
    window.scrollTo(0, 0);
  }, []);
  return [ruta, navegar];
}

function Panel({ ruta, navegar, usuario, onSalir }) {
  const [tema, cambiarTema] = useTema();
  const [menu, setMenu] = useState(false);
  const [alertas, setAlertas] = useState(null);
  const pantalla = PANTALLAS.find((p) => p.ruta === ruta) || PANTALLAS[0];
  const { Componente } = pantalla;

  const contarAlertas = useCallback(() => {
    api.alertas({ atencion: 'pendientes' }).then((d) => setAlertas(d.conteo.pendientes)).catch(() => {});
  }, []);
  useEffect(contarAlertas, [contarAlertas]);
  useEffect(() => { document.title = `${pantalla.texto} · Ecommerce`; setMenu(false); }, [pantalla]);

  const ir = (e, r) => { e.preventDefault(); navegar(r); };
  const inicial = usuario.slice(0, 2).toUpperCase();

  return (
    <div className="app">
      <aside className={`side${menu ? ' open' : ''}`}>
        <div className="brand"><Icono n="cart" />Ecommerce</div>
        <nav className="nav">
          {PANTALLAS.map((p) => (
            <a key={p.ruta} href={p.ruta} className={p === pantalla ? 'on' : ''} onClick={(e) => ir(e, p.ruta)}>
              <Icono n={p.icono} />{p.texto}
              {p.ruta === '/alertas' && alertas > 0 && <span className="count">{alertas.toLocaleString('es-MX')}</span>}
            </a>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="theme-row">
            <span>Modo oscuro</span>
            <button type="button" className="switch" role="switch" aria-checked={tema === 'dark'} aria-label="Modo oscuro" onClick={cambiarTema} />
          </div>
          <div className="user">
            <div className="avatar">{inicial}</div>
            <div style={{ minWidth: 0, flex: 1 }}><b>Administrador</b><span>{usuario}</span></div>
            <button type="button" className="icon-btn" onClick={onSalir} aria-label="Cerrar sesión" title="Cerrar sesión"><Icono n="out" /></button>
          </div>
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <div className="topbar">
          <button type="button" className="icon-btn" onClick={() => setMenu(!menu)} aria-label="Menú"><Icono n="menu" /></button>
          <div className="brand"><Icono n="cart" />Ecommerce</div>
          <button type="button" className="icon-btn" onClick={cambiarTema} aria-label="Cambiar tema"><Icono n={tema === 'dark' ? 'sun' : 'moon'} /></button>
        </div>
        <main className="main">
          <Componente key={pantalla.ruta} navegar={navegar} alCambiarAlertas={contarAlertas} />
        </main>
      </div>
    </div>
  );
}

function Aplicacion() {
  const [ruta, navegar] = useRuta();
  const [usuario, setUsuario] = useState(undefined); // undefined = revisando sesión
  const avisar = useAviso();
  const esCupon = ruta.startsWith('/cupon/');

  useEffect(() => {
    cuandoExpireSesion(() => setUsuario(null));
    if (esCupon) return;
    api.yo().then((d) => setUsuario(d.email)).catch(() => setUsuario(null));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirecciones: sin sesión -> /login; con sesión y ruta desconocida -> /resumen
  let destino = null;
  if (!esCupon && usuario === null && ruta !== '/login') destino = '/login';
  if (!esCupon && usuario && !PANTALLAS.some((p) => p.ruta === ruta)) destino = '/resumen';
  useEffect(() => { if (destino) navegar(destino, true); }, [destino, navegar]);

  if (esCupon) return <Cupon codigo={decodeURIComponent(ruta.slice('/cupon/'.length))} />;
  if (usuario === undefined || destino) return <Cargando />;
  if (!usuario) {
    return <Login onEntrar={(email) => { setUsuario(email); navegar('/resumen', true); avisar('Bienvenido, Administrador'); }} />;
  }

  const salir = async () => {
    await api.logout().catch(() => {});
    setUsuario(null);
  };
  return <Panel ruta={ruta} navegar={navegar} usuario={usuario} onSalir={salir} />;
}

export default function App() {
  return <ProveedorAvisos><Aplicacion /></ProveedorAvisos>;
}
