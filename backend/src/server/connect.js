const { Pool } = require("pg");

let pool;
let nextClientDebugId = 1;

function getPoolConfig() {
  const maxConnections = Number(
    process.env.DB_POOL_MAX ||
      process.env.PG_POOL_MAX ||
      process.env.POSTGRES_POOL_MAX ||
      12
  );
  const idleTimeoutMillis = Number(process.env.DB_IDLE_TIMEOUT_MS || 10000);
  const connectionTimeoutMillis = Number(process.env.DB_CONNECTION_TIMEOUT_MS || 15000);
  const statementTimeout = Number(process.env.DB_STATEMENT_TIMEOUT_MS || 30000);
  const queryTimeout = Number(process.env.DB_QUERY_TIMEOUT_MS || 35000);

  return {
    user: process.env.DB_USER || "postgres",
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || "orbita_crm",
    password: process.env.DB_PASSWORD || "postgres",
    port: Number(process.env.DB_PORT || 5432),
    max: Number.isFinite(maxConnections) && maxConnections > 0 ? maxConnections : 12,
    idleTimeoutMillis:
      Number.isFinite(idleTimeoutMillis) && idleTimeoutMillis >= 0 ? idleTimeoutMillis : 10000,
    connectionTimeoutMillis:
      Number.isFinite(connectionTimeoutMillis) && connectionTimeoutMillis > 0
        ? connectionTimeoutMillis
        : 15000,
    allowExitOnIdle: true,
    statement_timeout:
      Number.isFinite(statementTimeout) && statementTimeout > 0 ? statementTimeout : 30000,
    query_timeout: Number.isFinite(queryTimeout) && queryTimeout > 0 ? queryTimeout : 35000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    application_name: process.env.DB_APPLICATION_NAME || "orbita_crm_api",
  };
}

const LONG_HELD_CLIENT_WARNING_MS = Number(
  process.env.DB_LONG_HELD_CLIENT_WARNING_MS || 15000
);

function isRecoverableConnectionError(err) {
  const code = String(err?.code || "").toUpperCase();
  const message = String(err?.message || "").toLowerCase();

  if (
    code === "ECONNRESET" ||
    code === "EPIPE" ||
    code === "ETIMEDOUT" ||
    code === "57P01"
  ) {
    return true;
  }

  return (
    message.includes("connection terminated unexpectedly") ||
    message.includes("terminating connection") ||
    message.includes("server closed the connection unexpectedly")
  );
}

function createPool() {
  const createdPool = new Pool(getPoolConfig());

  createdPool.on("error", (err) => {
    console.error("Erro inesperado no cliente PostgreSQL:", err);
  });

  return createdPool;
}

function getPool() {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

function getPoolSnapshot() {
  const activePool = getPool();
  return {
    totalCount: Number(activePool?.totalCount || 0),
    idleCount: Number(activePool?.idleCount || 0),
    waitingCount: Number(activePool?.waitingCount || 0),
    optionsMax: Number(activePool?.options?.max || 0),
  };
}

async function reconnectPool(reason = "unknown") {
  const oldPool = pool;
  pool = createPool();

  if (!oldPool) {
    console.warn(`[db] Pool PostgreSQL recriado (${reason}).`);
    return;
  }

  oldPool
    .end()
    .then(() => {
      console.warn(`[db] Pool PostgreSQL recriado (${reason}).`);
    })
    .catch((err) => {
      console.error("Erro ao encerrar pool PostgreSQL antigo:", err);
    });
}

const postgres = {
  query: (...args) => getPool().query(...args),
  connect: async (...args) => {
    try {
      const client = await getPool().connect(...args);
      let destroyOnRelease = false;
      const debugId = nextClientDebugId++;
      const acquiredAt = Date.now();
      const acquisitionStack = new Error(
        `[db] client acquired #${debugId}`
      ).stack;
      const longHeldTimer =
        Number.isFinite(LONG_HELD_CLIENT_WARNING_MS) &&
        LONG_HELD_CLIENT_WARNING_MS > 0
          ? setTimeout(() => {
              console.warn("[db] client held for too long", {
                debugId,
                heldMs: Date.now() - acquiredAt,
                pool: getPoolSnapshot(),
                stack: acquisitionStack,
              });
            }, LONG_HELD_CLIENT_WARNING_MS)
          : null;

      if (typeof longHeldTimer?.unref === "function") {
        longHeldTimer.unref();
      }

      const onClientError = (err) => {
        console.error("Erro inesperado no client PostgreSQL:", err);
        if (isRecoverableConnectionError(err)) {
          destroyOnRelease = true;
        }
      };

      client.on("error", onClientError);

      const release = client.release.bind(client);
      let released = false;
      client.release = (...releaseArgs) => {
        if (released) {
          return undefined;
        }
        released = true;
        if (longHeldTimer) {
          clearTimeout(longHeldTimer);
        }
        client.removeListener("error", onClientError);
        return release(
          destroyOnRelease ||
            releaseArgs[0] === true ||
            releaseArgs[0] instanceof Error
        );
      };

      return client;
    } catch (err) {
      const message = String(err?.message || "").toLowerCase();
      if (message.includes("timeout exceeded when trying to connect")) {
        console.error("[db] timeout acquiring client from pool", getPoolSnapshot());
      }
      throw err;
    }
  },
  end: async () => {
    if (!pool) return;
    await pool.end();
  },
  getPool,
};

pool = createPool();

async function shutdown() {
  if (pool) await pool.end();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

module.exports = {
  postgres,
  reconnectPool,
  getPoolConfig,
};
