const { postgres } = require("../server/connect");

async function runCronJob({ jobName, run }) {
  const startedAt = new Date();
  console.info(`[cron:${jobName}] inicio`, { started_at: startedAt.toISOString() });

  let exitCode = 0;

  try {
    await run();
    console.info(`[cron:${jobName}] fim`, {
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      status: "success",
    });
  } catch (error) {
    exitCode = 1;
    console.error(`[cron:${jobName}] erro fatal`, {
      message: error?.message || String(error),
      stack: error?.stack || null,
    });
  } finally {
    try {
      await postgres.end();
    } catch (closeError) {
      console.warn(`[cron:${jobName}] falha ao encerrar pool`, {
        message: closeError?.message || String(closeError),
      });
    }
  }

  process.exit(exitCode);
}

module.exports = {
  runCronJob,
};
