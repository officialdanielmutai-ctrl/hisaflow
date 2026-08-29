# HisaFlow Staff Admin Controls — Agent Brief

## Context

HisaFlow already has a working staff system, not a blank slate:

- Orgs have three roles: `OWNER`, `MANAGER`, `STAFF` (`OrgMembership.role` in `prisma/schema.prisma`).
- Staff join via an invite code (`Organization.inviteCode`); `OrganizationsService` in
  `apps/backend/src/modules/organizations/` handles this today.
- Server-side enforcement already exists via a real `RolesGuard` reading actual DB
  membership per request — this is not just frontend button-hiding, it's a solid
  foundation to extend.
- Multi-org support (`OrgSwitcher`) recently shipped. This exposed a real bug worth
  fixing as part of this work, not around it: `getMyInviteCode`, `regenerateInviteCode`,
  and `getStaffMembers` in `organizations.service.ts` resolve "the org" via
  `findFirst` across *all* of the caller's memberships, instead of taking an explicit
  org id. For a user who owns two businesses, this can silently return the wrong one.
  Every new endpoint in this brief must use `@OrgContext()` (reads `x-organization-id`,
  used consistently everywhere else in the codebase) — and the three existing broken
  calls should be fixed onto the same pattern, in place, not left to coexist.
- Clerk session revocation is confirmed available with no new dependency:
  `@clerk/backend@3.4.14` is already installed and configured (`ClerkAuthGuard` already
  uses it). The relevant calls are `clerkClient.sessions.getSessionList({ userId })` to
  enumerate a user's active sessions, then `clerkClient.sessions.revokeSession(sessionId)`
  on each. This does **not** touch their Clerk account itself — they can sign in fresh
  afterward and join a different org with a new invite code.
- Notes live in `apps/backend/src/modules/notes/` (backend) and
  `apps/frontend/components/notes/` + `apps/frontend/app/(dashboard)/notes/` (frontend).
- Frontend permission checks currently live in `apps/frontend/hooks/useRole.ts` as a
  small set of hardcoded booleans derived from role (e.g. something like
  `canEditInventory`). **Read this file first** — the new permission system's naming
  should extend/reuse whatever vocabulary already exists there, not invent parallel
  names for the same concepts. If `useRole.ts` already calls something `canEditInventory`,
  the new permission key is `canEditInventory`, not a fresh `MANAGE_INVENTORY`.

## Goal

Give the org `OWNER` (not `MANAGER` — this is owner-exclusive authority) real admin
control over staff:

1. **Permanently remove a staff member.** Deletes their `OrgMembership` for this org
   only (their `User` row and any other org memberships they hold are untouched — this
   preserves attribution on their historical Notes/Transactions and doesn't break
   multi-org access elsewhere). Revokes their live Clerk sessions so they're actually
   logged out, not just blocked on their next API call. They can rejoin later with a
   fresh invite code, same as any new staff member.
2. **Grant or revoke individual permissions per staff member**, from a fixed,
   enumerated list of real capabilities already present in the app — not an
   open-ended/arbitrary toggle system. A staff member's effective permissions = their
   role's baseline, plus anything explicitly granted, minus anything explicitly revoked.
3. **Restrict specific notes from specific staff members.** A restricted note is fully
   invisible to blocked staff — absent from their notes list entirely, not shown-but-locked.
   The author and the `OWNER` can always see it regardless of restriction.

---

## Non-negotiable: preserving code integrity

This is a standing constraint across every phase below, not a one-time checklist item.
The failure mode to avoid is **structural erosion** — the tendency, when iterating under
time pressure, to take the path of least resistance: stacking new logic into whatever
file is already open, writing one large function that does five things instead of five
small ones, and leaving inconsistent patterns to coexist "for later cleanup" that never
happens. Concretely, for this feature:

- **Watch file size, don't just make it compile.** Before adding to `organizations.service.ts`,
  check its current line count. If this feature would make it the largest service in the
  codebase, that's the signal to split staff-lifecycle logic into its own service
  (e.g. `StaffAdminService`) rather than growing the existing one further. Org
  CRUD/invite-code-generation is a different responsibility from staff
  removal/permission-management — they can live in the same module but don't need to be
  the same class.
- **Decompose even single-caller logic.** "Kick a staff member" is at least three
  distinct steps — validate the caller is `OWNER`, delete the membership, revoke Clerk
  sessions. Write these as separately named methods even though only one call site uses
  them together. A wall-of-code function that does all three inline is not reviewable or
  testable as a unit; three named steps are.
- **One source of truth for "what can this person do."** The permission-check guard and
  the `GET .../my/permissions` endpoint (used by the frontend) must call the *same*
  underlying function to compute effective permissions. Two independent implementations
  of the same logic will drift the first time either one gets a bugfix the other doesn't.
- **Fix inconsistencies in place, don't add a parallel correct path next to the old wrong
  one.** The `findFirst`-based org resolution bug described above gets fixed on the
  existing methods directly. Do not leave the old ambiguous pattern sitting next to a new
  `@OrgContext()`-based pattern in the same file "to avoid touching working code" — that
  coexistence is itself the erosion this brief is trying to prevent.
- **Reuse existing naming/vocabulary** (see `useRole.ts` note above) rather than
  introducing synonyms for concepts that already have an established name.
- **Every phase ends in a working, deployable state.** No phase should leave dead code,
  unused imports, or a half-wired feature waiting on "part 2" to function. If a phase's
  scope turns out to need splitting further once you're in the code, split it — don't
  compress it back together to hit an artificial phase count.

---

## Phases

Each phase is independently gradeable — don't move to the next until the Definition of
Done for the current one actually holds, not just "the code compiles."

### Phase 1 — Schema

Add, additively (no existing behavior changes):

