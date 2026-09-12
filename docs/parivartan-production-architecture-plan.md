# Parivartan Production Architecture and Delivery Plan

## Project Context

Parivartan is being developed for **Kurukshetra 2.0 HACKFEST 2026, PS17: Multi-Agent Municipal Complaint Router with SLA Escalation**.

The official problem requires:

- Citizen complaint intake
- LLM/NLP classification
- Department routing
- Priority assignment
- Ticket management
- SLA configuration
- Reminders
- Escalation
- Citizen tracking
- Admin dashboard

### Product channels

**Citizen**
- PWA complaint submission
- WhatsApp AI chatbot
- Image and text based reporting
- AI extraction of complaint details and location
- Status tracking
- Completion notifications
- Feedback
- Optional reward points for verified resolved complaints

**Worker**
- PWA
- Receives Medium and High priority assignments
- Can select eligible Low priority tasks
- Sees ETA and SLA
- Uploads before and after evidence
- Updates work state
- Completes field work

**Department**
- One common login
- Authenticated users are routed dynamically according to `role` and `departmentId`
- Department dashboard and operations
- Worker management
- Complaint queue
- Assignment
- SLA visibility
- Performance and insights
- Roads and Garbage/Waste are the fully functional hackathon departments
- Streetlight and Water Supply are architecturally supported but can remain partially implemented for the hackathon

**Admin**
- City-level monitoring
- Unresolved, overdue, and escalated complaints
- Department performance
- Insights
- Overall system visibility
- Controlled overrides and configuration

### Core workflow

```text
Citizen / WhatsApp
        |
        v
AI Understanding
        |
        v
Classification
        |
        v
Priority
        |
        v
Department Routing
        |
        v
Ticket
        |
        v
Department Queue
        |
        v
Worker Assignment
        |
        v
Field Execution
        |
        v
SLA Monitoring
        |
        +----> Reminder
        |
        +----> Escalation
        |
        v
Resolution
        |
        v
Citizen Notification
        |
        v
Feedback / Reward
```

### Innovation pillars

1. WhatsApp AI chatbot as an alternative complaint channel
2. Multimodal complaint understanding
3. Multi-agent workflow
4. Department-centric operational ownership
5. SLA based proactive escalation
6. Before and after worker evidence
7. Transparent agent execution receipts
8. Optional civic reward system

### Technology

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- PWA
- Firebase Authentication
- Firestore
- Firebase Storage
- LLM and multimodal AI APIs
- Meta WhatsApp Cloud API and webhooks
- FCM push notifications
- Twilio where enabled
- Firebase for the initial build
- AWS planned for final deployment and presentation

### Architecture principles

1. Keep UI, domain logic, AI, data access, integrations, and authorization separated.
2. Use server-side RBAC and department-based authorization.
3. Never trust role, department, UID, priority, SLA, assignment, or escalation fields supplied by the client.
4. Use canonical `departmentId` for ownership.
5. Keep one common department login and dynamically route authenticated users by their verified role and department.
6. AI assists classification and reasoning. Deterministic code controls authorization, SLA, escalation, and state transitions.
7. Preserve working existing functionality while moving authoritative logic behind secure server boundaries.
8. Design the Firebase implementation so the domain layer can later move to AWS without rewriting the product.

## Delivery Strategy

The plan is deliberately split into implementation phases. The companion document `parivartan-agent-execution-prompts.md` contains the copy-pasteable prompts.

The coding agent must execute **only one phase per prompt**.

For every phase:

```text
Read phase
    ->
Inspect current repository
    ->
Identify actual implementation
    ->
Plan minimal safe changes
    ->
Implement only this phase
    ->
Typecheck / lint / tests
    ->
Manual verification
    ->
Report exact changes
    ->
STOP
```

Never ask the coding agent to execute all phases in one turn.

---

## 0. Repository Analysis - Current Reality

The repository was inspected before creating this plan.

### Current stack

- Next.js 16 + React 19 + TypeScript
- Firebase client SDK
- Firebase Admin SDK for server routes
- Firestore
- Firebase Authentication
- Genkit / Gemini integration
- Existing Groq fallback/LLM patterns
- FCM push notifications
- Twilio SMS
- Leaflet / map-based civic views
- Recharts analytics
- Tailwind + shadcn/Radix UI

The repository contains roughly 334 archived files, including 115 TSX files and 64 TypeScript files. The core application is already substantially built; this plan is therefore a **refactor + hardening + orchestration plan**, not a greenfield rewrite.

### Existing portals

The project already has separate surfaces for:

