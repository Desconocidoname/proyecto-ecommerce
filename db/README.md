# db

PostgreSQL ejecuta automáticamente los scripts de `init/`, en orden alfabético, **la primera vez** que se crea la base de datos (volumen vacío).

**Responsable:** Rebeca Fields Gómez · **Respaldo:** Ángel De Anda Gómez

## Scripts

| Archivo | Qué hace |
|---|---|
| `init/01_schema.sql` | Crea la tabla `customers` (copia fiel de las 53 columnas del CSV), las tablas del sistema (`model_versions`, `predictions`, `coupons`, `contacts`) y la vista `v_entrenamiento`. |
| `init/02_load_customers.sql` | Carga `data/raw/customers.csv` en `customers` y muestra cuántos clientes se cargaron. |

## Cómo se cargan los datos

1. Copia el CSV a `data/raw/customers.csv` (ese nombre exacto).
2. `docker compose up -d db`
3. Revisa la carga: `docker compose logs db | grep "Clientes cargados"` → debe decir **50000**.
4. Para volver a cargar desde cero: `docker compose down -v && docker compose up -d db`

## Detalles importantes

- **La tabla `customers` no se modifica:** guarda el CSV tal cual. Cualquier limpieza para la IA se hace en la vista, no en la tabla.
- **Los "nulos" del CSV son el texto `None`**, no celdas vacías: aparecen en `preferred_category_2`, `preferred_category_3`, `loyalty_tier` y `social_media_presence`. Se conservan como una categoría más.
- **`v_entrenamiento` es lo único que ve el modelo:** 30 columnas permitidas + `riesgo` (1 si `churn_risk_score >= 40`). Las columnas de fuga no están en la vista a propósito. Su lista debe coincidir con `ml/training/columnas.py`.
- Las restricciones `CHECK` (por ejemplo, satisfacción entre 1 y 5) rechazan datos fuera de rango al cargarlos.

## Consultas útiles

```sql
SELECT COUNT(*) FROM customers;                              -- 50000
SELECT riesgo, COUNT(*) FROM v_entrenamiento GROUP BY riesgo; -- 0: 37073 · 1: 12927
SELECT activity_status, COUNT(*) FROM customers GROUP BY 1;   -- para la Gráfica 1
```
