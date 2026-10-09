import type { Metadata } from 'next';
import { LegalShell } from '@/components/marketing/LegalShell';
import { SITE } from '@/features/marketing/config/site';

export const metadata: Metadata = {
  title: 'Terms of Service: HisaFlow',
  description:
    'The terms that govern your use of HisaFlow, including trials, subscriptions, payment and acceptable use.',
  alternates: { canonical: '/legal/terms' },
};

const UPDATED = '1 October 2026';

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated={UPDATED}>
      <p>
        These terms govern your use of HisaFlow. By creating an account or using
        the service, you agree to them. If you are using HisaFlow for a
        business, you confirm you are authorised to accept these terms for that
        business.
      </p>

      <h2>Your account</h2>
      <p>
        You are responsible for the accuracy of the information you provide and
        for keeping your login credentials secure. You must be old enough to
        enter into a contract and must not share access in a way that breaks
        these terms.
      </p>

      <h2>Free trial</h2>
      <p>
        New organizations get a 14-day free trial with full Team access. No
        card is required to start. When the trial ends you choose a plan to keep
        using HisaFlow; if a renewal does not go through, a grace period applies
        before access is restricted.
      </p>

      <h2>Subscriptions and payment</h2>
      <ul>
        <li>
          Plans are billed monthly in Kenyan Shillings. Current prices and
          features are shown in the app and on our pricing page.
        </li>
        <li>
          Payments are processed by Paystack. You can pay by M-Pesa or card.
          M-Pesa renewals need an approval on your phone each billing cycle;
          card renewals are automatic.
        </li>
        <li>
          Upgrades take effect immediately. Downgrades apply at your next
          renewal. You can cancel at any time and keep access until the end of
          the period you have paid for.
        </li>
      </ul>

      <h2>Your data</h2>
      <p>
        The business records you enter belong to your organization. You grant
        us the limited rights we need to store, process and display that data
        so we can provide the service. Our{' '}
        <a href="/legal/privacy">Privacy Policy</a> explains how we handle
        personal data.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not use HisaFlow for anything unlawful or fraudulent.</li>
        <li>
          Do not attempt to break, overload or gain unauthorised access to the
          service or another organization&apos;s data.
        </li>
        <li>Do not upload malicious code or content you have no right to use.</li>
      </ul>

      <h2>Availability and changes</h2>
      <p>
        We work to keep HisaFlow available, but we may need to interrupt it for
        maintenance or updates. We may add, change or remove features over time.
        We will give reasonable notice of changes that materially reduce what
        you have paid for.
      </p>

      <h2>Liability</h2>
      <p>
        HisaFlow is provided as-is. To the extent the law allows, we are not
        liable for indirect or consequential losses, or for loss of profit,
        data or business opportunity. Nothing in these terms limits liability
        that cannot be limited by law. You are responsible for keeping your own
        backups of critical records.
      </p>

      <h2>Ending the agreement</h2>
      <p>
        You can stop using HisaFlow and cancel at any time. We may suspend or
        end your access if you seriously or repeatedly break these terms, or
        where we are required to by law.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of Kenya, and disputes are subject
        to the jurisdiction of the Kenyan courts.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Contact us at{' '}
        <a href={`mailto:${SITE.contactEmail || 'support@hisaflow.co.ke'}`}>
          {SITE.contactEmail || 'support@hisaflow.co.ke'}
        </a>
        .
      </p>

      <p>
        This is a plain-language summary prepared for review. It does not
        replace legal advice, and the wording is subject to review by qualified
        counsel before launch.
      </p>
    </LegalShell>
  );
}
