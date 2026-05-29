# Code Standards

## General

- Keep modules small and single-purpose. A file that does two unrelated things
  should be split into two files.
- Fix root causes, not symptoms. Do not add a workaround on top of broken
  logic; find and fix the broken logic.
- Do not mix unrelated concerns in a single component, service, or route. UI
  rendering, data fetching, and business validation each belong in separate
  layers.
- Every feature must be deployable end-to-end before moving to the next
  feature. No half-connected layers.
- Prefer readable and debuggable code over clever abstractions. Hisaflow is
  operational software — maintainability is a first-class requirement.

## TypeScript

- Strict mode is required throughout the project (`"strict": true`).
- Avoid `any`. Use explicit interfaces, type aliases, or narrowly scoped
  generic constraints.
- Validate and narrow unknown external input (API responses, AI output, OCR
  results, form data) at every system boundary using Zod or class-validator
  before trusting it.
- Define domain models as interfaces in a `types/` or `domain/` layer, not
  inline in component files.
- Use discriminated unions for state machines (e.g. AI extraction states:
  `idle | uploading | processing | reviewing | confirmed | failed`).
- Prisma-generated types are the authoritative DB shapes; extend them with
  application-layer types rather than redefining them.

## Next.js (Frontend)

- Default to Server Components. Add `"use client"` only when the component
  requires browser-side interactivity (event listeners, local state, browser
  APIs).
- Keep route handlers (`app/api/`) focused on a single responsibility:
  authenticate, validate input, call the backend API or service, return a
  typed response.
- Use TanStack Query for all client-side data fetching. Do not use raw `fetch`
  or `useEffect` for server data synchronisation.
- Optimistic updates via TanStack Query `onMutate` are allowed for low-stakes
  actions (mark alert read, add note). Do not use optimistic updates for
  inventory mutations or AI commits.
- Never compute inventory balances on the frontend. The backend owns
  operational truth.
- Never make unscoped API calls. Every request to the backend must carry the
  authenticated session token in the Authorization header.
- Route protection uses Clerk middleware. Public routes are explicitly listed;
  everything else is protected by default.

## NestJS (Backend)

- Each module has: a module file, a controller, one or more services, a
  repository (or Prisma calls isolated in a dedicated service), and a DTOs
  folder.
- DTOs use class-validator decorators for input validation. Validation runs
  through the global `ValidationPipe` before any controller method executes.
- Controllers handle: authentication guard, authorization guard, input
  parsing, and delegation to a service. No business logic in controllers.
- Services own business logic. They call repositories (or Prisma) and emit
  domain events. They do not import other modules' services directly — they
  use the event bus or explicit service contracts.
- Use NestJS `EventEmitter2` for internal domain events. Event names follow
  the format `domain.EventName` (e.g. `inventory.StockBelowThreshold`).
- BullMQ jobs are defined in `jobs/`. Workers import domain services to
  execute work. Workers do not duplicate business logic.

## Styling

- Use CSS custom property tokens from `globals.css`. No hardcoded hex values
  anywhere in component files.
- Token naming convention: `--color-{role}`, `--radius-{context}`,
  `--spacing-{scale}`, `--shadow-{level}` (see `ui-context.md` for the full
  token table).
- Tailwind utility classes reference token values through the Tailwind config;
  do not use arbitrary values (e.g. `bg-[#1F7A5A]`) — reference the token
  instead.
- Use the Hisaflow semantic component layer (`components/system/`) before
  reaching for raw shadcn primitives. If a semantic component does not exist
  yet, create it before using a raw primitive.
- Never rely on color alone to communicate status. Always pair semantic colors
  with an icon, label, or text description.
- Mobile-first: write base styles for mobile and layer up with `md:` and `lg:`
  breakpoints. Touch targets must be at least 44px in height.

## API Routes (Next.js) and Controllers (NestJS)

- Validate and parse all request input before any logic runs.
- Enforce authentication (Clerk JWT) and organization membership before any
  mutation or query.
- All business-data queries must include an explicit `organization_id` scope.
  Queries without tenant scoping are a critical violation.
- Return consistent, predictable response shapes. Success responses include
  `data`; error responses include `error.code` and `error.message`.
- Return correct HTTP status codes: 200/201 for success, 400 for validation
  errors, 401 for unauthenticated, 403 for unauthorized, 404 for not found,
  500 for unexpected server errors.
- Do not run long-lived AI or OCR work inside a request handler. Enqueue a
  BullMQ job and return a job ID immediately.

## Data and Storage

- Structured operational data (inventory, transactions, alerts, audit) belongs
  in PostgreSQL.
- Binary assets (images, audio, CSVs, PDFs) belong in R2/S3. PostgreSQL
  stores only the storage key reference.
- Redis stores only ephemeral state. If Redis is wiped, the system must
  continue to function correctly using PostgreSQL as the source of truth.
- Never store AI LLM output directly as inventory state. Store it as a
  proposal with status `pending_review` in a separate table, linked to the
  upload that produced it.
- Prisma migrations are required for all schema changes. Never manually alter
  the production database schema.
- All queries against business data must be wrapped in an organization scope.
  Use a typed repository helper to enforce this rather than repeating
  `WHERE organization_id = ?` by hand.

## File Organisation

- `features/{feature}/` — All UI, hooks, and client state for a feature
  domain. Features do not reach into each other's internals.
- `components/system/` — Hisaflow semantic components. Named after operational
  concepts, not visual descriptions (e.g. `AttentionFeed`, not `AlertList`).
- `components/ui/` — Raw shadcn primitives. Treat as a read-only vendor layer.
- `components/mobile/` — Mobile-specific interaction patterns (bottom sheets,
  floating action buttons, swipe actions).
- `lib/` — Generic utilities only (date, money, units). No business logic.
- `services/` — API client functions that call the NestJS backend. One file
  per domain module.
- `hooks/` — Reusable React hooks that combine TanStack Query with application
  logic (e.g. `useInventoryItem`, `useAlerts`, `useAIProposal`).
- `types/` — Shared TypeScript interfaces and enums used across features.
