import { SignUp } from '@clerk/nextjs';
import { AuthShell } from '@/components/auth/AuthShell';
import { clerkAppearance } from '@/lib/clerk-appearance';

const VALID_PLANS = ['solo', 'team', 'growth'];

/**
 * Sign-up preserves advisory plan intent from the public pricing CTAs. The
 * intent travels to onboarding as `?plan=` and is stored on the new
 * organization as a preference — never a purchase
 * (`hisaflow-landing-page.md` Sections 5.2 and 7, Layer L-D).
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const normalized = plan?.toLowerCase();
  const redirectUrl =
    normalized && VALID_PLANS.includes(normalized)
      ? `/onboarding?plan=${normalized}`
      : '/onboarding';

  return (
    <AuthShell>
      <SignUp appearance={clerkAppearance} forceRedirectUrl={redirectUrl} />
    </AuthShell>
  );
}
