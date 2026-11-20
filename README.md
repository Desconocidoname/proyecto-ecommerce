# Retención: detección temprana de abandono de clientes en e-commerce

Dashboard web para el administrador de una tienda en línea. Un modelo de IA (Random Forest) estima la probabilidad de que cada cliente abandone la tienda, y el administrador lo retiene con un cupón por correo, un QR para tienda física o contactándolo.

**Equipo Ecommerce:** David Mendoza Avalos, Juan Daniel Ladino Hernández, Ángel De Anda Gómez y Rebeca Fields Gómez.

> **Regla del equipo:** solo se programa lo que está comprometido en la Entrega 2 (sección 7, *feature freeze*). Si algo no está ahí, se discute con el equipo antes de escribir código.

---

## Índice

1. [Documentación del proyecto](#1-documentación-del-proyecto)
2. [Cómo funciona el sistema](#2-cómo-funciona-el-sistema)
3. [Estructura del repositorio](#3-estructura-del-repositorio)
4. [Primeros pasos](#4-primeros-pasos)
5. [Variables de entorno y credenciales](#5-variables-de-entorno-y-credenciales)
6. [Flujo de trabajo con Git](#6-flujo-de-trabajo-con-git)
7. [Reglas técnicas que no se rompen](#7-reglas-técnicas-que-no-se-rompen)
8. [Responsables](#8-responsables)
9. [Si usas un asistente de IA](#9-si-usas-un-asistente-de-ia)

---

## 1. Documentación del proyecto

| Documento | Para qué sirve |
|---|---|
| `docs/entregas/Entrega2_Especificacion_Tecnica.pdf` | **Fuente de verdad.** Requerimientos (RF y RNF), gráficas, diccionario de datos, contrato de `predecir()`, métricas y alcance cerrado. |
| `docs/entregas/Entrega1_Diseno_Proyecto_IA.pdf` | Problema, usuario, función de la IA y ejemplo de uso. |
| [Prototipo en Figma](https://www.figma.com/design/XktQUA0B7MH64xGV8O1Iuo/Dashboard-de-retenci%C3%B3n-%E2%80%94-churn-ecommerce?node-id=0-1&t=9Kj84dosztA5bk5b-1) | Cómo se ve y se comporta cada pantalla. Presiona ▶ *Present* para recorrerlo. |
| `README.md` de cada carpeta | Qué hay en esa pieza y cómo se trabaja en ella. |

Si este README y la Entrega 2 dicen cosas distintas, manda la Entrega 2. Avisa al equipo para corregir este archivo.

## 2. Cómo funciona el sistema

```
Navegador ──► frontend (React) ──► backend (Node) ──► ml-service (FastAPI) ──► predecir()
                                        │
                                        ▼
                                  db (PostgreSQL) ◄── training (entrena el modelo)
```

- El **navegador** solo habla con el `frontend`. El `frontend` solo habla con el `backend`.
- El **backend** es el único que consulta la base de datos y el único que llama al servicio de IA.
- El **servicio de IA** carga el modelo entrenado y expone la función `predecir(datos_entrada) -> resultado`.
- El **entrenamiento** se ejecuta a mano: lee los clientes de la base de datos, entrena el Random Forest y guarda el modelo en `ml/models/`, carpeta que el servicio de IA lee en modo solo lectura.
- Todo corre con **Docker Compose** en una red interna. Solo el `frontend` se abre en `http://localhost:3000`.
- El QR de los cupones lleva a la **página pública del cupón**, que es una ruta del propio frontend (`/cupon/VUELVE-XXXXX`) y lee el cupón del backend (`GET /api/publico/cupon/:codigo`, sin sesión y sin datos personales).

**El modelo en una línea:** clasifica a cada cliente como «en riesgo» o «sin riesgo» con una probabilidad de 0 a 1. Un cliente aparece en Alertas si su probabilidad supera el umbral y lleva menos de 90 días sin comprar.

## 3. Estructura del repositorio

```
proyecto-ecommerce/
├── README.md            ← estás aquí
├── AGENTS.md            ← instrucciones para asistentes de IA
├── CLAUDE.md            ← apunta a AGENTS.md (para Claude Code)
├── docker-compose.yml   ← los 5 servicios y su red
├── .env.example         ← variables de entorno de ejemplo (sin secretos reales)
├── .gitignore
├── .github/
│   └── pull_request_template.md
├── frontend/            ← React + Vite, servido con Nginx          (David)
├── backend/             ← Node.js + Express, API /api/*            (Rebeca)
├── db/
│   └── init/            ← scripts SQL: tablas y carga del CSV      (Rebeca)
├── ml/
│   ├── training/        ← análisis, limpieza y train.py            (Juan Daniel)
│   ├── serving/         ← FastAPI con predecir()                   (Ángel)
│   └── models/          ← modelo entrenado (se versiona)
├── data/
│   ├── raw/             ← CSV original (se versiona)
│   └── processed/       ← train.csv y test.csv (se regeneran, no se suben)
└── docs/
    └── entregas/        ← PDFs de las entregas
```

## 4. Primeros pasos

### Requisitos

Git, Docker con Docker Compose y GitHub CLI (`gh`). En Arch Linux:

```bash
sudo pacman -S git github-cli docker docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker $USER   # luego cierra sesión y vuelve a entrar
gh auth login
```

### Instalación

```bash
git clone <URL del repositorio>     # cópiala del botón verde "Code" en GitHub
cd proyecto-ecommerce
```

1. **Variables de entorno:** `cp .env.example .env` y pide los valores reales al equipo (sección 5). Genera tu `SESSION_SECRET` con `openssl rand -hex 32`.
2. **Levantar el sistema:** `docker compose up -d --build`. La primera vez la base carga los 50,000 clientes y el backend calcula sus predicciones (menos de un minuto).
3. Abre `http://localhost:3000` y entra con `ADMIN_EMAIL` y `ADMIN_PASSWORD` de tu `.env`.

El CSV (`data/raw/customers.csv`) y el modelo entrenado (`ml/models/`) ya vienen en el repositorio.

### Comandos útiles

| Qué quieres hacer | Comando |
|---|---|
| Levantar todo en segundo plano | `docker compose up -d --build` |
| Ver el estado de los servicios | `docker compose ps` |
| Ver los registros de un servicio | `docker compose logs -f backend` |
| Entrenar el modelo | `docker compose run --rm --build --user "$(id -u):$(id -g)" training` |
| Usar el modelo nuevo (y recalcular las predicciones) | `docker compose restart ml-service backend` |
| Aplicar las vistas del dashboard a una base que ya existía | `docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < db/init/03_dashboard.sql` |
| Ver la red interna y sus contenedores | `docker network inspect churn-net` |
| Entrar a la base de datos | `docker compose exec db psql -U churn -d churn` |
| Apagar todo | `docker compose down` |
| Borrar la base de datos y recargar el CSV desde cero | `docker compose down -v && docker compose up -d` |

## 5. Variables de entorno y credenciales

Las contraseñas y claves **nunca** se escriben en el código ni se suben a GitHub.

| Archivo | Se sube a Git | Qué contiene |
|---|---|---|
| `.env.example` | Sí | Los **nombres** de todas las variables, con valores de ejemplo que no sirven en producción. |
| `.env` | **No** (está en `.gitignore`) | Los valores reales. Cada quien tiene el suyo en su computadora. |

**Reglas:**

1. Para empezar: `cp .env.example .env` y llena los valores.
2. Los valores reales que compartimos (la contraseña del administrador de la demo, por ejemplo) se pasan por la **bóveda compartida del equipo** en un gestor de contraseñas, nunca por WhatsApp, correo ni capturas de pantalla.
3. Si agregas una variable nueva, agrégala **también** a `.env.example` con un valor de ejemplo, en el mismo pull request.
4. El código lee las variables del entorno (`process.env.X` en Node, `os.environ["X"]` en Python). Docker Compose las pasa a cada servicio desde `.env`.
5. **Si un secreto se sube a GitHub por error:** avisa al equipo de inmediato y **cambia ese valor**. Borrar el commit no basta, porque el historial de Git lo conserva.
6. Antes de cada commit, revisa con `git status` que `.env` no aparezca.

## 6. Flujo de trabajo con Git

La rama `main` está protegida: nadie sube cambios directo. Todo entra por pull request con al menos una aprobación.

```bash
git checkout main && git pull                 # 1. parte siempre de main actualizado
git checkout -b feat/simulador-formulario      # 2. una rama por tarea
# ...trabajas y haces commits pequeños...
git push -u origin feat/simulador-formulario   # 3. sube tu rama
# 4. abre el pull request en GitHub y pide revisión a tu respaldo
```

**Nombres de ramas y commits** (formato *Conventional Commits*):

| Tipo | Uso | Rama | Commit |
|---|---|---|---|
| `feat` | Funcionalidad nueva | `feat/alertas-opciones` | `feat: agrega menú Opciones en alertas` |
| `fix` | Corrección | `fix/seed-loyalty-nulos` | `fix: reemplaza nulos de loyalty_tier por None` |
| `docs` | Documentación | `docs/readme-backend` | `docs: explica endpoints en el README del backend` |
| `chore` | Configuración | `chore/docker-compose` | `chore: agrega healthcheck a la base de datos` |
| `test` | Pruebas | `test/predecir-validacion` | `test: valida rangos de entrada en predecir` |

**Revisión cruzada:** Frontend ↔ Backend (comparten contratos de API) y Datos ↔ Servicio de IA (comparten el modelo).

## 7. Reglas técnicas que no se rompen

- **Contratos primero:** si cambias un endpoint, un campo o una tabla que otro usa, primero se acuerda con el equipo y se actualiza la documentación; después se programa.
- **Columnas prohibidas para el modelo** (fuga de datos): `days_since_last_purchase`, `activity_status`, `recency_score`, `frequency_score`, `rfm_score`, `rfm_category`, `purchase_frequency`, `behavior_segment`, `segment_category`, `churn_risk_score`, `churn_risk_category`, `customer_health_score` y `health_status`. Las columnas permitidas están en el diccionario de datos de la Entrega 2.
- **Variable objetivo:** `riesgo = 1` si `churn_risk_score >= 40`.
- **Reproducibilidad:** partición 80/20 estratificada con `random_state = 42`.
- **Meta del modelo:** F1 ≥ 0.66 en la clase «en riesgo», por encima de la regla manual `satisfaction_score <= 2` (F1 = 0.626).
- **Sin secretos en el código** (sección 5).
- **Datos y modelos fuera de Git:** `data/raw/`, `data/processed/` y `ml/models/` solo guardan su `.gitkeep`.

## 8. Responsables

| Integrante | Rol | Carpetas | Respaldo |
|---|---|---|---|
| David Mendoza Avalos | Requerimientos y UI | `frontend/` | Rebeca |
| Rebeca Fields Gómez | Backend y base de datos | `backend/`, `db/` | Ángel |
| Juan Daniel Ladino Hernández | Datos, preprocesamiento y entrenamiento | `ml/training/`, `data/` | Ángel |
| Ángel De Anda Gómez | Inferencia, integración y Docker | `ml/serving/`, `docker-compose.yml` | Juan Daniel |

## 9. Si usas un asistente de IA

Si programas con Claude Code, Cursor, Codex, Copilot u otro asistente, este debe leer `AGENTS.md` antes de hacer cambios. Ahí están las reglas del proyecto resumidas para la IA. Claude Code lo lee solo gracias a `CLAUDE.md`; con otras herramientas, pídele que lo lea al iniciar la sesión.

Lo que proponga una IA se revisa igual que el código de cualquier compañero: por pull request y con aprobación.
