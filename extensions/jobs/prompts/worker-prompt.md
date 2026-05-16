Job id: {{jobId}}
Attempt id: {{attemptId}}
Job name: {{jobName}}
Hard timeout: {{timeoutMs}} ms
Worker log path: {{workerLogPath}}
Job report path: {{reportPath}}

## Job prompt

{{jobPrompt}}

## Completion notes

Complete the assigned work first. Before finishing, leave a short visible plain-text assistant message in natural language. Do not use a fixed required format; include only useful context such as what changed, how you verified it, files intentionally left untouched, and any caveats.

You may write a short human-readable note to: {{workerLogPath}}
Make sure every required output artifact named in the job prompt above actually exists on disk.

The structured `job_report` tool and fallback `job-report.json` at {{reportPath}} are optional compatibility/audit artifacts only. They are not required by default and do not replace the visible final assistant text.