- `/citizen/*` - citizen experience
- `/dept/*` - department portal
- `/worker/*` - field worker experience
- `/smc/*` - central municipal/official experience

There is already a department concept in `User`, `Report`, constants, worker assignment, department dashboards, and department pages.

### Existing department configuration

The current application has these departments:

1. Engineering
2. Sanitation
3. Electrical
4. Water Supply
5. Parks & Environment
6. Traffic & Roads
7. Public Works

The current configuration also contains icons, descriptions, and role lists.

### Important existing architecture

The current `Report` already contains:

- `department`
- optional `departmentId`
- category
- priority
- assigned worker
- assignment history
- workflow stage
- duplicate/incident linking fields
- action log
- illegal-dumping data
- worker completion media

The `User` already contains:

- role
- department / departmentId
- designation
- skill type
- worker role
- contractor
- ward
- capacity / active tasks
- location
- FCM tokens

There is already a department portal that filters complaints and workers by `profile.department`.

There is already a worker API with server-side worker identity resolution.

There is already `requireRequestIdentity()` for bearer-token verification.

### Current critical gaps discovered

The current system is **department-aware but not department-secure**.

The most important architectural problems are:

1. `department` is often treated as a free-form string rather than a canonical relationship.
2. `departmentId` exists but is not consistently used as the authoritative key.
3. Department access is frequently implemented by client-side filtering rather than server-enforced authorization.
4. The `/dept` layout does not currently wrap the portal in the same `AuthGuard` used by citizen/worker/SMC layouts.
5. Some department actions call APIs that currently authorize a broad role but do not verify that the target report belongs to the caller's department.
6. Central SMC pages can directly mutate Firestore from the client in some places, while other operations use secure API routes. This creates inconsistent security boundaries.
7. The citizen report page currently performs AI analysis, workflow routing, worker selection, and report creation in the browser. Department assignment therefore happens before a trusted server boundary.
8. The citizen currently supplies a category even though category classification should be an AI/system responsibility after the citizen provides evidence and description.
9. Worker profile handling must not allow a worker to change authoritative fields such as department membership.
10. Worker assignment must verify the selected worker belongs to the target department and is actually a worker.
11. Status transitions are implemented in multiple places with slightly different rules.
12. There is no single authoritative complaint state machine.
13. There is currently no production-grade scheduled SLA monitor.
14. There is no durable, structured multi-agent execution receipt.
15. Existing duplicate detection is partly client-side / endpoint-based and should become one authoritative server pipeline.
16. Existing department names have legacy aliases such as `Road Maintenance Department`, `Solid Waste Management Department`, `Water & Drainage Department`, etc. These must be normalized rather than allowed to proliferate.
17. The repository does not currently contain Firestore security rules alongside the application. Production access control therefore needs to be explicitly designed and tested rather than assumed.
18. Notifications, status changes, worker assignment, and rewards are spread across several routes and should be made consistent through a controlled domain-event/action layer.
19. Existing AI classification is primarily image-oriented; text-only citizen complaints need a first-class classification path.
20. The current AI workflow has useful pieces, but it should become a typed pipeline rather than a collection of unrelated calls.

### Guiding principle

**Citizen → System/AI → Department → Worker → Citizen**

The citizen reports a problem.

The system determines what the problem is.

The system determines which department owns it.

The department owns operational handling.

The department assigns/queues the work.

The worker executes the field task.

The system enforces SLA and escalation.

The citizen receives transparent progress updates.

The central municipal officer/admin supervises the entire city.

---

# 1. Target Product Architecture

## 1.1 Role model

Use these roles as the authoritative application roles:

### `citizen`

Can:

- create complaints
- view only their own complaints
- view their own notifications
- rate completed work
- provide feedback
- use citizen chatbot/services
- view public/community features

Cannot:

- choose or modify authoritative department assignment
- assign workers
- change priority
- change status
- modify SLA
- access other citizens' complaints
- access department worker lists
- access internal AI logs beyond intentionally exposed citizen-safe summaries

### `worker`

Belongs to exactly one primary department.

Can:

- see tasks assigned to them
- accept/reject assignments where allowed
- update permitted task states
- upload before/after evidence
- add field notes
- update field location/status where supported
- view only the operational information necessary to perform assigned work

Cannot:

- change their department
- change priority
- reassign themselves across departments
- modify citizen identity
- alter SLA
- view unrelated department complaints
- modify another worker's tasks

### `department_head`

Belongs to one department.

Can:

- see complaints routed to their department
- manage department queue
- assign/reassign workers inside their department
- update operational status
- verify department-level work
- see department SLA performance
- see department workers
- see department escalation events
- communicate operationally with citizens through approved notification flows

