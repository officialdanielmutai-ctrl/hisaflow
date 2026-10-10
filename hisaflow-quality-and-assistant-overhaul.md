# HisaFlow — Quality & Assistant Overhaul: Agent Directive

**Status:** Ready to issue to build agents
**Covers three duties:**
1. **UI layout audit and correction** across every vertical (not just "tests pass" — *looks right*).
2. **Assistant redesign:** from a prompt-heavy, per-vertical payload to a conversational, tool-using assistant that can act beyond what any prompt enumerates, while the user still affirms every change before it touches the system.
3. **Production services audit:** verify that every service we render in production actually works.

**Ground rules:** `hisaflow-agent-build-briefs.md` Part 1 applies in full. This doc adds stricter rules in Section 1.

---

## 0. What was and wasn't verified before writing this

Being explicit so agents don't inherit assumptions as facts.

**Seen directly in the repository root:** a pnpm/Turborepo monorepo with `apps/`, `context/`, `packages/types`, `.eslintrc.js`, `.prettierrc`, `tsconfig.json`, `pnpm-workspace.yaml`, `docker-compose.yml` (a `gateway` service on port 4000), and a root-level `test_litellm.py` (implying LiteLLM is used for AI calls). The frontend is deployed on Vercel.

**Not verified by me:** anything inside `apps/` and `context/` (GitHub blocks automated directory browsing, and `test_litellm.py` returned a server error when fetched). So I have **not** read the AI module, the per-vertical prompts, the proposal/accept flow code, the KPI card components, or the service code.

**Taken from the owner's description (treat as the source of truth, but confirm in code):** the AI currently runs a two-way flow — the algorithm runs, the AI listens and passes information back, and the user accepts before anything updates the system — driven by a per-vertical prompt payload, and it fails on requests or phrasings the payload doesn't cover.

**Taken from earlier agent plans, unconfirmed:** NestJS-style backend modules (e.g. `apps/backend/src/modules/isp`), `apps/frontend`, Prisma `schema.prisma`, an existing `NotificationsService` and `Alert` model. Earlier docs also flagged an unresolved `apps/backend` vs `apps/gateway` naming question.

**Therefore Phase 0 (Section 6) is mandatory and read-only. No agent may start a fix or a redesign before delivering its discovery output.**

---

## 1. Rules that apply to every correction in this document

### 1.1 Green is necessary, not sufficient
A change is done only when **all** of these hold:
1. **Lint** (`.eslintrc.js`, `.prettierrc` as the repo configures them), **type-check** (`tsconfig.json`), the **existing test suite**, and **CI** all pass — using the repo's own scripts (look them up in `package.json`; do not guess command names).
2. The change is **verified in behaviour**, not just in tests: for UI work, by measured geometry and screenshots; for assistant work, by the eval set; for service work, by an end-to-end run in staging with evidence.
3. A **regression guard** exists (test, geometry assertion, eval case, or smoke test) so the same defect can't silently return.
4. **Nothing outside the declared scope changed.**
5. The tracker and defect log are updated.

### 1.2 Never get to green by cheating
Do **not**: add `eslint-disable`, `@ts-ignore`/`@ts-expect-error`, `any` casts, or loosen `tsconfig`/ESLint/Prettier settings; skip, delete, or weaken a test; mark a flaky test as ignored; mass-reformat unrelated files. If a lint rule or test is genuinely wrong, **stop and report it** with evidence rather than bypassing it.

### 1.3 Fix at the root
Alignment and behaviour bugs repeat because the cause is usually shared (a shared component, a token, a service helper). Fix the shared cause once. Per-instance patches (one-off margins, hard-coded widths) are a defect, not a fix.

### 1.4 Small, reviewable, reversible
One defect (or one tightly related cluster) per PR, with before/after evidence. Additive schema changes only; no destructive migrations. Anything risky ships behind a flag.

### 1.5 Safe testing
Audits run against **staging or seeded local data**. Production is **observe-only** unless explicitly approved. No destructive tests in production. No real customer data in screenshots, logs, fixtures, or eval sets (anonymize or synthesize). No real payments, SMS, or emails in tests — use sandbox/mocks.

### 1.6 Defect log and severity (used by all three duties)
| Severity | Definition | Handling |
|---|---|---|
| **Sev1** | Data loss/corruption, cross-tenant data exposure, security hole, service outage, AI writing without user approval | Fix immediately, dedicated PR, regression test, notify owner |
| **Sev2** | Core flow broken or wrong numbers shown; layout defect that hides or misrepresents data (clipped/overflowing values) | Fix this cycle |
| **Sev3** | Visible but non-blocking misalignment/inconsistency; degraded but working behaviour | Fix this cycle if cheap, else schedule |
| **Sev4** | Polish | Backlog |

Defect log columns: `ID · Duty · Vertical/Service · Screen/Endpoint · Viewport/State · Description · Severity · Root cause · Fix PR · Regression guard · Status`.

---

## 2. Duty 1 — UI layout audit across every vertical

