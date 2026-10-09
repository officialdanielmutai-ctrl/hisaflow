# HisaFlow — Deployment & Domains

**Status:** production configuration for the public landing page and the app.
**Related:** `hisaflow-landing-page.md` (funnel, claims, phases), `hisaflow-landing-visual-spec.md` (build), `hisaflow-agent-build-briefs.md` Part 1 (CI/DoD).

This document records how the marketing site and the authenticated app are hosted, how the production domain and the app subdomain are wired, and the environment variables each environment needs.

---

## 1. Target topology

| Surface | Domain | Serves |
|---|---|---|
| Marketing site | `hisaflow.co.ke` (apex) | Landing page, `/legal/*`, `sitemap.xml`, `robots.txt` |
| App | `app.hisaflow.co.ke` | Dashboard, onboarding, paywall, settings, sign-in/sign-up |
| Backend API | `api.hisaflow.co.ke` (or the platform's URL) | `NEXT_PUBLIC_API_URL` |

`www.hisaflow.co.ke` redirects to the apex. The apex and the app subdomain are **two domains on one deployment**; host-aware routing in `apps/frontend/middleware.ts` decides what each host may serve.

## 2. Hosting (Vercel, pnpm monorepo)

1. Create a Vercel project from the repo.
2. Set **Root Directory** to `apps/frontend` so Vercel installs from the workspace root and builds the Next.js app.
3. Framework preset: **Next.js** (default). Build command `pnpm build`, output handled by the framework.
4. Add both domains to the project (Project → Settings → Domains):
   - `hisaflow.co.ke` (primary)
   - `www.hisaflow.co.ke` → redirect to `hisaflow.co.ke`
   - `app.hisaflow.co.ke`
5. DNS (at the registrar, `.co.ke`):
   - `A` `@` → Vercel's `76.76.21.21` (or the value Vercel shows)
   - `CNAME` `www` → `cname.vercel-dns.com`
   - `CNAME` `app` → `cname.vercel-dns.com`
   - `CNAME` `api` → the backend host

Preview deployments keep their `*.vercel.app` host. Because `NEXT_PUBLIC_APP_URL` is compared against the request host, host routing is a no-op on preview hosts and on `localhost`.

## 3. Environment variables

Set these for **Production** (and, where sensible, Preview) in the host dashboard. The full list with comments lives in `apps/frontend/.env.example`.

| Variable | Production value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://hisaflow.co.ke` | Canonical origin: metadata, Open Graph, sitemap, robots, JSON-LD |
| `NEXT_PUBLIC_APP_URL` | `https://app.hisaflow.co.ke` | Opt-in split: auth CTAs become absolute and middleware routes app paths to the subdomain. Leave unset for single-origin dev/preview. |
| `NEXT_PUBLIC_API_URL` | `https://api.hisaflow.co.ke` | Backend base URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | from Clerk | Must include both production domains in Clerk's allowed origins |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | Path, resolved on the app subdomain |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | Path, resolved on the app subdomain |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard` | |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/onboarding` | |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | E.164 digits | Omit to hide WhatsApp CTAs |
| `NEXT_PUBLIC_CONTACT_EMAIL` | support mailbox | Omit to hide the email link |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | web-push key | Push notifications |
| `NEXT_PUBLIC_ENABLE_GALLERY` | `false` | `/gallery` 404s unless exactly `true` |

Secrets (`CLERK_SECRET_KEY`, database URLs) are **never** committed. `.env.local` is gitignored.

## 4. Routing rules (implemented in `middleware.ts`)

Active only when `NEXT_PUBLIC_APP_URL` is set and differs from `NEXT_PUBLIC_SITE_URL`.

| Host | Path | Result |
|---|---|---|
| `www.*` | any | `308` to apex, same path |
| app subdomain | `/` | redirect to `/dashboard` |
| app subdomain | `/legal/*`, `/sitemap.xml` | redirect to the apex |
| app subdomain | `/robots.txt` | `Disallow: /` (the app is not indexed) |
| apex | app paths (`/dashboard`, `/onboarding`, `/paywall`, `/settings`, `/sign-in`, `/sign-up`, `/view-as`, …) | redirect to the app subdomain |
| apex | `/`, `/legal/*`, `/sitemap.xml`, `/robots.txt`, static assets | served |
| either | `/api/*` | never cross-host redirected |

Authenticated visitors landing on the apex `/` still go to the dashboard, now directly on the app subdomain when it is configured.

## 5. SEO

- `metadataBase` / canonical, Open Graph, `sitemap.xml`, `robots.txt` and `Organization`/`FAQ` JSON-LD all resolve from `NEXT_PUBLIC_SITE_URL` (`features/marketing/config/site.ts`), so the apex is the only indexable origin.
- The app subdomain answers `robots.txt` with `Disallow: /` and is excluded from the sitemap.
- Legal pages stay on the apex so their URLs remain stable.

## 6. Release checklist

1. `pnpm --filter frontend build` and `pnpm --filter frontend test` are green locally.
2. CI (`typecheck`, `lint`, tests, `build`) is green on the release branch / PR.
3. Production env vars from Section 3 are set on the host.
4. Both domains resolve and show valid TLS certificates.
5. `https://hisaflow.co.ke/` renders the landing page; `https://app.hisaflow.co.ke/` lands on `/dashboard`.
6. `https://hisaflow.co.ke/sitemap.xml` and `/robots.txt` return the apex origin.
7. Authenticated `/` on the apex redirects to the app subdomain.
8. Lighthouse mobile meets the Section 5.4 budget on the marketing URL.
