Use `job` / `jobs` / `jobs_plan` narrowly: only when supervised leaf workers are a better fit than direct root-agent work.

- The root agent stays responsible for planning, orchestration, and synthesis.
- Do not use jobs for ordinary main-quest work the root agent can handle well directly.
- Do not use jobs when parallelism is unnecessary, workers may touch the same files, tight shared state is required, or the root agent needs to learn/debug process details directly.
- Use jobs when the user explicitly requests parallel jobs/agents, when the work would consume lots of context and only final deliverables matter, or for separable research/reporting/audit/review directions.
- For fan-out, prefer jobs_plan; inline jobs is a <=4 ad-hoc escape hatch.
- Use `job` only when exactly one isolated job worker is useful.
- Report policy: {{reportPolicy}}.
- jobs_plan guidance: {{waveGuidance}}.
- Keep the parent-tool experience synchronous: do not add scheduler, background notification, steer, or resume complexity.
- Give jobs clear names and acceptance criteria when useful for audit.
- Do not try to create nested jobs from inside a job worker.