### 2.1 The problem in precise terms
Layout can be "correct" for the tooling and still look wrong to a person: lint doesn't see a card that is 12px taller than its neighbour, TypeScript doesn't see a label that wraps to two lines, and tests that assert text exists don't notice it overflowing its box. The reported example — **KPI card content misaligned in the ISP vertical** — is one instance of a class of defects likely present in other verticals. The goal is a **systematic sweep**, not a fix of the one card.

### 2.2 Scope: the full matrix
Audit **every live vertical × every screen × every state × every viewport.**
- **Verticals:** all values of the business-type setting that have a distinct UI (earlier docs list Duka, Mini Mart, Chemist, Restaurant, School, Wholesaler, plus the guest-house and ISP verticals). Confirm the actual list from the code, not from this doc.
- **Screens:** every routable page and every modal/drawer/sheet/popover/toast reachable from navigation — dashboards, KPI rows, lists/tables, detail pages, forms, settings, onboarding, empty pages.
- **States:** loaded; loading (skeletons); empty; error; zero values; very large values; negative values/refunds; long text; many rows (100+); missing optional fields; disabled controls; validation errors.
- **Viewports:** 360, 390, 768, 1024, 1280, 1440, 1920 px wide; plus browser zoom 200% and increased system text size at 390px. Test dark mode if the app supports it.

Deliverable of this step: a **coverage matrix** (vertical × screen × state × viewport) with a status per cell. The audit isn't done until every cell is `Pass`, `Fixed`, or `Logged`.

### 2.3 Method — measure, don't eyeball
1. **Inventory screens** from the route tree and navigation config per vertical.
2. **Seed realistic and adversarial data per vertical.** Include: `0`, `1`, large KES values (e.g. `KES 12,450,000`), long product/subscriber/room names, long email addresses, text with and without spaces, mixed English/Swahili strings, 100+ list rows, and missing optional fields.
3. **Render** each cell and capture screenshots.
4. **Run automated geometry checks** in a browser test runner already present in the repo (if none exists, propose one to the owner — do not add heavyweight tooling unilaterally). Assert at minimum:
   - **No overflow:** for key containers, `scrollWidth <= clientWidth` and no horizontally scrolling page body.
   - **No clipping of meaningful text:** values/labels aren't cut off without an intentional truncation affordance (tooltip/title).
   - **Equal-height siblings:** cards in the same grid row have equal rendered height (bounding-box comparison).
   - **Consistent alignment within a row:** label tops, value baselines, and delta/trend chips align across sibling cards (compare bounding boxes/baselines).
   - **Consistent gaps and padding:** computed gap/padding between siblings equals the design token.
   - **Touch targets ≥ 44×44px** for interactive elements on mobile.
   - **No layout shift** between skeleton and loaded state (skeleton dimensions match final).
5. **Human-style review of every screenshot** against the checklist in 2.4, because geometry tests won't catch everything (visual weight, optical centering, awkward wrapping).
6. **Log defects** (Section 1.6), find the **shared root cause**, fix once, re-run the cell(s).
7. **Add regression guards** for each fixed component/layout (geometry assertions and, where the repo already uses them, visual snapshots).

