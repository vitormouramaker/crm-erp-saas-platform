const execute = require("../services/execute_commercial_scheduled_dispatch");

const JOB_TIMEZONE = "America/Sao_Paulo";
const JOB_INTERVAL_MS = Math.max(
  Number(process.env.COMMERCIAL_SCHEDULED_DISPATCH_JOB_INTERVAL_MS || 60000) || 60000,
  30000
);
const JOB_ENABLED = String(
  process.env.COMMERCIAL_SCHEDULED_DISPATCH_JOB_ENABLED || "true"
)
  .trim()
  .toLowerCase() !== "false";

let intervalRef = null;
let isRunning = false;

function getTimeZoneParts(date = new Date(), timeZone = JOB_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date).reduce((acc, item) => {
    if (item.type !== "literal") {
      acc[item.type] = item.value;
    }
    return acc;
  }, {});

  const year = Number(parts.year || 0);
  const month = Number(parts.month || 0);
  const day = Number(parts.day || 0);
  const hour = Number(parts.hour || 0);

  return {
    year,
    month,
    day,
    hour,
    dateIso: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`,
  };
}

async function runCommercialScheduledDispatchJobCycle(trigger = "interval") {
  if (!JOB_ENABLED || isRunning) {
    return;
  }

  isRunning = true;
  try {
    const nowParts = getTimeZoneParts(new Date(), JOB_TIMEZONE);
    const claimedSchedules = await execute.claimDueScheduledDispatches({
      dateIso: nowParts.dateIso,
      hour: nowParts.hour,
    });

    for (const schedule of claimedSchedules) {
      await execute.processClaimedScheduledDispatch(schedule);
    }
  } catch (error) {
    console.error(
      `[commercial-scheduled-dispatch-job] erro no ciclo (${trigger}):`,
      error?.message || error
    );
  } finally {
    isRunning = false;
  }
}

function startCommercialScheduledDispatchJob() {
  if (!JOB_ENABLED || intervalRef) {
    return;
  }

  void runCommercialScheduledDispatchJobCycle("startup");
  intervalRef = setInterval(() => {
    void runCommercialScheduledDispatchJobCycle("interval");
  }, JOB_INTERVAL_MS);

  console.info(
    `[commercial-scheduled-dispatch-job] iniciado com intervalo de ${JOB_INTERVAL_MS}ms em ${JOB_TIMEZONE}.`
  );
}

module.exports = {
  startCommercialScheduledDispatchJob,
  runCommercialScheduledDispatchJobCycle,
};
