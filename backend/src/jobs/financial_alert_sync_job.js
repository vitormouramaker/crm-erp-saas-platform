const { postgres } = require("../server/connect");
const financeiro = require("../services/execute_financeiro");

const JOB_LOCK_KEY = 982451701;

async function runFinancialAlertSyncJobCycle() {
  const client = await postgres.connect();
  let locked = false;
  try {
    const lockRet = await client.query("select pg_try_advisory_lock($1) as locked", [
      JOB_LOCK_KEY,
    ]);
    locked = Boolean(lockRet.rows?.[0]?.locked);
    if (!locked) return { skipped: true, empresas_processadas: 0 };

    return await financeiro.execute_sincronizar_alertas_todas_empresas(client);
  } finally {
    try {
      if (locked) {
        await client.query("select pg_advisory_unlock($1)", [JOB_LOCK_KEY]);
      }
    } finally {
      client.release();
    }
  }
}

module.exports = { runFinancialAlertSyncJobCycle };
