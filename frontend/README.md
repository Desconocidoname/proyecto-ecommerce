# frontend

Dashboard del administrador en **React + Vite**, servido con **Nginx** en `http://localhost:3000`. Incluye la página pública del cupón que abre el QR.

**Responsable:** David Mendoza Avalos · **Respaldo:** Rebeca Fields Gómez

## Rutas

| Ruta | Pantalla | Sesión |
|---|---|---|
| `/login` | Inicio de sesión y recuperación simulada (código en pantalla) | No |
| `/resumen` | 4 KPIs, Gráficas 1–3, gráficas de alertas, filtros de país y lealtad, botón «Ejecutar predicción» | Sí |
| `/clientes` | Tabla con búsqueda, filtros, orden por columna, paginación de 20 y panel de detalle | Sí |
| `/alertas` | Clientes en alerta, sin atender / con cupón, botón «Opciones» | Sí |
| `/simulador` | 8 controles, 3 clientes de ejemplo o por ID, Gráfica 4 (indicador) y Gráfica 5 (importancia) | Sí |
| `/cupon/:codigo` | **Página pública del cupón.** La abre el celular al escanear el QR | No |

## Estructura

```
frontend/
├── Dockerfile          ← etapa 1: compila con Node · etapa 2: sirve con Nginx
├── nginx.conf          ← reenvía /api/ a backend:4000 y manda las demás rutas a React
├── index.html
├── vite.config.js
└── src/
    ├── main.jsx · App.jsx      ← arranque, rutas y sesión
    ├── api.js                  ← única puerta hacia /api/*
    ├── estilos.css             ← sistema visual del prototipo (claro y oscuro)
    ├── componentes/            ← Iconos, ui (gráficas, filtros, paginador, ventanas) y Opciones
    └── pantallas/              ← Login, Resumen, Clientes, Alertas, Simulador y Cupon
```

## Cómo funciona el QR

1. En «Opciones → QR para tienda física», el backend crea el cupón y devuelve su URL: `COUPON_PUBLIC_URL` + código.
2. El frontend dibuja el QR con la librería `qrcode`.
3. El celular abre `/cupon/VUELVE-XXXXX`; Nginx entrega la aplicación y React muestra la página del cupón, que pide `GET /api/publico/cupon/VUELVE-XXXXX`.

Para que un celular lo abra, `COUPON_PUBLIC_URL` debe usar la IP de la computadora en la red Wi-Fi (por ejemplo `http://192.168.1.50:3000/cupon/`), no `localhost`.

## Desarrollo sin Docker (opcional)

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173 · /api se reenvía a localhost:4000
```

## Reglas

- Solo llama al backend (`/api/*`). Nada de lógica de IA ni acceso a la base de datos.
- La sesión vive en una cookie `HttpOnly` que pone el backend; el frontend no guarda contraseñas ni tokens.
- Referencia visual: el prototipo de Figma (enlace en el README principal).
