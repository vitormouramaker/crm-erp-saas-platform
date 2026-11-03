require("dotenv").config();

const {
  runSalesFollowupTemplateJobCycle,
} = require("../jobs/sales_followup_template_job");
const { runCronJob } = require("./run_job_helper");

void runCronJob({
  jobName: "sales-followup-template",
  run: () => runSalesFollowupTemplateJobCycle("cron"),
});
