// Inicio de sesión del administrador (RF-07) con recuperación simulada.
import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Icono } from '../componentes/Iconos.jsx';
import { useTema } from '../componentes/ui.jsx';

const correoValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const leer = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const guardar = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* nada */ } };

function Tarjeta({ children, sacudir }) {
  const [tema, cambiarTema] = useTema();
  return (
    <div className="auth">
      <div className="auth-top">
        <button type="button" className="icon-btn" onClick={cambiarTema} aria-label="Cambiar tema"><Icono n={tema === 'dark' ? 'sun' : 'moon'} /></button>
      </div>
      <div>
        <div className={`auth-card${sacudir ? ' shake' : ''}`} key={sacudir}>
          <div className="brand"><Icono n="cart" />Ecommerce</div>
          {children}
        </div>
        <p className="auth-foot">Acceso solo para administradores de la tienda</p>
      </div>
    </div>
  );
}

function IniciarSesion({ onEntrar, onRecuperar }) {
  const [email, setEmail] = useState(leer('recordar'));
  const [password, setPassword] = useState('');
  const [ver, setVer] = useState(false);
  const [recordar, setRecordar] = useState(!!leer('recordar'));
  const [errores, setErrores] = useState({});
  const [mayus, setMayus] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [bloqueo, setBloqueo] = useState(0);
  const [sacudir, setSacudir] = useState(0);

  useEffect(() => {
    if (bloqueo <= 0) return undefined;
    const t = setTimeout(() => setBloqueo(bloqueo - 1), 1000);
    return () => clearTimeout(t);
  }, [bloqueo]);

  const enviar = async (e) => {
    e.preventDefault();
    const err = {};
    if (!correoValido(email.trim())) err.email = 'Escribe un correo válido';
    if (!password) err.password = 'Escribe tu contraseña';
    setErrores(err);
    if (Object.keys(err).length) { setSacudir(sacudir + 1); return; }
    setEnviando(true);
    try {
      const { email: correo } = await api.login(email.trim(), password);
      guardar('recordar', recordar ? email.trim() : '');
      onEntrar(correo);
    } catch (error) {
      setSacudir(sacudir + 1);
      if (error.codigo === 'LOCKED') setBloqueo(error.datos.segundos || 30);
      else if (error.codigo === 'BAD_CREDENTIALS' && error.datos.restantes === 0) setBloqueo(30);
      else if (error.codigo === 'BAD_CREDENTIALS') setErrores({ general: `${error.message}. Intentos restantes: ${error.datos.restantes}` });
      else setErrores({ general: error.message });
      setPassword('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Tarjeta sacudir={sacudir}>
      <h1>Panel de <span className="hl">retención</span></h1>
      <p className="lead">Inicia sesión con tu cuenta de administrador</p>
      {bloqueo > 0 && <div className="alert-box error"><Icono n="info" /><span>Demasiados intentos. Espera {bloqueo} s para volver a intentar.</span></div>}
      <form onSubmit={enviar} noValidate>
        <div className="field">
          <label htmlFor="email">Correo</label>
          <input id="email" className={`input${errores.email ? ' err' : ''}`} type="email" autoComplete="username"
            placeholder="admin@tienda.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={!email} />
          <div className="msg">{errores.email}</div>
        </div>
        <div className="field">
          <label htmlFor="pw">Contraseña</label>
          <div className="input-wrap">
            <input id="pw" className={`input${errores.password ? ' err' : ''}`} type={ver ? 'text' : 'password'} autoComplete="current-password"
              placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus={!!email}
              onKeyUp={(e) => setMayus(e.getModifierState?.('CapsLock'))} />
            <button type="button" className="icon-btn" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              <Icono n={ver ? 'eyeoff' : 'eye'} />
            </button>
          </div>
          <div className="msg" style={mayus && !errores.password ? { color: 'var(--muted)' } : undefined}>
            {errores.password || (mayus ? 'Bloq Mayús está activado' : '')}
          </div>
        </div>
        <div className="row-between">
          <label className="check"><input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} /> Recordarme</label>
          <button type="button" className="link" onClick={onRecuperar}>¿Olvidaste tu contraseña?</button>
        </div>
        {errores.general && <div className="msg" style={{ margin: '-10px 0 12px' }}>{errores.general}</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={enviando || bloqueo > 0}>
          {enviando ? <><span className="spinner" /> Verificando</> : 'Iniciar sesión'}
        </button>
      </form>
    </Tarjeta>
  );
}

// Recuperación simulada: el sistema tiene un solo administrador y su contraseña
// vive en el servidor (ADMIN_PASSWORD del .env), así que no se cambia desde aquí.
function Recuperar({ onVolver }) {
  const [paso, setPaso] = useState('correo');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [codigo] = useState(() => String(Math.floor(100000 + Math.random() * 900000)));
  const [digitos, setDigitos] = useState(Array(6).fill(''));
  const [sacudir, setSacudir] = useState(0);
  const cajas = useRef([]);

  const enviarCorreo = (e) => {
    e.preventDefault();
    if (!correoValido(email.trim())) { setError('Escribe un correo válido'); setSacudir(sacudir + 1); return; }
    setError('');
    setPaso('codigo');
  };

  const verificar = (lista) => {
    if (lista.join('') === codigo) setPaso('listo');
    else { setError('El código no es correcto'); setSacudir(sacudir + 1); setDigitos(Array(6).fill('')); cajas.current[0]?.focus(); }
  };

  const escribir = (i, valor) => {
    const d = valor.replace(/\D/g, '').slice(-1);
    const lista = digitos.map((x, j) => (j === i ? d : x));
    setDigitos(lista);
    if (d && i < 5) cajas.current[i + 1]?.focus();
    if (lista.every(Boolean)) verificar(lista);
  };

  if (paso === 'correo') return (
    <Tarjeta sacudir={sacudir}>
      <button type="button" className="back" onClick={onVolver}><Icono n="left" /> Volver</button>
      <h1>Recupera tu contraseña</h1>
      <p className="lead">Escribe el correo de tu cuenta y te enviaremos un código de verificación.</p>
      <form onSubmit={enviarCorreo} noValidate>
        <div className="field">
          <label htmlFor="r-email">Correo</label>
          <input id="r-email" className={`input${error ? ' err' : ''}`} type="email" value={email} autoFocus
            onChange={(e) => setEmail(e.target.value)} placeholder="admin@tienda.com" />
          <div className="msg">{error}</div>
        </div>
        <button className="btn btn-primary btn-block" type="submit">Enviar código</button>
      </form>
    </Tarjeta>
  );

  if (paso === 'codigo') return (
    <Tarjeta sacudir={sacudir}>
      <button type="button" className="back" onClick={() => setPaso('correo')}><Icono n="left" /> Cambiar correo</button>
      <h1>Revisa tu correo</h1>
      <p className="lead">Si <b>{email}</b> está registrado, recibirás un código de 6 dígitos.</p>
      <div className="alert-box"><Icono n="info" /><span>Demostración: no se envían correos. Tu código es <b>{codigo.slice(0, 3)} {codigo.slice(3)}</b>.</span></div>
      <form onSubmit={(e) => { e.preventDefault(); verificar(digitos); }} noValidate>
        <div className="code-boxes">
          {digitos.map((d, i) => (
            <input key={i} ref={(el) => { cajas.current[i] = el; }} inputMode="numeric" maxLength={1} value={d} autoFocus={i === 0}
              aria-label={`Dígito ${i + 1}`} onChange={(e) => escribir(i, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) cajas.current[i - 1]?.focus(); }} />
          ))}
        </div>
        <div className="msg">{error}</div>
        <button className="btn btn-primary btn-block" type="submit" style={{ marginTop: 16 }}>Verificar código</button>
      </form>
    </Tarjeta>
  );

  return (
    <Tarjeta>
      <div className="success-icon"><Icono n="bigcheck" /></div>
      <h1 className="center" style={{ marginTop: 20 }}>Identidad verificada</h1>
      <p className="lead center">
        Por seguridad, la contraseña del administrador se cambia en el servidor (variable <b>ADMIN_PASSWORD</b>).
        Pide al responsable del sistema que la actualice y reinicie el backend.
      </p>
      <button type="button" className="btn btn-primary btn-block" onClick={onVolver}>Volver a iniciar sesión</button>
    </Tarjeta>
  );
}

export default function Login({ onEntrar }) {
  const [recuperando, setRecuperando] = useState(false);
  return recuperando
    ? <Recuperar onVolver={() => setRecuperando(false)} />
    : <IniciarSesion onEntrar={onEntrar} onRecuperar={() => setRecuperando(true)} />;
}
