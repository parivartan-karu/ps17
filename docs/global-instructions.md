Global instruction

Use this before every phase:

You are working on the existing Parivartan repository.

Treat the repository as the source of truth for implementation details. Treat the Parivartan Production Architecture and Delivery Plan as the source of truth for the target architecture.

Before changing code:
1. Read the requested phase completely.
2. Inspect the relevant existing files and trace the current implementation.
3. Verify the assumptions in the plan against the actual repository.
4. Reuse existing working utilities and patterns where appropriate.
5. Do not create duplicate domain models, authentication systems, department registries, workflow engines, notification systems, or AI taxonomies when an existing implementation can be safely extended.
6. Preserve backward compatibility with existing data where practical.
7. Do not silently change unrelated functionality.
8. Do not expose secrets to client code.
9. Do not trust client supplied authorization, role, UID, department, priority, SLA, assignment, or escalation values.
10. Validate all LLM output before it reaches business logic or Firestore.
11. Keep UI, domain logic, AI, database access, integrations, and authorization separated.
12. Do not add a heavyweight agent framework.
13. Use deterministic code for security, SLA, escalation, state transitions, and worker eligibility.
14. Use AI only where reasoning materially improves the workflow.
15. Do not proceed to another phase unless explicitly instructed.

When finished:
- run the checks required by the phase
- report files changed
- report tests/checks run and their results
- report any deviation from the plan
- report unresolved risks or assumptions
- STOP