import type { Metadata } from 'next';
import { LegalShell } from '@/components/marketing/LegalShell';
import { SITE } from '@/features/marketing/config/site';

export const metadata: Metadata = {
  title: 'Privacy Policy: HisaFlow',
  description:
    'How HisaFlow collects, uses, stores and protects personal and business data under the Kenya Data Protection Act.',
  alternates: { canonical: '/legal/privacy' },
};

const UPDATED = '1 October 2026';

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated={UPDATED}>
      <p>
        This policy explains what information HisaFlow collects when you use
        the app or this website, why we collect it, and the choices you have.
        It is written for the Kenya Data Protection Act, 2019 (the &ldquo;DPA&rdquo;).
      </p>

      <h2>Who we are</h2>
      <p>
        HisaFlow is a business management app for Kenyan small businesses,
        built and operated in Kenya. For questions about this policy or your
        data, contact us at{' '}
        <a href={`mailto:${SITE.contactEmail || 'privacy@hisaflow.co.ke'}`}>
          {SITE.contactEmail || 'privacy@hisaflow.co.ke'}
        </a>
        .
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your name, email address and phone
          number, handled by our authentication provider, Clerk, so you can sign
          in.
        </li>
        <li>
          <strong>Business data:</strong> the products, sales, customers,
          bookings, invoices and other records you enter into your organization.
          This belongs to your business.
        </li>
        <li>
          <strong>Payment data:</strong> subscription payments are processed by
          Paystack. We receive confirmation and a payment reference; we do not
          store full card numbers or M-Pesa PINs.
        </li>
        <li>
          <strong>Usage data:</strong> basic technical information such as device
          type and page views, used to keep the service working and improve it.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To provide, operate and secure the HisaFlow service.</li>
        <li>To process subscriptions and send billing and service messages.</li>
        <li>To give you support when you ask for it.</li>
        <li>To understand how the product is used so we can improve it.</li>
      </ul>

      <h2>Legal basis</h2>
      <p>
        We process personal data to perform our contract with you, to comply
        with legal obligations (for example, tax and accounting records), for
        our legitimate interest in running and securing the service, and, where
        required, on the basis of your consent. You can withdraw consent at any
        time without affecting earlier processing.
      </p>

      <h2>Sharing</h2>
      <p>
        We do not sell your personal data. We share it only with service
        providers that help us run HisaFlow, under contract and only as needed:
        Clerk (authentication), Paystack (payments), and the hosting and
        infrastructure providers that run the service. We may disclose data
        where the law requires it.
      </p>

      <h2>Retention</h2>
      <p>
        We keep business records for as long as your organization is active and
        for any period required by law afterwards. When you close your account,
        we delete or anonymise personal data unless we are legally required to
        keep it.
      </p>

      <h2>Your rights</h2>
      <p>
        Under the DPA you can ask to access, correct or delete your personal
        data, object to or restrict certain processing, and request a copy of
        data you provided. Contact us and we will respond within the time the
        law allows. You may also complain to the Office of the Data Protection
        Commissioner.
      </p>

      <h2>Security</h2>
      <p>
        We use access controls so staff only see the organization they belong
        to, encrypt data in transit, and limit who inside HisaFlow can access
        production systems. No system is perfectly secure, but we work to
        protect your data and to tell you about significant incidents.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we make material changes we will update the date above and, where
        appropriate, tell you in the app or by email.
      </p>

      <p>
        This is a plain-language summary prepared for review. It does not
        replace legal advice, and the wording is subject to review by qualified
        counsel before launch.
      </p>
    </LegalShell>
  );
}
