require("dotenv").config();

const {
  runCommercialScheduledDispatchJobCycle,
} = require("../jobs/commercial_scheduled_dispatch_job");
const { runCronJob } = require("./run_job_helper");

void runCronJob({
  jobName: "commercial-scheduled-dispatch",
  run: () => runCommercialScheduledDispatchJobCycle("cron"),
});