Cannot:

- access unrelated department operational data
- change their own department
- manage global admin settings
- change another department's staff
- alter the authoritative audit history

### `official`

Central municipal officer role.

Can:

- view city-wide complaints
- inspect all departments
- verify/reassign/override complaints
- supervise departments
- inspect SLA/escalation metrics
- manage operational configuration where explicitly allowed

Should not be confused with a department head.

### `admin`

System administrator.

Can:

- manage users and roles
- create/disable departments
- assign department heads
- manage global configuration
- manage SLA defaults
- inspect audit/security events
- perform controlled overrides

---

# 2. Department Is a First-Class Domain Object

Do **not** treat a department as only a string.

Create a canonical department registry.

## Target `departments` collection

```ts
type Department = {
  id: string;                 // canonical stable ID
  code: string;               // e.g. ENGINEERING
  name: string;               // display name
  description: string;
  icon?: string;
  active: boolean;

  serviceCategories: string[];
  supportedIssueTypes: string[];

  headUserIds: string[];

  escalationChain: string[];
  defaultSlaProfile?: string;

  createdAt: string;
  updatedAt: string;
};
```

The existing seven departments should be migrated into this registry.

### Canonical IDs

Use stable IDs such as:

```text
dept_engineering
dept_sanitation
dept_electrical
dept_water
dept_parks
dept_traffic
dept_public_works
```

### Important

`Report.departmentId` becomes the authoritative relationship.

`Report.department` becomes a display/legacy field and should eventually be treated as derived data.

`User.departmentId` becomes the authoritative department membership.

`User.department` becomes a compatibility/display field.

Never compare department ownership using arbitrary display-name strings once this phase is complete.

---

# 3. Department Ownership Model

Every complaint must have a clear lifecycle:

```text
Citizen
   |
   v
System Intake
   |
   v
AI Classification
   |
   v
AI / Rule Routing
   |
   +----> Unassigned / Needs Review
   |
   v
Department Queue
   |
   v
Department Head
   |
   v
Worker Assignment
   |
   v
Field Execution
   |
   v
Verification
   |
   v
Resolved
```

The citizen does **not** own department assignment.

The department does **not** own classification.

The worker does **not** own priority/SLA.

The system owns routing and SLA calculation.

Humans retain override authority.

---

# 4. Citizen vs Department Responsibility Refactor

## Citizen should provide

- description
- photo/video evidence where supported
- location/GPS
- optional landmark
- optional urgency/context
- contact preference
- optional citizen-selected hint/category, if the UI keeps one - but it must be treated only as a hint

## Citizen should NOT determine

- final department
- final category
- priority
- SLA
- assigned worker
- escalation level
- internal verification state
- department queue

## System should determine

- normalized complaint
- final category
- department
- department ID
- priority
- duplicate relationship
- SLA
- initial workflow state
- worker eligibility

## Department should determine

- worker assignment
- operational acceptance
- field execution
- operational notes
- department-level verification
- reassignment within department

## Central official/admin should determine

- cross-department overrides
- exceptional reassignment
- global policy
- configuration
- final administrative intervention

---

# 5. Multi-Agent Architecture

The system should use eight logical agents.

```text
1. Intake / Normalizer
2. Classification
3. Routing
4. Priority / Severity
5. Duplicate / Dedup
6. SLA Assignment
7. SLA Monitor / Escalation
8. Citizen Communication
```

Agents 1-5 execute during complaint processing.

Agent 6 assigns deterministic SLA.

Agent 7 executes from a scheduled clock.

Agent 8 responds to system events.

### Important design rule

Not every agent should call an LLM.

Use LLMs where reasoning helps.

Use deterministic code where correctness matters.

In particular:

- SLA calculations → deterministic
- escalation → deterministic
- role authorization → deterministic
- department membership → deterministic
- status transitions → deterministic
- worker eligibility → deterministic
- notification delivery → deterministic infrastructure
- classification/routing/dedup reasoning → AI-assisted

---

# 6. Phase 0 - Department Foundation and Canonical Data Model

## Goal

Make department ownership a real domain concept before adding more AI.

## Implementation

### 1. Create/normalize department definitions

Create a single source of truth, preferably:

```text
src/lib/departments.ts
```

or an equivalent domain module.

It should expose:

- canonical department IDs
- names
- aliases
- descriptions
- issue categories
- roles
- default escalation chain
- active/inactive state

Do not duplicate department definitions in individual pages.

### 2. Extend types

Add:

```ts
Department
DepartmentMembership
DepartmentAccess
```

as needed.

Update `User`:

```ts
departmentId?: string;
department?: string; // compatibility/display only
```