### 2.4 Misalignment checklist (apply to every screen)
**KPI / stat cards (priority — start with the ISP vertical, then every other vertical's KPI row):**
- Label, value, unit/currency, delta/trend chip, and icon sit on consistent baselines and the same relative positions in every card of a row.
- All cards in a row have equal height; content doesn't push one taller than its neighbours (use grid stretch/consistent min-height, not magic numbers).
- Numbers use tabular figures; currency symbol and value stay on one line (`nowrap`); thousands separators consistent.
- **Long values** have a defined behaviour: compact format (e.g. `KES 1.2M`) with the full value available on hover/focus/tap, rather than wrapping, overflowing, or shrinking inconsistently. (Default decision in Section 9.)
- Flex/grid children that should truncate have `min-width: 0` (the most common cause of overflow in flex layouts).
- Icon is optically centered in its container; icon sizes are consistent across cards.
- Padding, radius, and border are identical across cards; card widths follow the grid (no fractional pixel drift).
- Trend/delta chips don't collide with the value at narrow widths; they reflow predictably.
- Empty, zero, loading (skeleton), and error states keep the same card dimensions.

**Everything else:** grid/column alignment; table column alignment (numbers right-aligned, text left-aligned, headers match cells); header/toolbars (title, filters, actions align and wrap cleanly); forms (label/field/help/error alignment, consistent field heights, error messages don't shift layout); modals/drawers (padding, scroll behaviour, footer button alignment); sidebars/nav (active state, icon/label alignment, collapsed state); charts (legend/axis labels don't overlap or clip; consistent heights); badges/chips; spacing rhythm (vertical gaps from the spacing scale); consistency of the same component across verticals.

### 2.5 Consolidate, don't multiply

**The problem this solves.** If each vertical built its own KPI card (often copied and tweaked), the same alignment bug exists in several places, a fix in one vertical never reaches the others, and the cards slowly drift apart in padding, type sizes, and wrapping behaviour.

**The fix: one shared card, many arrangements.** Separate two things that are easy to confuse:

| Level | What it is | Shared or per-vertical? |
|---|---|---|
| **The card** (building block) | Sizing, padding, alignment, typography, number formatting, truncation, and loading/empty/error states | **Shared** — one component, fixed once, fixed everywhere |
| **The dashboard arrangement** | Which cards appear, how many, in what order, and how wide each one is | **Per-vertical configuration** — each business type declares its own |

So "single shared component" does **not** mean every vertical's dashboard looks the same. An ISP dashboard might show active subscribers, monthly recurring revenue, overdue invoices, and open tickets; a school dashboard might show enrolled students, fees collected, outstanding fees, and attendance. Each vertical passes different content and a different layout into the same card.

**How the shared card flexes:**
- **Slots** are the places content goes: label, value, unit, delta/trend, icon, footnote. Each vertical fills the slots it needs and leaves the rest empty. Empty slots must not leave gaps or shift alignment.
- **Variants** are reusable visual treatments: for example compact, with a sparkline, emphasized/alert, or with a progress ring. If two verticals want the same treatment, it becomes one variant, not two copies.
- **Per-vertical dashboard config** lists the cards, their order, and their grid spans for that business type. Changing a vertical's arrangement means editing its config, not its card.

**When a vertical genuinely needs a different card shape** (for example a router-status card with a live indicator, or an attendance card with a ring):
1. If the difference is only content, use the slots.
2. If the treatment could be reused, add it as a variant or a new slot on the shared card.
3. If it is truly unique, build a separate component **on top of the shared card shell and tokens** (padding, radius, typography), and list it as a documented exception. It is never a fork of the card's code.

**How to do the refactor safely:**
1. Pick **one vertical at a time**, starting with ISP (the reported defect).
2. **Before changing anything**, record what that vertical's cards show today: each metric, its value on seeded data, what happens on click, and geometry/screenshots at the Section 2.2 viewports. This is the regression guard.
3. Swap the vertical onto the shared card, keeping the same metrics, the same data sources, and the same click/navigation behaviour.
4. Compare against the recorded baseline. Visual changes are expected and intended only where they correct alignment, spacing, or overflow; **numbers, data sources, and behaviour must be identical.**
5. Run the full gates (lint, type-check, tests, CI), then move to the next vertical.

If a vertical's data or behaviour would have to change to fit the shared card, stop and report it rather than reshaping the data to fit.

### 2.6 Done criteria for Duty 1
- Coverage matrix is 100% complete; no cell `Untested`.
- Zero open Sev1/Sev2 layout defects; Sev3 either fixed or scheduled with owner sign-off.
- The reported ISP KPI misalignment is fixed at its root cause, with a geometry regression test.
- Shared components (KPI card, etc.) are used consistently across verticals.
- Before/after screenshots at all seven viewports are attached for each fixed area.
- **Lint, type-check, existing tests, and CI are green for every PR** (Section 1.1), with no suppressions added (Section 1.2).
- Tracker and defect log updated.

---

## 3. Duty 2 — A conversational assistant that isn't limited by the prompt

### 3.1 Diagnosis
Today's behaviour, per the owner: capabilities are effectively encoded in per-vertical prompt payloads. That produces three predictable failures:
1. **Coverage gaps:** the assistant can only do what the prompt enumerates; anything else dead-ends.
2. **Phrasing brittleness:** users type unpredictably (typos, shorthand, Swahili/English mixing, multiple requests in one message) and the assistant fails when wording doesn't resemble what the prompt anticipated.
3. **Growth cost:** every new capability means editing prompts per vertical, increasing size, conflict, and regression risk.

### 3.2 Answer to "is the prompt-heavy approach the best way?"
**No.** Keep the system prompt small and stable (role, tone, safety rules, a short business context), and move *capabilities* out of prose into a **typed tool registry** the model can call. The model handles language understanding, clarification, and planning; **code** handles validation, authorization, and committing. This is how mainstream agent designs separate "what the model decides" from "what the system allows."

The owner's existing integrity guarantee — **nothing changes in the system until the user affirms it** — is not replaced; it is **generalized into a single governed write path**:

> The assistant may *read* freely, may *draft* and *propose* anything, but every effect on the system or on a third party happens only after the user approves the exact payload.

This matches the widely recommended "propose → approve → commit" pattern: the agent proposes a structured action, a durable store holds it, a human approves/rejects/edits, and a separate executor commits it with idempotency and precondition checks. The existing algorithm remains the **validator and executor** (business rules, data integrity); the AI becomes the **interpreter and drafter**.

### 3.3 Target architecture

```
User message
   ▼
Conversation layer (thread memory, streaming)
   ▼
Context assembly (org profile, business type, role/tier, current screen/entity — small, structured)
   ▼
LLM via LiteLLM (tool-calling enabled)
   ├─ READ tools ──────────► run immediately (scoped to org, read-only)
   ├─ WRITE tools ─────────► create a PROPOSAL (nothing written)
   ├─ COMMUNICATE tools ───► create a PROPOSAL with exact preview (nothing sent)
   └─ ASK-CLARIFICATION ───► question back to user
   ▼
Proposal store (durable, structured, immutable once approved)
   ▼
Confirmation UI: review → Approve / Edit / Reject
   ▼
Policy gate (role, tier, tenant, limits) — outside the LLM
   ▼
Executor → existing domain services (same path as manual UI actions) → audit log → result back to the conversation
```

**Components (each must be a clearly separated module):**

1. **Tool registry.** Every capability is a typed tool: name, description, JSON-schema arguments, `kind` (`read` | `write` | `communicate` | `utility`), risk level, required role/tier, and the domain service it maps to. Tools are filtered **per organization** (business type, subscription tier, user role) before being offered to the model. Adding a capability = adding a tool, not editing a prompt.
2. **Read tools.** Search/lookup/aggregate over the org's data (stock levels, sales summaries, subscribers, bookings, invoices). Auto-run, strictly read-only, tenant-scoped. Large data is **fetched on demand via tools, never stuffed into the prompt.**
3. **Write tools → proposals.** A write tool does not write. It validates its arguments (against the same validators the manual UI uses), normalizes them, computes a **human-readable summary and a before/after diff**, and stores a `Proposal`.
4. **Communicate tools → proposals.** Sending a note, SMS, or email is always a proposal with the exact recipient list and exact text previewed. Outbound messages respect consent/opt-out rules (Kenya Data Protection Act) and the same delivery services used elsewhere.
5. **Utility tools.** Calculations, date/time, unit/currency formatting — no side effects, auto-run.
6. **Clarification tool.** When ambiguity would change a write, the model asks one precise question (or presents candidates) instead of guessing.
7. **Fallback "capture" tools.** If a request has no matching tool, the assistant says what it can't do directly and offers the nearest alternative — e.g. draft a note, create a task/reminder proposal, or log a feature request — and records an **unsupported-intent event** for the product backlog. A dead end becomes useful data.
8. **Proposal store.** Durable (database, not memory). Fields: `id, organizationId, userId, conversationId, tool, argsJson, argsHash, summary, diff, riskLevel, status (PROPOSED | APPROVED | REJECTED | EXPIRED | EXECUTED | FAILED), idempotencyKey, version, createdAt, expiresAt, decidedAt, decidedBy, result`. **Approved payloads are immutable**: the executor runs exactly the approved arguments and verifies `argsHash` before executing. If the user edits, a **new version** is created and re-approved.
9. **Policy gate.** Implemented **in application code at the execution layer, not in the prompt.** Evaluates user role, tier, tenant, tool risk, and rate/spend limits; default-deny for unknown tools. The model **never supplies** `organizationId`, `userId`, or any authority — the server injects them from the authenticated session.
10. **Executor.** Calls the **same domain services the manual UI uses** (one code path, so rules and audits are identical), with idempotency keys, precondition re-validation at execution time (data may have changed since proposal), post-action verification, and an audit record. Results are returned to the conversation.
11. **Provider layer.** Continue via LiteLLM. Select models that support tool/function calling; verify per configured model (support and quality vary), define fallbacks, and keep provider choice configurable through the admin panel (`hisaflow-admin-panel.md`). Low temperature for tool selection and argument filling.
12. **Observability.** Log (privacy-safe) every turn's tool calls, proposals, approvals, rejections, executor outcomes, latency, token cost, and unsupported intents. Access to conversation content is governed by the admin message-observability rules (reason-gated, audit-logged).

### 3.4 What "anything an assistant can do" means — capability tiers
| Tier | Examples | Mechanism | Approval |
|---|---|---|---|
| 1. Answer / explain / advise / draft text | "Explain my margin", "Write a polite reminder to a customer" | Model only (no tool) | None (no side effects) |
| 2. Read from the system | "What's low on stock?", "Who hasn't paid this month?" | Read tools | None |
| 3. Change the system | "Add 20 bags of unga", "Mark room 4 as dirty", "Suspend subscriber X" | Write tools → proposal | **User approves the exact payload** |
| 4. Reach outward | "Send a payment reminder to these customers", "Save a note for the cashier" | Communicate tools → proposal with exact preview | **User approves recipients and text** |
| 5. Not in the registry | "Do X" where no tool exists | Fallback: explain limit, offer note/task, log unsupported intent | User chooses |

This is what gives the experience of "do anything I tell it": the assistant is useful on every request (tiers 1, 2, 5 always work), and acts on the system (tiers 3–4) only through proposals the user confirms.

### 3.5 Making it robust to how people actually type
Design and test for:
- **Typos, shorthand, partial sentences**, and **messages with several requests** (the assistant plans multiple proposals and presents them together for one review).
- **Swahili, English, and code-switching** (and informal Sheng where relevant). Model capability varies by provider/model — **evaluate each configured model on this explicitly** rather than assuming.
- **Numbers and money formats:** "2k", "2,500/=", "KES 2500", "elfu mbili", quantities with units.
- **Relative dates/times:** "tomorrow", "kesho", "Friday", "end of month".
- **Entity resolution:** the user says "the 2kg sugar" or "Mary's room" — use search tools to find candidates; if more than one plausible match, present them rather than choosing silently.
- **Mid-conversation corrections:** "no, make it 30" updates the pending proposal (new version), not a second one.
- **Context from the screen:** if the user is viewing a subscriber/product, "suspend him"/"restock this" resolves from structured context.
- **Assumptions are shown, not hidden:** when the model fills a gap, the proposal displays it ("Assuming today's date; price from your current list") so the user can correct it before approving.

### 3.6 Safety and integrity (non-negotiable)
- **No write or send without approval of the exact payload.** There must be exactly one governed path into the executor; a code review that finds a second path is a Sev1.
- **Prompt injection:** data from the database (product names, customer notes, ticket text, imported content) is **untrusted**. Tool results are data, never instructions; the model's authority comes only from the user's message and the server policy. Do not expose secrets to the model; keep system prompts free of credentials.
- **Tenant isolation is enforced in code.** Tools can only query/modify the authenticated org; test with cross-tenant attempts.
- **Least privilege:** read tools use read-only access paths; write execution uses the same permissions the human user has.
- **Limits:** cap tool calls per turn (default 6), proposals per turn, message size, and per-org spend/rate; time-box executions; degrade gracefully with a clear message.
- **Irreversible/high-impact actions** (bulk sends, deletions, suspending service, financial changes) are tagged high-risk and get a more explicit confirmation (e.g. recipient count and a typed or two-step confirm). Reversible/low-risk ones keep the lightest flow that still shows exact payload.
- **Privacy:** minimize personal data sent to model providers; honor retention policy; conversation logs are subject to the admin access controls.
- **Honesty:** the assistant never claims it did something that is still only proposed, and never claims a capability it lacks.

### 3.7 Migration from the prompt-heavy design (don't big-bang)
1. **Inventory first:** extract every capability currently encoded in each vertical's prompt payload and in the algorithm's accept flow. This is the **parity list**.
2. **Characterization set:** collect representative utterances per vertical (from anonymized logs if they exist, otherwise authored with the owner) and record what the *current* system does. This protects against regressions.
3. **Build the foundation** (registry, proposals, gate, executor) without changing user-facing behaviour.
4. **Port capabilities as tools** one vertical at a time, behind a **feature flag per organization/vertical**, starting with the lowest-risk vertical.
5. **Shadow mode:** run the new pipeline alongside the old and compare tool selection and arguments offline before users see it.
6. **Roll out progressively** (internal orgs → pilot orgs → all), keeping the old path as fallback until parity and eval thresholds are met; then retire the per-vertical capability prompts (keep only the small shared system prompt and short context).

### 3.8 Evaluation (the assistant is only as good as its test set)
- **Golden set** per vertical, with categories: standard requests; typos/shorthand; Swahili; English–Swahili mix; ambiguous (needs clarification); multi-intent; out-of-registry (should hit fallback); adversarial/prompt-injection; cross-tenant attempts; requests to bypass approval.
- **Metrics and gates:**
  - **Unapproved-write rate = 0** (hard gate, zero tolerance).
  - Correct tool selection and argument accuracy above agreed thresholds per category (set baselines from the characterization set; the new system must meet or beat the old on parity items).
  - Appropriate-clarification rate (asks when needed, doesn't ask when not).
  - Unsupported-intent handling: always responds helpfully (fallback), never errors.
  - Latency and cost per turn within budget.
- **CI:** deterministic subset using recorded/mocked model responses to protect the executor, policy gate, and proposal logic; a separate, scheduled **live-model eval** to track quality across providers and model changes. Live evals are not flaky-gates for merge, but regressions open defects.
- **Production signals:** proposal approval/edit/reject rates, unsupported-intent log, executor failures — reviewed regularly to drive new tools.

### 3.9 Phases

**Phase A — Discovery & capability inventory (read-only).** Map the current AI flow end to end: where the vertical prompts live, how the model is called (LiteLLM config), how information is passed to the algorithm, how the accept/reject step works, what the data model is, and what tests exist. Produce: capability parity list per vertical, gap list (what users ask that fails), a draft golden set, and an architecture decision note. **Done when:** owner reviews and signs off the parity list and architecture note; no code changed.

**Phase B — Foundation (backend).** Tool registry framework, `Proposal` store (additive migration), policy gate, executor abstraction wired to existing domain services, audit logging, flag mechanism. **Done when:** a trivial read tool and a trivial write tool work end to end in staging; a write tool **cannot** execute without an approved proposal (proved by test); approved-args hash check and idempotency proved by tests; cross-tenant attempt rejected by test; lint/types/tests/CI green.

**Phase C — Parity port (backend), one vertical, flagged.** Port that vertical's existing capabilities to tools; implement shadow comparison. **Done when:** parity list for the vertical is 100% covered by tools; shadow comparison meets agreed thresholds on the characterization set; flag defaults off.

**Phase D — Conversational UI and confirmation (frontend).** See Section 3.10. **Done when:** a user can converse, see what the assistant is doing, review proposals, edit/approve/reject, and see results — at all Section 2.2 viewports with passing geometry checks.

**Phase E — Expansion.** Communicate tools (notes, SMS/email proposals with consent checks), fallback capture tools and unsupported-intent logging, remaining verticals. **Done when:** every live vertical has parity; communicate tools respect consent; unsupported intents are logged and surfaced to the team.

**Phase F — Hardening and retirement.** Injection and abuse test suite, load/cost controls, dashboards, live eval baselines, retire per-vertical capability prompts. **Done when:** all Section 3.8 gates pass; old payload path removed or disabled behind an off flag with a documented rollback.

### 3.10 Frontend requirements for the assistant (for the Phase D prompt)
Build with the shared tokens and components from `hisaflow-landing-visual-spec.md` Section 3 where the app shares them (inspect the app's existing design system first and conform). The UI must include:
- **Conversation surface:** message list with streaming text, clear user/assistant distinction, timestamps on demand, scroll anchoring that doesn't jump, a composer that supports multi-line, Enter-to-send with a visible send button, and graceful behaviour on slow networks.
- **Activity indicators:** short, honest status chips while tools run ("Checking stock…", "Preparing a proposal…"); never fake progress.
- **Proposal cards:** one per pending action showing a plain-language summary, the exact fields to be changed, a before/after diff, assumptions the assistant made, risk level, and **Approve / Edit / Reject**. For multi-action plans, a single **"Review and confirm"** step listing all proposals, so the user can affirm everything at the end (as the owner wants), with per-item reject/edit.
- **Edit-before-approve:** inline editing of proposal fields; editing creates a new version and re-validates.
- **Outcome display:** after execution, a result card (what changed, link to the record), with an **undo/revert** affordance where the domain supports it, and a clear failure state with retry.
- **Clarification UI:** when the assistant needs a choice, show tappable candidate options plus free text.
- **Suggestion chips** for common actions per vertical (generated from available tools, not hard-coded text).
- **Honesty cues:** distinguish "proposed" from "done" visually and in wording at all times.
- **Accessibility:** live-region announcements for new messages and status, keyboard-operable cards and buttons, focus management after approve/reject, AA contrast, 44px targets, reduced-motion support.
- **Mobile-first:** the dominant device is a phone; the composer and proposal actions must stay reachable with the on-screen keyboard open.
- **States:** empty/first-run, offline/slow, error, rate-limited, tier-gated (if a tool is not in the user's plan, say so and link to the paywall in context).
- **Layout quality gate:** Duty 1's checklist and geometry checks apply to this UI before it is considered done.

---

## 4. Duty 3 — Production services audit

### 4.1 Goal
Establish, with evidence, whether every service currently rendered to users in production **works properly**, and fix what doesn't. "Works" means: the golden path functions, failure modes are handled, data stays correct, tenants stay isolated, and the service is observable.

### 4.2 Build the service inventory (don't assume)
Derive the list from the repository, deployment configs (including `docker-compose.yml` and the Vercel project), environment variables, and the route/module trees. Expect to find at least: the web frontend, the gateway service, the backend modules (inventory, invoicing/receipts, finance, each vertical's module such as ISP subscribers and guest-house bookings), authentication (Clerk), the database, the AI path (LiteLLM and the assistant), notifications, scheduled jobs, and any integrations in production today. **Include every one actually in production; exclude what is only planned** (paywall, tax, admin panel — unless already live).

### 4.3 Checks per service
For each service, record purpose, entry points, dependencies, and then verify in **staging** (production observe-only per Section 1.5):
1. **Health:** reachable; health/readiness signal exists; sensible startup/shutdown; required environment variables documented and validated at boot.
2. **Golden path end to end:** the core user journey works (e.g. create product → record sale → stock decreases → receipt generated → finance reflects it; for ISP: create subscriber → assign plan → generate invoice → record payment; for guest house: create booking → add consumption → invoice → payment).
3. **Failure modes:** dependency down, timeout, malformed input, duplicate submission, concurrent updates, partial failure mid-operation. The service must fail safely (clear error, no corrupted state, retry-safe).
4. **Data integrity:** totals reconcile (invoice = sum of lines; stock after sales matches transactions; balances match payments); no orphaned records; transactions where multi-step writes must be atomic; idempotency on retried requests.
5. **Authorization and tenant isolation:** every endpoint enforces auth and role; a user in organization A cannot read or modify organization B's data (test explicitly, including via IDs in URLs and request bodies).
6. **Validation and error handling:** server-side validation (not just UI), consistent error shapes, no stack traces or secrets leaked.
7. **Performance sanity:** key endpoints under realistic data volumes (hundreds to thousands of rows) respond acceptably; no N+1 patterns on list screens; pagination in place.
8. **Observability:** structured logs with correlation IDs, errors captured, meaningful alerts for failures.
9. **Security basics:** secrets not in the repo or client bundle; rate limiting on sensitive endpoints; dependency vulnerabilities reviewed; CORS and cookies configured correctly.
10. **Operational readiness:** migrations are safe and reversible where possible; backups/restore known; documented runbook for common failures.

### 4.4 Output: the Service Health Register
| Service | Owner module | Golden path | Failure modes | Data integrity | AuthZ/tenancy | Perf | Observability | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
Status values: **Healthy / Degraded / Broken / Untested**, each with linked evidence (test output, logs, screenshots).

### 4.5 Fix policy
- **Sev1** items are fixed immediately in dedicated PRs with regression tests (and the owner is told the same day).
- Every fix includes a regression test and passes lint, type-check, the full test suite, and CI (Sections 1.1–1.2).
- Each service ends the audit with **at least an automated smoke test of its golden path in CI** (or a written reason it can't, approved by the owner).

### 4.6 Done criteria for Duty 3
Register complete with no `Untested`; zero open Sev1/Sev2; smoke tests in CI for each service; cross-tenant tests passing; runbook notes for each service; tracker and defect log updated.

---

## 5. How the three duties interact

- **Duty 3 first (baseline), Duty 1 in parallel.** The service audit tells you what's actually broken before you build on it; the UI audit is independent and can run alongside.
- **Duty 2 builds on both.** The assistant's executor must call healthy services (Duty 3), and its new UI must pass the layout gates (Duty 1).
- **The AI service itself** (LiteLLM path and current assistant) is audited in Duty 3 **before** Duty 2 redesigns it, so the current behaviour is documented and the parity list is accurate.

---

## 6. Phase 0 — Shared discovery (mandatory, read-only)

Before any fix or redesign, produce a **Discovery Report** containing:
1. **Repo map:** apps, packages, their roles; the real names/paths of the backend, frontend, and gateway; framework and library versions; styling system; test runners; lint/type/CI commands exactly as defined in `package.json` and CI config.
2. **Baseline run:** lint, type-check, test suite, and CI status **before any change**, recorded. Pre-existing failures are reported, not silently fixed.
3. **Verticals and screens inventory** (Duty 1 matrix skeleton).
4. **Services inventory** (Duty 3 register skeleton).
5. **Assistant map** (Duty 2 Phase A inputs): where prompts live, LiteLLM configuration, accept/reject flow, data model.
6. **Existing KPI/stat card implementations** and where they're used.
7. **Questions for the owner** (anything that can't be determined from code).

**Done when:** the report is delivered and the owner confirms it. No code changes in Phase 0.

---

## 7. Ready-to-issue agent prompts

Every prompt below begins with: *Read `hisaflow-quality-and-assistant-overhaul.md` in full, plus `hisaflow-agent-build-briefs.md` Part 1. Rules in Section 1 of the overhaul doc apply to everything you do: every correction must pass lint, type-check, the existing test suite, and CI using the repo's own commands, with no suppressions, skipped tests, or loosened configs; "green" alone is not done.*

### Prompt P0 — Discovery
> Perform Phase 0 (Section 6) and deliver the Discovery Report. Do not change any code. If something can't be determined, list it as a question for the owner rather than assuming. Done when the report contains all seven items and baseline lint/type/test/CI results are recorded.

### Prompt D3 — Production services audit
> After Phase 0 is confirmed, execute Duty 3 (Section 4): build the service inventory from the repo and deployments, run every check in 4.3 against **staging or seeded local data** (production observe-only), complete the Service Health Register with evidence, log defects with severities, and fix Sev1 immediately in dedicated PRs with regression tests. Add a golden-path smoke test per service to CI. Done per Section 4.6 and Section 1.1.

### Prompt D1 — UI layout audit and correction
> After Phase 0 is confirmed, execute Duty 1 (Section 2). Start with the ISP vertical's KPI cards, then sweep every vertical, screen, state, and viewport in the Section 2.2 matrix, using measured geometry checks plus screenshot review (Section 2.3–2.4). Fix defects at their shared root cause; consolidate KPI/stat components per Section 2.5 only with regression guards. Do not change data, business logic, or behaviour. Done per Section 2.6 and Section 1.1, with before/after screenshots at all seven viewports.

### Prompt D2-A — Assistant discovery
> After Phase 0 is confirmed and Duty 3 has audited the current AI path, execute Phase A (Section 3.9): produce the capability parity list per vertical, the gap list, a draft golden set (Section 3.8 categories, including Swahili and mixed-language), and an architecture decision note mapping the current flow onto Section 3.3. No code changes. Done when the owner signs off.

### Prompt D2-B — Assistant foundation (backend)
> Implement Phase B: the tool registry, `Proposal` store (additive migration), policy gate enforced at the execution layer, executor wired to the same domain services the manual UI uses, audit logging, and a feature flag. The model must never supply organization or user identity; the server injects them. Prove with tests: no write executes without an approved proposal; approved arguments match their stored hash; idempotency holds; cross-tenant attempts fail; unknown tools are denied. Done per Phase B criteria and Section 1.1.

### Prompt D2-C — Parity port, first vertical (backend)
> Implement Phase C for the vertical agreed with the owner: port each item on its parity list to a typed tool (read, write→proposal, or communicate→proposal), behind a per-organization flag defaulting off, and add shadow-mode comparison against the existing path using the characterization set. Do not remove the old path. Done per Phase C criteria and Section 1.1.

### Prompt D2-D — Conversational UI and confirmation (frontend)
> Once the backend proposal API contract is stable, implement Phase D using the requirements in Section 3.10 and the app's existing design system. Proposals must be visibly distinct from completed actions; multi-action plans use a single "Review and confirm" step; editing creates a new version. Run Duty 1's geometry checks on the new UI at all seven viewports, including with the on-screen keyboard open on mobile. Done per Phase D criteria and Section 1.1.

### Prompt D2-E — Expansion (backend + frontend)
> Implement Phase E: communicate tools (notes, SMS, email as proposals with exact previews and consent/opt-out checks), fallback capture tools with unsupported-intent logging, and remaining verticals. Done per Phase E criteria and Section 1.1.

### Prompt D2-F — Hardening and retirement
> Implement Phase F: injection/abuse and cross-tenant test suites, cost/rate controls, dashboards, live eval baselines, and retirement of per-vertical capability prompts (or an off-by-default flag with documented rollback). All Section 3.8 gates must pass. Done per Phase F criteria and Section 1.1.

---

## 8. Progress tracker

| Item | Status | Notes |
|---|---|---|
| P0. Discovery Report | 🟡 In review | Report delivered 2026-10-10 (`hisaflow-overhaul-discovery.md`, read-only). Baseline green: typecheck x4, lint x3 (backend 580 warnings/0 errors), backend 585 + frontend 129 + admin 12 tests. Awaiting owner sign-off and Section 7 answers (seeded staging, health route, vertical scope, compact-number default). |
| D3. Production services audit | ☐ Not started | Baseline for Duty 2; smoke tests into CI |
| D1. UI layout audit — ISP KPI cards | 🟡 In progress | Reported defect. Q-001/Q-002 fixed: removed invalid Tailwind v3 utilities (`h-4.5`/`w-4.5` → `h-[18px] w-[18px]`; `shadow-xs`/`shadow-2xs` → `shadow-sm`) in `IspDashboard.tsx` + `work-orders/page.tsx`, with a repo-wide guard (`lib/tailwind-utility-guard.spec.ts`). Q-003/Q-004 (no shared KPI card; inconsistent Tier-1/Tier-2 header slots) and the 7-viewport geometry/screenshot evidence are pending a seeded/staging authenticated environment (Question 1). |
| D1. UI layout audit — all other verticals | ☐ Not started | Coverage matrix must reach 100% |
| D1. KPI/stat component consolidation | ☐ Not started | Only with regression guards |
| D2-A. Assistant discovery & parity list | ☐ Not started | Owner sign-off required |
| D2-B. Assistant foundation (backend) | ☐ Not started | Single governed write path |
| D2-C. Parity port, first vertical | ☐ Not started | Flagged, shadow mode |
| D2-D. Conversational UI & confirmation | ☐ Not started | Must pass Duty 1 gates |
| D2-E. Expansion (comms, fallback, verticals) | ☐ Not started | Consent checks required |
| D2-F. Hardening & retirement | ☐ Not started | Unapproved-write rate must be 0 |

**How to update:** `In progress` when work starts; `Done` when merged with PR link/date; Done only when the item's criteria and Section 1.1 are met (including green lint, type-check, tests, and CI with no suppressions).

---

## 9. Decisions — defaulted to industry standard (revisit with evidence)

1. **Capabilities live in a typed tool registry; the system prompt stays small.**
2. **All writes and all outbound messages go through proposals the user approves;** reads and utility tools auto-run.
3. **Approved payloads are immutable;** edits create a new version needing re-approval.
4. **Policy is enforced in code at the execution layer;** unknown tools denied by default; the model never supplies identity.
5. **Tool-call cap per turn:** 6 (tunable). Low temperature for tool selection.
6. **Multi-action requests** are reviewed together in one confirmation step.
7. **Long numbers in KPI cards:** compact format (e.g. `KES 1.2M`) with the full value on hover/focus/tap.
8. **Rollout:** flagged per organization/vertical, shadow mode first, old path kept until parity.
9. **Evals:** deterministic recorded-response subset in CI; live-model eval on a schedule; unapproved-write rate hard gate at 0.
10. **Audit scope:** staging/seeded data; production observe-only.

---

## 10. Final guidance to the agents

- Start with Phase 0. Do not assume file paths, frameworks, or how the current AI works — confirm in code and report what you find.
- **Green is not done.** A layout can pass every automated check and still look wrong; an assistant can pass unit tests and still fail real users. Verify behaviour, and keep evidence.
- **Never bypass the gates.** No lint suppressions, type escapes, skipped or deleted tests, or loosened configs to pass CI. If a gate is wrong, report it.
- **Fix root causes, once.** Shared components, shared services, shared policy code.
- **One write path.** The assistant proposes; the user approves the exact payload; the executor commits through the same services as the manual UI. Any second path is a Sev1.
- **Treat all stored text as untrusted input** to the model. Tenant isolation and authority are enforced by code, never by prompts.
- Stay within scope; when something needed is missing (data, access, decisions), stop and report instead of improvising.
- Verify third-party specifics (LiteLLM tool-calling support per model, Clerk and framework APIs) against current documentation at build time.
