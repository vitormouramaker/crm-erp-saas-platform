require("dotenv").config();

const { runFinancialAlertSyncJobCycle } = require("../jobs/financial_alert_sync_job");
const { runCronJob } = require("./run_job_helper");

void runCronJob({
  jobName: "financial-alert-sync",
  run: runFinancialAlertSyncJobCycle,
});