Update `Report`:

```ts
departmentId?: string;
department?: string; // compatibility/display only

routingStatus?: 'pending' | 'assigned' | 'needs_review';
routingConfidence?: number;
routingReason?: string;
```

### 3. Add department metadata to workers

A worker must have:

```text
departmentId
designation
skillType
wardArea
activeTasks
maxTaskCapacity
isAvailable
```

### 4. Normalize aliases

Map existing values such as:

```text
Road Maintenance Department
Solid Waste Management Department
Water & Drainage Department
Electrical Department
Construction & Public Works Department
```

to canonical department IDs.

Do not delete legacy data blindly.

Create a migration/normalization utility.

### 5. Add seed/config support

Provide a deterministic department seed script or admin initialization path.

Do not require manually creating seven departments in Firestore every time.

## Acceptance criteria

- All seven existing departments have canonical IDs.
- Existing reports/workers can be mapped to canonical departments.
- No new feature creates arbitrary department strings.
- TypeScript compiles.
- Existing department pages still render.


---

# 7. Phase 1 - Security, Authentication, and Department Access Boundaries

## Goal

Make the department separation real.

This is more important than adding another AI agent.

## Required access matrix

| Resource | Citizen | Worker | Dept Head | Official | Admin |
|---|---|---|---|---|---|
| Own complaints | RW | - | - | R | R |
| Department complaints | - | Assigned only | Own dept | R | R |
| Worker list | - | - | Own dept | R | RW |
| Assign worker | - | - | Own dept | R/W | RW |
| Change status | - | Limited | Own dept | R/W | RW |
| SLA config | - | - | Own dept view | R | RW |
| Departments | - | Own membership | Own dept | R | RW |
| Escalations | Own complaint | Assigned | Own dept | All | All |
| AI internal logs | Safe summary only | Task-safe subset | Own dept | All | All |

## Critical rules

A role check alone is insufficient.

For a department head:

```text
role === department_head
AND
report.departmentId === identity.profile.departmentId
```

For a worker:

```text
role === worker
AND
report.assignedWorkerId === identity.uid
```

For an official/admin:

```text
global privileged access
```

### Department portal

Protect `/dept/*` with an auth guard.

### Worker profile

A worker must never be able to mutate:

- role
- departmentId
- department
- employeeId
- capacity
- assignment privileges

These are administrative fields.

### API boundary

All authoritative mutations should go through server API routes using Firebase Admin.

Do not trust client-supplied:

```text
departmentId
role
assignedBy
priority
slaDeadline
escalationLevel
```

The server derives them.

### Firestore security

Add/restore explicit Firestore rules and indexes as appropriate.

The rules must prevent:

- citizen reading another citizen's reports
- worker reading arbitrary reports
- worker editing department membership
- department head reading another department
- arbitrary clients writing SLA/escalation state


---

# 8. Phase 2 - Refactor Citizen Submission into a Thin Client

## Goal

The citizen page should collect evidence and submit it.

It should not be the trusted workflow engine.

### Current problem

The existing citizen report page performs:

- Gemini analysis
- workflow analysis
- department routing
- priority calculation
- worker selection
- report creation

inside the browser.

That is the wrong trust boundary.

## Target

```text
Citizen UI
   |
   | POST authenticated complaint payload
   v
Server submission endpoint
   |
   v
AI orchestrator
   |
   v
validated report object
   |
   v
Firestore transaction
```

The client may still run a lightweight pre-analysis for UX if useful, but it must never be authoritative.

## Citizen submission payload

Allow:

```ts
{
  description,
  location,
  roadName?,
  latitude?,
  longitude?,
  mediaDataUri?,
  citizenCategoryHint?
}
```

The server derives:

- category
- department
- departmentId
- priority
- SLA
- duplicate relation
- workflow stage
- assignment eligibility


---

# 9. Phase 3 - Intake, Classification, Routing, Priority, Dedup Agents

## Goal

Build the intelligent triage pipeline.

### Agent 1 - Intake / Normalizer

Input:

```text
raw citizen text
optional location
optional media
```

Output:

```ts
{
  cleanedDescription,
  mentionedLocation,
  urgencySignals,
  extractedIssueHints
}
```

### Agent 2 - Classification

Must support:

- text-only complaints
- image complaints
- text + image

Use the existing category taxonomy first.

Do not invent incompatible categories.

The taxonomy should eventually become data-driven, but preserve current categories during the migration.

### Agent 3 - Routing

Return:

```ts
{
  departmentId,
  department,
  confidence,
  reasoning,
  routingPath
}
```

Routing should use:

