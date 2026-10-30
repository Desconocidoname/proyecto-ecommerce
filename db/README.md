# db

Scripts que PostgreSQL ejecuta automáticamente la **primera vez** que se crea la base de datos (carpeta `init/`, en orden alfabético).

**Responsable:** Rebeca Fields Gómez · **Respaldo:** Ángel De Anda Gómez

## Qué va aquí

- `init/01_schema.sql`: tablas (`customers`, `predictions`, `model_versions`, `coupons`, `contacts`) e índices.
- `init/02_load_customers.sql`: carga el CSV con `COPY customers FROM '/data/customers.csv' WITH (FORMAT csv, HEADER true, NULL '');`

`/data` es la carpeta `data/raw/` montada por Docker Compose. Para volver a ejecutar los scripts hay que borrar la base de datos: `docker compose down -v`.
