import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg-base)] p-4">
      <SignIn
        appearance={{
          elements: {
            // ── Phone / SMS auth — muted until SMS is production-ready ──────────
            // To re-enable: remove the four lines below and enable phone
            // number auth in the Clerk Dashboard (User & Auth → Email, Phone…)
            phoneNumberField:                        { display: 'none' },
            alternativeMethodsBlockButton__phoneCode: { display: 'none' },
            formFieldInput__phoneNumber:              { display: 'none' },
            phoneInputBox:                           { display: 'none' },
            // ────────────────────────────────────────────────────────────────────
          },
        }}
      />
    </main>
  )
}
