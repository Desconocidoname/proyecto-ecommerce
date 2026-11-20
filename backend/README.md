# backend

API principal en **Node.js + Express** (`/api/*`). Es el único servicio que consulta PostgreSQL y que llama al servicio de IA. El navegador llega a ella a través del Nginx del frontend.

**Responsable:** Rebeca Fields Gómez · **Respaldo:** Ángel De Anda Gómez

## Estructura

```
backend/
├── Dockerfile
├── package.json            ← express y pg (versiones fijas)
└── src/
    ├── index.js            ← arma la API y lanza la predicción masiva al iniciar
    ├── config.js           ← lee las variables de entorno (.env)
    ├── db.js               ← conexión a PostgreSQL (host "db")
    ├── ml.js               ← llamadas al servicio de IA (host "ml-service")
    ├── auth.js             ← inicio de sesión con cookie firmada (RF-07)
    ├── prediccion-masiva.js← 50,000 clientes en bloques de 2,000 (RF-08)
    ├── columnas.js         ← las 30 variables del modelo
    ├── errores.js          ← formato común de error
    └── rutas/
        ├── resumen.js      ← KPIs y gráficas con filtros (RF-03, RF-04)
        ├── clientes.js     ← Clientes, Alertas, detalle, cupones y contactos (RF-04, RF-06)
        ├── prediccion.js   ← Simulador, predicción masiva e info del modelo (RF-02, RF-08)
        ├── publico.js      ← cupón público para el QR (sin sesión)
        └── filtros.js      ← filtros seguros (parámetros $1, $2…) y regla de alerta
```

## Rutas

| Método y ruta | Sesión | Qué hace |
|---|---|---|
| `GET /api/health` | No | Estado de la base de datos y del servicio de IA |
| `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` | — | Inicio y cierre de sesión. 5 intentos fallidos bloquean 30 s |
| `GET /api/resumen?pais=&lealtad=` | Sí | 4 KPIs, Gráficas 1–3 y gráficas de alertas |
| `GET /api/clientes?q=&pais=&lealtad=&segmento=&estado=&riesgo=&orden=&dir=&pagina=` | Sí | Tabla de clientes, 20 por página |
| `GET /api/clientes/opciones` | Sí | Valores para los filtros |
| `GET /api/clientes/:id` | Sí | Detalle, predicción, cupón, contactos y las 30 variables |
| `GET /api/alertas?atencion=pendientes\|atendidos&q=&lealtad=&orden=prob\|valor&pagina=` | Sí | Clientes en alerta |
| `POST /api/clientes/:id/cupon` `{"canal": "correo" \| "qr"}` | Sí | Genera el cupón (uno por cliente) y devuelve su URL pública |
| `POST /api/clientes/:id/contactos` `{"nota": "..."}` | Sí | Registra un contacto |
| `POST /api/simulador` | Sí | Reenvía las 30 variables a `predecir()` |
| `POST /api/predicciones/ejecutar` | Sí | Predicción masiva de los 50,000 clientes |
| `GET /api/modelo` | Sí | Versión, métricas e importancia de variables |
| `GET /api/publico/cupon/:codigo` | **No** | Código, descuento y vigencia (sin datos personales). La usa la página `/cupon/:codigo` |

Errores: `{"error": {"code": "NOT_FOUND", "message": "Cliente no encontrado"}}`.

## Reglas de negocio

- **En alerta:** probabilidad ≥ `ALERT_THRESHOLD` **y** menos de 90 días sin comprar (cliente activo).
- **Nivel de riesgo:** alto ≥ umbral · medio ≥ 60 % del umbral · bajo el resto (igual que el servicio de IA).
- **Cupón:** uno por cliente, código `VUELVE-XXXXX` sin letras confusas (0/O, 1/I). Descuento según el riesgo: 20 % (≥ 0.80), 15 % (≥ 0.65) o 10 %. Vigencia de 30 días.
- **Predicción masiva al iniciar:** si no hay predicciones del modelo actual o si el modelo se reentrenó (cambia su fecha de entrenamiento).

## Cómo se prueba

```bash
docker compose up -d --build backend
docker compose logs -f backend          # debe decir "Predicción masiva: 50000 clientes..."
docker compose exec backend wget -qO- http://localhost:4000/api/health
```

## Reglas

- Todas las credenciales salen de variables de entorno (`config.js`). Si falta una obligatoria, el backend no arranca y dice cuál.
- Los valores del usuario nunca se pegan al SQL: siempre van como parámetros (`$1`, `$2`…). Las columnas de orden salen de una lista cerrada.
- Se conecta con los nombres de servicio `db` y `ml-service`, nunca con `localhost`.