- `OrgMembership.grantedPermissions String[] @default([])`
- `OrgMembership.revokedPermissions String[] @default([])`
- New model `NoteRestriction` — `id`, `noteId` (FK to `Note`), `userId` (FK to `User`),
  unique on `(noteId, userId)`.

**Definition of Done:**
- Migration applies cleanly to a fresh copy of the dev database.
- Every existing `OrgMembership` row gets the new columns defaulted to empty arrays —
  confirm by querying a couple of existing rows post-migration, don't just trust the
  default.
- Hit 2–3 existing endpoints that touch `OrgMembership` or `Note` (e.g. staff list,
  notes list) and confirm their responses are byte-for-byte unchanged from before the
  migration. This phase should be invisible to every existing feature.

### Phase 2 — Permission engine (new primitive, not wired to anything destructive yet)

- Define the fixed permission list as a single exported constant (one file, one
  definition — every other reference imports it, nothing re-lists the values).
  Derive the actual names from `useRole.ts` per the Context section above.
  `MANAGE_STAFF` is a special case: it is never grantable/revokable via override — it's
  implicitly `OWNER`-only and should be called out as such in code, not silently
  omitted from the list with no explanation.
- Write one pure function, e.g. `computeEffectivePermissions(role, grantedPermissions,
  revokedPermissions)`, that returns the resolved permission set. This is the single
  source of truth referenced by both of the below.
- A guard/decorator (e.g. `@RequiresPermission(...)`) that uses this function to protect
  routes.
- `GET /organizations/my/permissions` (uses `@OrgContext()`), returning the same
  function's output for the calling user in the active org.

**Definition of Done:**
- A fresh `STAFF` row with empty override arrays resolves to exactly that role's
  baseline permissions.
- Granting a permission not in the role's baseline makes it appear in the resolved set.
- Revoking a permission that *is* in the role's baseline makes it disappear, even though
  the role would otherwise include it.
- Grep the codebase for the permission list and the resolver function — each should
  have exactly one definition, referenced everywhere else.

### Phase 3 — Staff lifecycle (removal + permission editing)

New dedicated service for staff account lifecycle (split out per the file-size guidance
above if `organizations.service.ts` is already large — make the call once you've seen
its actual current size).

- Fix the three existing ambiguous-org-resolution methods described in Context, in
  place, onto `@OrgContext()`.
- `DELETE` endpoint to remove a staff member: `OWNER`-only, deletes the `OrgMembership`,
  enumerates and revokes the user's active Clerk sessions. Decomposed into named steps
  per the guidance above, not one inline block.
- `PATCH` endpoint to update a staff member's `grantedPermissions`/`revokedPermissions`,
  `OWNER`-only, using Phase 2's resolver to validate the resulting set makes sense
  (e.g. reject attempts to grant `MANAGE_STAFF`).

**Definition of Done:**
- Kicking a staff member removes them from the staff list immediately.
- A live session for that user gets rejected on its very next request after revocation
  (test with their actual pre-revocation token, not a fresh one).
- Their historical Notes/Transactions still display their name/attribution unchanged
  after removal.
- They can rejoin via a fresh invite code afterward with no leftover state blocking
  re-entry.
- With the org-resolution fix in place: a user who owns two orgs gets the *correct*
  org's staff list/invite code for each, not an arbitrary one — test this explicitly,
  it's the regression this phase is meant to close.
- A `MANAGER` attempting either endpoint is rejected; only `OWNER` succeeds.

### Phase 4 — Note restriction (backend)

Schema already exists from Phase 1.

- Extend note create/update to accept a list of restricted user ids, writing
  `NoteRestriction` rows.
- Filter the notes-list query to exclude any note with a `NoteRestriction` row for the
  requesting user — unless they're the note's author or the org `OWNER`.

**Definition of Done:**
- A note restricted for user X is absent from X's notes-list *API response* (check the
  raw response, not just what renders — a client-side-only filter would be a false pass
  here and defeats the point).
- The author and `OWNER` see the restricted note regardless.
- An unrestricted note is visible to everyone, unchanged from current behavior — confirm
  no regression on the common (non-restricted) case.

### Phase 5 — Frontend admin UI

- New staff-admin screen: list staff, per-staff permission toggles (from the fixed
  list), remove-staff action with a confirmation step given it's irreversible in effect
  (they'd need a new invite code to return).
- Note composer: let the `OWNER` pick which staff to restrict from a given note.
- Update `useRole.ts` (or wherever it's consumed) to reflect real effective permissions
  fetched from Phase 2's endpoint, rather than only the current hardcoded role booleans.

**Definition of Done:**
- An `OWNER` can perform every control in this brief entirely from the UI — no devtools
  or direct API calls needed to exercise the feature.
- A `STAFF`/`MANAGER` user without the relevant permission does not see the staff-admin
  screen in navigation at all (absent, not just disabled/greyed out).

### Phase 6 — Frontend session-loss handling

- Detect an auth failure caused by a revoked session (distinguish from a generic 401 if
  needed) and redirect to a clear "you no longer have access to this organization"
  state, not a raw error or blank screen.

**Definition of Done:**
- Manually revoke a test staff member's session while their tab is still open, then
  interact with the app as them — they land on the clear removed-state screen within
  one interaction, not a crash, console-only error, or silent stall.

---

## Order

Phases are listed in dependency order — 1 before 2 (schema before code that reads it),
2 before 3 (permission engine before the endpoint that validates against it), 1 and 3
before 4 (schema and the org-context fix pattern established before repeating it), 2–4
before 5 (backend before the UI that calls it), 5 before 6 (the removal flow needs to
exist before there's a session to lose). Don't parallelize phases 2 and 3 even though
they touch different files — 3 depends on 2's resolver function existing first.
