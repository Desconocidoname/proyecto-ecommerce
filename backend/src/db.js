import pg from 'pg';
import { config } from './config.js';

// PostgreSQL devuelve NUMERIC y BIGINT como texto para no perder precisión.
// En este proyecto los valores caben sin problema en un número de JavaScript.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // NUMERIC
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));   // BIGINT / COUNT(*)

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

export async function consulta(texto, parametros = []) {
  const { rows } = await pool.query(texto, parametros);
  return rows;
}

export async function transaccion(fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}
