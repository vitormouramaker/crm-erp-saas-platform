require("dotenv").config();

const { runNoReplyFollowupJobCycle } = require("../jobs/no_reply_followup_job");
const { runCronJob } = require("./run_job_helper");

void runCronJob({
  jobName: "no-reply-followup",
  run: runNoReplyFollowupJobCycle,
});
