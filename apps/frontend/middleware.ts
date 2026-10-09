import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { appUrl, siteUrl } from '@/features/marketing/config/site';

const isPublicRoute = createRouteMatcher([
  // Public marketing surface. `/` serves the landing page to logged-out
  // visitors; authenticated visitors are redirected to the dashboard below.
  '/',
  '/legal(.*)',
  // Static SEO routes must be crawlable without auth.
  '/robots.txt',
  '/sitemap.xml',
  // Internal component gallery. It 404s in production (see the route).
  '/gallery(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health',
  '/manifest.json',
  '/sw.js',
  '/icons/(.*)',
]);

/**
 * Marketing-only routes. Everything else (dashboard, onboarding, paywall,
 * settings, sign-in/up, view-as) belongs to the authenticated app, so it is
 * redirected to the app subdomain when the two origins are split.
 */
const isMarketingRoute = createRouteMatcher([
  '/',
  '/legal(.*)',
  '/robots.txt',
  '/sitemap.xml',
  '/gallery(.*)',
  '/manifest.json',
  '/sw.js',
  '/icons/(.*)',
]);

function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

// `NEXT_PUBLIC_APP_URL` opt-in: when it is unset (local dev, CI, unit tests)
// the app stays single-origin and this middleware behaves exactly as before.
const SITE_HOST = hostOf(siteUrl());
const APP_HOST = hostOf(appUrl());
const SPLIT = APP_HOST !== null && SITE_HOST !== null && APP_HOST !== SITE_HOST;

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get('host');

  if (SPLIT && SITE_HOST) {
    // Normalise `www` to the canonical marketing apex.
    if (host === `www.${SITE_HOST}`) {
      return NextResponse.redirect(
        new URL(`https://${SITE_HOST}${pathname}${search}`),
      );
    }

    if (host === APP_HOST) {
      // Keep crawlers out of the app subdomain.
      if (pathname === '/robots.txt') {
        return new NextResponse('User-agent: *\nDisallow: /\n', {
          headers: { 'content-type': 'text/plain' },
        });
      }
      // The app root is the dashboard, never the marketing landing page.
      if (pathname === '/') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
      // Legal pages are hosted on the marketing apex.
      if (pathname.startsWith('/legal') || pathname === '/sitemap.xml') {
        return NextResponse.redirect(
          new URL(`https://${SITE_HOST}${pathname}${search}`),
        );
      }
    } else if (host === SITE_HOST) {
      // App routes (including sign-in/up) belong on the app subdomain.
      if (!isMarketingRoute(request) && !pathname.startsWith('/api/')) {
        return NextResponse.redirect(
          new URL(`https://${APP_HOST}${pathname}${search}`),
        );
      }
    }
  }

  // Authenticated visitors go to the dashboard; the landing page is for
  // logged-out visitors only (`hisaflow-landing-page.md` Sections 1 and 5.1).
  if (pathname === '/' && userId) {
    const target =
      SPLIT && APP_HOST ? `https://${APP_HOST}/dashboard` : '/dashboard';
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
