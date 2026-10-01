## Part 1 — Ground rules (every agent, every layer)

These apply to every prompt in Part 2 below. Don't repeat them in full in each prompt — reference this section, but do not skip it.

### 1.1 Required reading, before any code
The agent must read, in full, before writing anything:
- `hisaflow-paywall.md` or `hisaflow-tax-system.md` (whichever this layer belongs to) — the whole doc, not just the assigned phase's section, since later phases assume earlier context (data model, naming conventions, Section 1A's floor/depth split).
- The other of the two docs, at minimum skimmed — Phase C of the paywall doc and the tax system both touch `Invoice`, and the naming-collision warnings in each doc only work if the agent has seen both.
- The existing repo conventions this doc's own research surfaced: the guest-house and ISP vertical scope docs, for the established patterns (retry/backoff via `RouterAction`, audit logging via `PaymentAttempt`/`AdminAuditLog`, the `businessType` gating pattern). New code should look like it was written by the same team that wrote those, not like a fresh start.
- **Confirm, don't assume, the actual current file locations** (`apps/gateway` vs `apps/backend` — this was flagged as unresolved back when the ISP implementation plan first came in, and never confirmed) before writing a single file path into a plan.

### 1.2 Non-regression discipline
- Run the existing test suite **before** starting and record the result. If it's not green before you start, that's a pre-existing issue to flag, not something to fix as a side effect of this task.
- Run it again after every meaningful change, not just at the end — catch a regression at the commit that caused it, not three phases later.
- Stay inside the declared scope of the phase. Touching files outside what the phase's "API"/"Frontend"/"Data model" lines describe requires stopping and flagging it, not proceeding silently — scope creep in an agent-driven build is how "fix one thing, break three unrelated things" happens unnoticed.
- New tables/columns are additive (nullable new fields, new tables) — nothing in these builds should require a breaking migration of existing `Invoice`, `InventoryTransaction`, `Organization`, or `Subscriber` data. If a phase seems to need one, stop and flag it rather than writing it.

### 1.3 Linting, type-checking, and CI
- Locate the actual configured commands in the repo (`package.json` scripts, any `.github/workflows/*` or equivalent CI config) and run **those** — do not guess a command name like `npm run lint` without confirming it's what the repo actually defines.
- A layer is not done if lint, type-check, or the existing test suite fail — this is a hard gate, not a warning to note and move past.
- If CI is configured to run on push/PR, the agent's branch must pass it before the phase is marked `Done` in the relevant doc's progress tracker — don't mark done locally and let CI catch problems after the fact.

### 1.4 Tooling
- Use the repo's own package manager and scripts, not ad-hoc commands that bypass configured tooling (e.g. don't hand-invoke a compiler directly if the repo has a build script that does more, like running codegen for Prisma).
- **If an MCP-exposed Rust-based lint/static-analysis tool is available in the agent's environment** (e.g. a Biome- or oxlint-class tool, faster and stricter than the JS-native equivalents), it should be used as an additional verification pass before a layer is marked done — but confirm the exact tool name and invocation actually available in-environment first; do not assume one exists or guess its interface.
- File edits: prefer targeted, minimal-diff edits over full-file rewrites wherever the tooling supports it — smaller diffs are easier to review and regress-check.

### 1.5 Definition of "Done" — applies to every layer below, on top of each phase's own doc-specified criteria
A layer is done when, and only when:
1. The phase's own "Done when" criteria (from the source `.md`) are met and demonstrably verified, not assumed.
2. Existing tests still pass; new functionality has its own tests covering at least the phase's "Done when" scenario.
3. Lint and type-check are clean per Section 1.3.
4. The relevant doc's progress tracker row is updated to `Done`, with a note (PR link, date) — this is part of the deliverable, not cleanup work for someone else.
5. Nothing outside the phase's declared scope changed.

### 1.6 Build order: backend before frontend, not backend-then-forget-frontend
Each phase below is split into a Backend prompt and a Frontend prompt. Backend goes first because frontend needs a stable API contract to build against — but the frontend prompt should be drafted and reviewed **before** backend work starts, not written as an afterthought once backend is "done." Issue the frontend prompt as soon as the backend API contract (endpoint shapes, request/response types) is stable enough to build against, even if backend implementation is still being finished — don't let frontend sit idle waiting for a "fully done" backend when the contract itself is already settled.