1. deterministic category mapping where unambiguous
2. AI only for ambiguous cases
3. canonical department IDs
4. safe `needs_review` fallback

### Agent 4 - Priority

Use:

- severity
- urgency language
- evidence confidence
- nearby complaint density
- historical recurrence
- issue category

Return:

```text
Low / Medium / High / Critical
```

### Agent 5 - Dedup

Search recent open reports using:

- same/compatible category
- geographic proximity
- recent time window

Then use AI similarity only on a small candidate set.

Return:

```ts
{
  isDuplicate,
  linkedIncidentId,
  linkedMatchType,
  linkedSimilarityScore
}
```

Do not silently discard the citizen complaint.

A duplicate should preserve the citizen report as a related report.

---

# 10. Agent Receipts / Auditability

Every agent invocation must produce a structured receipt.

Do not store unlimited raw prompts/responses in production.

Use:

```ts
type AgentLogEntry = {
  agent: string;
  status: 'success' | 'fallback' | 'error';
  timestamp: string;
  model?: string;
  inputSummary?: string;
  outputSummary?: string;
  latencyMs?: number;
  confidence?: number;
  reasoning?: string;
}
```

Avoid storing sensitive data unnecessarily.

For the hackathon UI, show concise summaries.


---

# 11. Phase 4 - Orchestrator + Department Queue

## Goal

Connect the triage agents and make the department the operational owner.

### Orchestrator

```text
Intake
  ↓
Classification
  ↓
Routing
  ↓
Priority
  ↓
Dedup
  ↓
SLA Assignment
  ↓
Department Queue
```

The orchestrator returns a validated domain object.

### Department queue

Every routed report should enter:

```text
departmentId
queueStatus
queuePosition
queuedAt
```

Possible queue states:

```text
pending_department
accepted_by_department
assigned_worker
in_progress
pending_verification
completed
```

### Important

A report routed to a department should **not automatically become assigned to a worker** unless the product explicitly decides that the department's auto-assignment policy permits it.

The safer default:

```text
AI routes → Department queue → Department assigns worker
```

For low-risk cases, optional auto-assignment can happen using deterministic worker eligibility.


---

# 12. Phase 5 - SLA Assignment and Deterministic Workflow State Machine

## Goal

Make SLA a real domain primitive.

### `slaConfig`

Use:

```text
priority
responseHours
resolutionHours
reminderBeforeBreachHours
escalationChain
```

Optionally support department-specific overrides:

```text
departmentId + priority
```

with global priority defaults.

### Report SLA fields

```ts
slaResponseDeadline
slaDeadline
slaBreached
escalationLevel
lastReminderSentAt
```

### State machine

Create one authoritative transition map.

No route should invent its own transitions.

Example:

```text
Submitted
  → Under Verification
  → Rejected

Under Verification
  → Department Queue
  → Rejected

Department Queue
  → Assigned
  → Rejected

Assigned
  → In Progress
  → Rejected

In Progress
  → Pending Verification
  → Assigned

Pending Verification
  → Resolved
  → In Progress
  → Rejected

Resolved
  → terminal

Rejected
  → terminal
```

Adapt this to existing UI/status compatibility rather than breaking existing reports.


---

# 13. Phase 6 - Worker Operations and Department Execution

## Goal

Turn the department portal into a true operational command center.

### Department dashboard should show

- incoming queue
- unassigned complaints
- assigned complaints
- in-progress work
- near-SLA-breach cases
- breached cases
- available workers
- busy workers
- department workload
- average resolution time
- worker capacity
- recent escalations

### Department complaint detail

Show:

- citizen-safe complaint information
- evidence
- AI triage summary
- department ownership
- SLA countdown
- duplicate/incident context
- queue state
- assignment history
- eligible workers
- current worker
- action timeline
- escalation status

### Worker assignment

Department head can assign:

```text
only worker.role === worker
AND worker.departmentId === report.departmentId
AND worker is active
AND worker has capacity
```

### Worker should receive

- task
- location
- issue
- evidence
- priority
- SLA information necessary for execution
- notes
- before/after evidence controls

### Worker should NOT receive

- unnecessary citizen private information
- internal AI prompt content
- unrelated complaints
- other departments' queues


---

# 14. Phase 7 - SLA Monitor, Escalation, and Communication

## Goal

Make automated escalation real.

This is the most important missing production behavior.

### Cron

Create:

```text
/api/cron/sla-monitor
```

Run every 15 minutes.

Protect it with:

```text
Authorization: Bearer ${CRON_SECRET}
```

Never expose an unauthenticated mutation endpoint.

### Near breach

If:

