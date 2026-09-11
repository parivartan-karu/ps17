Global Instruction

You are working on the existing Parivartan repository.

Treat the current repository as the source of truth for implementation details. Treat the Parivartan Roads and Garbage Production Implementation Plan as the target direction.

Before changing code:

1. Read the requested phase completely.
2. Inspect the relevant existing implementation before making assumptions.
3. Reuse existing components, APIs, types, AI agents, authorization helpers, Firebase utilities, workflow utilities, map infrastructure, analytics, and design patterns where appropriate.
4. Do not create duplicate systems when an existing implementation can be safely extended.
5. Preserve existing working functionality and backward compatibility where practical.
6. Do not redesign unrelated parts of the product.
7. Do not weaken existing authentication or authorization.
8. Use canonical departmentId as the authoritative department relationship.
9. Do not trust client-supplied role, department, worker eligibility, priority, SLA, assignment, or workflow state.
10. Keep deterministic code authoritative for security, SLA, escalation, status transitions, and worker eligibility.
11. AI output must remain validated before entering business logic.
12. Implement ONLY the requested phase.
13. Do not proceed to another phase unless explicitly instructed.

When finished:

- run the requested checks
- report files changed
- report checks and results
- report any compatibility decisions
- report unresolved risks or assumptions
- STOP