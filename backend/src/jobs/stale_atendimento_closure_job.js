const { postgres } = require("../server/connect");
const execute = require("../services/execute_atendimento");
const { notifyChatUpdate } = require("../server/realtime");

const JOB_LOCK_KEY = 982451679;
const JOB_INTERVAL_MS = Math.max(
  Number(process.env.STALE_ATENDIMENTO_CLOSURE_JOB_INTERVAL_MS || 3600000) || 3600000,
  60000
);
const JOB_THRESHOLD_HOURS = Math.max(
  Number(process.env.STALE_ATENDIMENTO_CLOSURE_THRESHOLD_HOURS || 36) || 36,
  1
);
const JOB_ENABLED = String(
  process.env.STALE_ATENDIMENTO_CLOSURE_JOB_ENABLED || "true"
)
  .trim()
  .toLowerCase() !== "false";

let intervalRef = null;
let isRunning = false;

async function runStaleAtendimentoClosureJobCycle(trigger = "interval") {
  if (!JOB_ENABLED || isRunning) {
    return;
  }

  isRunning = true;
  let client = null;
  let locked = false;

  try {
    client = await postgres.connect();
    const lockRet = await client.query(
      "select pg_try_advisory_lock($1) as locked",
      [JOB_LOCK_KEY]
    );
    locked = Boolean(lockRet.rows?.[0]?.locked);

    if (!locked) {
      return;
    }

    const finalizedRows =
      await execute.execute_finalize_stale_atendimentos_by_last_customer_message(
        JOB_THRESHOLD_HOURS
      );

    finalizedRows.forEach((row) => {
      notifyChatUpdate({
        empresa_id: row.empresa_id,
        conversa_id: row.id,
        tipo: "status",
        origem: "atendimento:auto_close:stale_customer_message",
      });
    });

    if (finalizedRows.length) {
      console.info(
        `[stale-atendimento-closure-job] ${finalizedRows.length} atendimento(s) finalizado(s) por inatividade do cliente acima de ${JOB_THRESHOLD_HOURS}h.`
      );
    }
  } catch (error) {
    console.error(
      `[stale-atendimento-closure-job] erro no ciclo (${trigger}):`,
      error?.message || error
    );
  } finally {
    if (client && locked) {
      try {
        await client.query("select pg_advisory_unlock($1)", [JOB_LOCK_KEY]);
      } catch (unlockError) {
        console.warn(
          `[stale-atendimento-closure-job] falha ao liberar lock (${trigger}):`,
          unlockError?.message || unlockError
        );
      }
    }
    if (client) {
      client.release();
    }
    isRunning = false;
  }
}

function startStaleAtendimentoClosureJob() {
  if (!JOB_ENABLED || intervalRef) {
    return;
  }

  void runStaleAtendimentoClosureJobCycle("startup");
  intervalRef = setInterval(() => {
    void runStaleAtendimentoClosureJobCycle("interval");
  }, JOB_INTERVAL_MS);

  console.info(
    `[stale-atendimento-closure-job] iniciado com intervalo de ${JOB_INTERVAL_MS}ms e limite de ${JOB_THRESHOLD_HOURS}h.`
  );
}

module.exports = {
  startStaleAtendimentoClosureJob,
  runStaleAtendimentoClosureJobCycle,
};