```text
now >= deadline - reminderBeforeBreachHours
```

then:

- mark reminder sent
- create audit/event
- trigger citizen communication

Do not spam.

### Breach

If:

```text
now > slaDeadline
```

then:

- mark `slaBreached = true`
- increment escalation level
- select next escalation target
- create escalation event
- add system action log
- notify appropriate department/official
- notify citizen
- optionally create an internal escalation notification

### Idempotency

This is critical.

The cron may run multiple times.

A report must not escalate repeatedly every 15 minutes for the same breach.

Use:

- escalation level
- last escalation event
- deterministic event identity / idempotency key

### Escalation model

Example:

```text
Level 1 → Department Supervisor / Head
Level 2 → Central Municipal Official
Level 3 → Admin / Senior Authority
```

Use configurable values from the department/SLA configuration rather than hardcoding people.

## Communication agent

LLM can generate citizen-friendly wording.

LLM must NOT decide whether escalation occurred.

The deterministic monitor decides.


---

# 15. Phase 8 - Admin / SMC Command Center

## Goal

Central officials should supervise departments rather than manually doing every operational task.

### Central dashboard

Show:

- total complaints
- active complaints
- unresolved complaints
- department distribution
- SLA compliance
- SLA breaches
- escalations
- department workloads
- average resolution time
- top issue categories
- hotspots
- duplicate clusters
- worker utilization

### Department comparison

Provide:

```text
Department
Open
In Progress
Resolved
SLA compliance %
Average resolution time
Current queue
Available workers
Overloaded workers
Escalations
```

### Central override

Officials/admin may:

- re-route a complaint
- change department
- reassign exceptional cases
- override priority with a reason
- intervene in escalations

Every override must be audited.


---

# 16. Phase 9 - Agent Pipeline Visibility and Demo Layer

## Goal

Make the multi-agent architecture visible to judges without exposing unsafe internal data.

### Complaint detail should show

```text
AI Pipeline
────────────────────────

✓ Intake / Normalizer
  normalized complaint

✓ Classification
  Pothole
  confidence: 0.91

✓ Routing
  Engineering
  confidence: 0.94

✓ Priority
  High
  reason: severity + recurrence

✓ Duplicate Check
  No duplicate found

✓ SLA Assignment
  Resolution deadline: ...

✓ Department Queue
  Engineering / Ward ...

✓ Worker Assignment
  Worker X

✓ SLA Monitor
  Monitoring

```

### Escalation timeline

Show:

```text
Submitted
   ↓
Engineering Queue
   ↓
Assigned
   ↓
In Progress
   ↓
SLA Near Breach
   ↓
Escalated
   ↓
Resolved
```

### Important

Do not show:

- API keys
- raw system prompts
- private citizen data unnecessarily
- internal model errors that confuse the demo
- huge LLM responses

Show concise structured receipts.


---

# 17. Phase 10 - Production Hardening

## Goal

Make the complete system resilient rather than merely demo-functional.

### Required hardening

#### Authentication

- Verify Firebase ID tokens server-side.
- Never trust client role.
- Never trust client department.
- Never trust client UID.
- Never trust client assignment authority.

#### Authorization

Test every API route.

#### Input validation

Use Zod or equivalent validation for:

- complaint payloads
- worker assignment
- status transitions
- department IDs
- priority
- SLA configuration
- notification payloads

#### LLM safety

Every LLM output must be:

```text
untrusted → validated → normalized → accepted/rejected
```

Never:

```text
LLM JSON → Firestore directly
```

#### Rate limits

Where practical:

- complaint creation
- AI endpoints
- notifications
- admin mutations
- cron route

#### Idempotency

Important for:

- report creation
- worker assignment
- SLA escalation
- notifications
- reward awarding

#### Observability

Log:

- agent name
- duration
- success/failure
- fallback usage
- report ID
- correlation ID

Never log secrets.

#### Firestore

Add required indexes.

Avoid unbounded collection reads in production paths.

Use pagination for:

- complaints
- workers
- escalation events
- audit logs

#### Notification hygiene

- remove invalid FCM tokens
- prevent duplicate notifications
- respect notification preferences
- use SMS selectively

---

# 18. Final Data Model

The target system should roughly contain:

## `users`

```text
uid
name
email
role
departmentId
designation
skillType
employeeId
wardArea
activeTasks
maxTaskCapacity
isAvailable
currentLocation
fcmTokens
...
```

## `departments`

```text
id
code
name
description
active
serviceCategories
supportedIssueTypes
headUserIds
escalationChain
...
```

## `reports`

