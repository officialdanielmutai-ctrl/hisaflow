# AI Workflow Rules

## Approach

Build Hisaflow incrementally using a spec-driven workflow. The context files
define what to build, how to build it, and the current state of progress.
Always implement against these specs — do not infer or invent behavior from
scratch.

The build order defined in `project-overview.md` is intentional:
foundation → operational truth → operational flows → awareness →
AI assistance → resilience. Do not skip ahead. The deterministic inventory
core must stabilize before the AI ingestion layer is built on top of it.

## Scoping Rules

- Work on one feature unit at a time.
- Prefer small, verifiable increments over large speculative changes.
- Do not combine unrelated system boundaries in a single implementation step.
- A "unit" is complete only when it works end-to-end: UI renders, API
  responds, database persists, and errors are handled. Half-complete units are
  not acceptable checkpoints.
- When building the AI ingestion layer, never allow AI output to reach the
  inventory state directly. Every AI path must pass through the proposal model
  and a human confirmation step.

## When to Split Work

Split an implementation step if it combines:

- Frontend UI changes and backend business logic changes simultaneously
- Multiple unrelated API routes or domain modules in a single step
- AI extraction logic and inventory mutation logic in the same unit
- Behavior that is not clearly defined in the context files
- A change whose correctness cannot be verified end-to-end in a single session

If a change cannot be verified end-to-end quickly, the scope is too broad —
split it.

## Handling Missing Requirements

- Do not invent product behavior not defined in the context files.
- If a requirement is ambiguous, resolve it in the relevant context file
  before implementing.
- If a requirement is missing, add it as an open question in
  `progress-tracker.md` before continuing.
- If a technical decision conflicts with an architectural invariant defined in
  `architecture.md`, surface the conflict as an open question — do not
  silently override the invariant.

## Protected Patterns

Do not change the following without an explicit instruction that references
the architectural reason for the change:

- `components/ui/` — shadcn primitives; treat as a vendor layer
- The AI proposal/confirmation boundary — AI must never commit directly to
  inventory
- The `organization_id` scoping requirement — every business-data query must
  be tenant-scoped
- The append-only nature of the inventory transaction ledger
- The authentication guard and organization membership guard chain in NestJS
  controllers

## Keeping Docs in Sync

Update the relevant context file whenever implementation changes affect:

- System architecture or module boundaries (`architecture.md`)
- Storage model decisions (`architecture.md`)
- Code conventions or patterns (`code-standards.md`)
- Feature scope, in-scope / out-of-scope decisions (`project-overview.md`)
- Design tokens, component conventions, or layout patterns (`ui-context.md`)

## AI-Specific Workflow Rules

- The AI ingestion pipeline (OCR, transcription, text parsing) always produces
  an `InventoryProposal` record with `status: pending_review`. This is the
  only valid output from the `ai-ingestion` module.
- The `inventory` module owns the decision to accept a proposal and commit it
  as a transaction. It receives a confirmed proposal; it does not receive raw
  AI output.
- Confidence scores are surfaced to the user in plain language:
  - `high` → "Looks correct"
  - `medium` → "Please review"
  - `low` → "Needs attention"
  Never expose raw numeric scores.
- When implementing the AI review interface, corrections must be inline (on the
  proposal card itself). Do not open a separate edit screen for corrections.
- Voice input must always display the full transcript before showing the
  extracted proposal. Users must be able to compare the transcript against
  the structured output.

## Before Moving to the Next Unit

1. The current unit works end-to-end within its defined scope.
2. No invariant defined in `architecture.md` was violated.
3. `progress-tracker.md` reflects the completed work and any architectural
   decisions made during the session.
4. `npm run build` (frontend) and `nest build` (backend) both pass with no
   TypeScript errors.
5. Any new environment variables are documented in `.env.example`.
