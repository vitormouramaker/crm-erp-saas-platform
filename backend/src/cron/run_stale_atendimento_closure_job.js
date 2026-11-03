require("dotenv").config();

const {
  runStaleAtendimentoClosureJobCycle,
} = require("../jobs/stale_atendimento_closure_job");
const { runCronJob } = require("./run_job_helper");

void runCronJob({
  jobName: "stale-atendimento-closure",
  run: () => runStaleAtendimentoClosureJobCycle("cron"),
});