```text
id
userId

description
location
latitude
longitude
roadName

category
departmentId
department

priority

status
workflowStage

slaResponseDeadline
slaDeadline
slaBreached
escalationLevel
escalatedAt
escalatedTo
lastReminderSentAt

assignedWorkerId
assignedContractor

linkedIncidentId
linkedMatchType
linkedSimilarityScore
relatedReportCount

agentPipelineLog

actionLog
assignmentHistory

imageUrl
beforeWorkMediaUrl
afterWorkMediaUrl

createdAt/timestamp
...
```

## `slaConfig`

```text
priority
responseHours
resolutionHours
reminderBeforeBreachHours
escalationChain
```

Optionally:

```text
departmentId
```

for department-specific overrides.

## `escalationEvents`

```text
id
reportId
departmentId
level
escalatedTo
reason
timestamp
idempotencyKey
```

## Optional future `auditEvents`

```text
id
actorId
actorRole
action
resourceType
resourceId
departmentId
reason
timestamp
metadata
```

---

# 19. Canonical Complaint Lifecycle

The final business flow should be:

```text
                    ┌─────────────────┐
                    │     CITIZEN     │
                    │ description     │
                    │ evidence        │
                    │ location        │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  INTAKE AGENT   │
                    │ normalize       │
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │ CLASSIFICATION  │
                    │ issue category  │
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │ ROUTING AGENT   │
                    │ departmentId    │
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │ PRIORITY AGENT  │
                    │ severity        │
                    │ recurrence      │
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │  DEDUP AGENT    │
                    │ related issue?  │
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │  SLA ASSIGNMENT │
                    │ deterministic   │
                    └────────┬────────┘
                             ▼
                 ┌─────────────────────────┐
                 │   DEPARTMENT QUEUE      │
                 │ Engineering / etc.      │
                 └───────────┬─────────────┘
                             │
                             ▼
                 ┌─────────────────────────┐
                 │     DEPARTMENT HEAD     │
                 │ review / assign / act   │
                 └───────────┬─────────────┘
                             ▼
                 ┌─────────────────────────┐
                 │        WORKER           │
                 │ execute + evidence      │
                 └───────────┬─────────────┘
                             ▼
                 ┌─────────────────────────┐
                 │       VERIFICATION      │
                 └───────────┬─────────────┘
                             ▼
                         RESOLVED

Meanwhile:

             ┌──────────────────────────┐
             │   SLA MONITOR / CRON     │
             │ every 15 minutes         │
             └────────────┬─────────────┘
                          │
                  near breach / breach
                          │
                          ▼
             ┌──────────────────────────┐
             │ ESCALATION STATE MACHINE │
             └────────────┬─────────────┘
                          ▼
             ┌──────────────────────────┐
             │ COMMUNICATION AGENT      │
             │ FCM / SMS / in-app       │
             └──────────────────────────┘
```

---

# 20. What NOT to Do

## Do not add a heavyweight agent framework

Do not add:

- LangGraph
- CrewAI
- AutoGen
- another orchestration framework

The typed TypeScript orchestrator is enough.

## Do not make every agent an LLM call

Especially not:

- authorization
- SLA
- escalation
- status transitions
- worker eligibility

## Do not let the citizen decide department

The citizen can give a hint.

The system owns the final routing.

## Do not let a worker change department

Department membership is administrative.

## Do not use department display names as security boundaries

Use:

```text
departmentId
```

## Do not trust client-side filtering

This:

```ts
reports.filter(r => r.department === myDepartment)
```

is UI filtering, not authorization.

The server and Firestore rules must enforce the boundary.

## Do not allow arbitrary client writes to SLA/escalation fields

These are system-controlled.

## Do not duplicate workflow logic

There must be one:

- authorization layer
- status state machine
- department registry
- worker eligibility utility
- SLA calculation utility
- escalation state machine

---

# 21. Hackathon Demo Story

The strongest demo should be:

### Step 1 - Citizen

Submit:

> “Garbage has been piling up near the market road for three days and is blocking the drain.”

Attach a photo and GPS.

### Step 2 - AI

Show:

```text
Intake → normalized complaint
Classification → Garbage/Debris
Routing → Sanitation
Priority → High
Dedup → related reports nearby
SLA → 48h
```

### Step 3 - Department

Open the Sanitation department portal.

The complaint is already in:

```text
Sanitation Queue
```

The department head sees:

- priority
- SLA countdown
- related incidents
- available workers

Assign a sanitation worker.

### Step 4 - Worker

Worker receives the task.

Worker:

- accepts
- opens location
- marks In Progress
- uploads before/after evidence
- resolves

### Step 5 - Citizen

Citizen receives:

