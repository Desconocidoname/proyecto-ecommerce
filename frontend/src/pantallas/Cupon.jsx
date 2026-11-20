// Página pública del cupón: /cupon/:codigo
// Es la que abre el celular del cliente al escanear el QR en la tienda física.
// No requiere sesión y solo muestra el código y el descuento (sin datos personales).
import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Icono } from '../componentes/Iconos.jsx';
import { Cargando } from '../componentes/ui.jsx';

export default function Cupon({ codigo }) {
  const [cupon, setCupon] = useState(null);
  const [error, setError] = useState(null);
  const [copiado, setCopiado] = useState('');

  useEffect(() => {
    document.title = 'Tu cupón · Ecommerce';
    api.cuponPublico(codigo).then(setCupon).catch(setError);
  }, [codigo]);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(cupon.codigo); setCopiado('Código copiado'); } catch { setCopiado('Mantén presionado el código para copiarlo'); }
  };

  if (!cupon && !error) return <Cargando />;

  return (
    <div className="cupon-pub">
      <main className="cupon-card">
        <div className="brand"><Icono n="cart" />Ecommerce</div>
        {error ? (
          <>
            <h1>Cupón no encontrado</h1>
            <p className="lead">Revisa que el enlace esté completo o pide un nuevo código en la tienda.</p>
          </>
        ) : (
          <>
            <h1>Te extrañamos, aquí tienes un <span className="hl">regalo</span></h1>
            <p className="lead">Un descuento especial para tu próxima compra.</p>
            <div className="pct">{cupon.descuento} %<small>de descuento</small></div>
            <div className="codigo">{cupon.codigo}</div>
            {cupon.vigente
              ? <button type="button" className="btn btn-primary btn-block" style={{ height: 44 }} onClick={copiar}>{copiado || 'Copiar código'}</button>
              : <div className="alert-box error"><Icono n="info" /><span>Este cupón ya venció.</span></div>}
            <ul className="pasos">
              <li><b>En tienda física:</b> muestra esta pantalla en caja.</li>
              <li><b>En línea:</b> pega el código al pagar.</li>
              <li><b>Vigencia:</b> hasta el {new Date(cupon.vence).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</li>
            </ul>
          </>
        )}
        <p className="hint" style={{ marginTop: 18, fontSize: 12 }}>Proyecto «Retención» · Equipo Ecommerce</p>
      </main>
    </div>
  );
}
