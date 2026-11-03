require("dotenv").config();

const { runBirthdayTemplateJobCycle } = require("../jobs/birthday_template_job");
const { runCronJob } = require("./run_job_helper");

void runCronJob({
  jobName: "birthday-template",
  run: () => runBirthdayTemplateJobCycle("cron"),
});