```text
Worker assigned
→ Work started
→ Complaint resolved
```

### Step 6 - SLA Escalation Demo

For a second test complaint, set a short/test deadline.

Let the cron run.

Show:

```text
SLA approaching breach
        ↓
Reminder
        ↓
SLA breached
        ↓
Escalation Level 1
        ↓
Department Head notified
        ↓
Citizen notified
```

Then show the escalation event in the PMC dashboard.

This demonstrates that the system is not merely an AI chatbot - it is an **AI-assisted municipal operations workflow**.

---

# 22. Recommended Commit Strategy

Use one commit per phase.

```text
feat(departments): add canonical department domain
feat(auth): enforce department-scoped authorization
refactor(citizen): move complaint workflow to server
feat(ai): add intake classification routing priority dedup agents
feat(workflow): add orchestrator and department queues
feat(sla): add deterministic SLA and state machine
feat(workers): harden department worker operations
feat(escalation): add scheduled SLA monitoring
feat(smc): add department command center
feat(demo): add agent pipeline visibility
chore(hardening): validate production boundaries
```

If a phase becomes too large, split it - but never mix unrelated architecture changes without a reason.

---

# 23. Final Acceptance Checklist

Before calling the project production-grade for the hackathon:

## Department

- [ ] canonical department IDs
- [ ] no new arbitrary department strings
- [ ] department registry exists
- [ ] worker has authoritative departmentId
- [ ] report has authoritative departmentId
- [ ] department queues work
- [ ] department dashboard is scoped

## Access

- [ ] citizen only sees own complaints
- [ ] worker only sees assigned tasks
- [ ] worker cannot change department
- [ ] department head only sees own department
- [ ] department head only assigns own department workers
- [ ] official has city-wide view
- [ ] admin has configuration access
- [ ] server authorization is enforced
- [ ] Firestore rules are aligned

## AI

- [ ] intake
- [ ] classification
- [ ] routing
- [ ] priority
- [ ] dedup
- [ ] typed outputs
- [ ] validation
- [ ] fallbacks
- [ ] agent receipts
- [ ] no secrets exposed

## Workflow

- [ ] one state machine
- [ ] atomic worker assignment
- [ ] assignment history
- [ ] worker capacity consistent
- [ ] after-work evidence
- [ ] citizen notifications

## SLA

- [ ] deterministic SLA
- [ ] response deadline
- [ ] resolution deadline
- [ ] near-breach reminder
- [ ] breach detection
- [ ] escalation level
- [ ] escalation chain
- [ ] idempotency
- [ ] audit trail
- [ ] cron authentication

## Communication

- [ ] FCM
- [ ] in-app notifications
- [ ] selective SMS
- [ ] invalid token cleanup
- [ ] duplicate notification prevention

## Demo

- [ ] visible AI pipeline
- [ ] visible department routing
- [ ] visible department queue
- [ ] visible worker assignment
- [ ] visible SLA countdown
- [ ] visible escalation
- [ ] visible audit timeline
- [ ] central SMC overview

---

# 24. Golden Rule for the Coding Agent

Before every phase, the agent must:

```text
READ PLAN
   ↓
INSPECT EXISTING CODE
   ↓
IDENTIFY ACTUAL CURRENT IMPLEMENTATION
   ↓
PLAN MINIMAL SAFE CHANGES
   ↓
IMPLEMENT ONLY THIS PHASE
   ↓
TYPECHECK / LINT / TEST
   ↓
REPORT EXACT CHANGES
   ↓
STOP
```

Never:

```text
Read plan
→ assume architecture
→ rewrite everything
→ continue to next phase
```

The existing repository already contains significant functionality. **Preserve working behavior, refactor ownership boundaries, and add the new architecture around the existing product instead of replacing the product.**

---

# End State

The finished Parivartan platform should be explainable in one sentence:

> **“A citizen reports a civic problem once; AI understands and routes it to the correct municipal department, the department manages the operational queue and worker, deterministic SLA automation monitors delivery, escalation happens automatically when commitments are missed, and every step is visible and auditable to the citizen and municipal administration.”**

That is the product to build.


# Hackathon Scope and Production Direction

For the hackathon demo, **Roads and Garbage/Waste must receive the deepest implementation and polish** because they are the primary functional departments.

Streetlight and Water Supply should still exist in the canonical architecture, department registry, routing taxonomy, access model, SLA model, and UI structure. Their workflows may remain thinner if time is limited.

The architecture must never hardcode the two demo departments into authorization. The same department model must work for every department.

The final product should look like a real municipal operations platform, not an AI demo wrapped around a complaint form.
