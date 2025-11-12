import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config/env';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('Database');

let pool: Pool | null = null;

/**
 * Initialize database connection pool
 */
export async function initDatabase(): Promise<void> {
  if (pool) {
    logger.warn('Database pool already initialized');
    return;
  }

  logger.info('Initializing database connection...');

  pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 5000, // Timeout if connection takes longer than 5 seconds
  });

  // Test connection
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    logger.info(`✅ Database connected successfully at ${result.rows[0].now}`);
    client.release();
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }

  // Handle pool errors
  pool.on('error', (err) => {
    logger.error('Unexpected database pool error:', err);
  });
}

/**
 * Get database pool instance
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initDatabase() first.');
  }
  return pool;
}

/**
 * Execute a query
 */
export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await getPool().query<T>(text, params);
    const duration = Date.now() - start;
    logger.debug(`Query executed in ${duration}ms: ${text.substring(0, 100)}...`);
    return result;
  } catch (error) {
    logger.error(`Query error: ${text}`, error);
    throw error;
  }
}

/**
 * Get a client from the pool (for transactions)
 */
export async function getClient(): Promise<PoolClient> {
  return await getPool().connect();
}

/**
 * Close database pool (graceful shutdown)
 */
export async function closeDatabase(): Promise<void> {
  if (!pool) {
    return;
  }

  logger.info('Closing database connections...');
  await pool.end();
  pool = null;
  logger.info('Database connections closed');
}

/**
 * Execute a transaction
 */
export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
