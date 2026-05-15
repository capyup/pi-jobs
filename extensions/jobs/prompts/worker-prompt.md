Job id: {{jobId}}
Attempt id: {{attemptId}}
Job name: {{jobName}}
Worker log path: {{workerLogPath}}
Job report path: {{reportPath}}

## Job prompt

{{jobPrompt}}

## Completion notes

Complete the assigned work first. A structured report is useful audit evidence. If this job has no explicit acceptance contract, you must leave either a valid completed report or visible terminal completion text.

If convenient, call the `job_report` tool with the JSON shape below. If `job_report` is unavailable, you may write the same JSON to: {{reportPath}}
You may also write a short human-readable note to: {{workerLogPath}}
Make sure every required output artifact named in the job prompt above actually exists on disk.

If you cannot finish the work, prefer a report with status `partial`, `blocked`, or `error`, but do not fabricate completion evidence.

job-report.json shape:
{{reportExampleJson}}
