export const clerkAppearance = {
  variables: {
    colorPrimary: '#1F7A5A',
    colorBackground: 'transparent',
    colorInputBackground: '#F0F5F2',
    colorInputText: '#111827',
    colorText: '#111827',
    colorTextSecondary: '#6B7280',
    borderRadius: '9999px', // pill inputs + buttons
    fontFamily: 'var(--font-sans)',
    fontSize: '15px',
  },
  elements: {
    rootBox: {
      width: '100%',
    },
    cardBox: {
      background: 'transparent',
      boxShadow: 'none',
      border: 'none',
      width: '100%',
    },
    card: {
      background: 'transparent',
      boxShadow: 'none',
      border: 'none',
      padding: '0',
      width: '100%',
    },
    headerTitle: { display: 'none' },
    headerSubtitle: { display: 'none' },
    formButtonPrimary: {
      borderRadius: '9999px',
      fontWeight: '600',
      fontSize: '15px',
      padding: '12px 16px',
    },
    formFieldInput: {
      borderRadius: '9999px',
      paddingLeft: '48px', // room for icon prefix
      border: '1.5px solid #E5E7EB',
      background: '#F0F5F2',
      minHeight: '48px',
    },
    formFieldInputShowPasswordButton: { right: '12px' },
    socialButtonsBlockButton: {
      borderRadius: '9999px',
      width: '48px',
      height: '48px',
      border: '1.5px solid #E5E7EB',
      padding: '0',
      justifyContent: 'center',
    },
    socialButtonsBlockButtonText: { display: 'none' }, // icon-only
    dividerLine: { background: '#E5E7EB' },
    dividerText: { color: '#9CA3AF' },
    footerActionLink: { color: '#1F7A5A', fontWeight: '600' },
    footerAction: { display: 'flex', justifyContent: 'center', width: '100%' },
    footer: { paddingBottom: '0' },
    
    // Icons injected via CSS backgrounds
    formFieldInput__identifier: {
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='20' height='16' x='2' y='4' rx='2'/%3E%3Cpath d='m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: '16px center',
      backgroundSize: '20px 20px',
    },
    formFieldInput__emailAddress: {
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='20' height='16' x='2' y='4' rx='2'/%3E%3Cpath d='m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: '16px center',
      backgroundSize: '20px 20px',
    },
    formFieldInput__password: {
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='18' height='11' x='3' y='11' rx='2' ry='2'/%3E%3Cpath d='M7 11V7a5 5 0 0 1 10 0v4'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: '16px center',
      backgroundSize: '20px 20px',
    },

    // Phone field hides (SMS not production-ready)
    phoneNumberField: { display: 'none' },
    alternativeMethodsBlockButton__phoneCode: { display: 'none' },
    formFieldInput__phoneNumber: { display: 'none' },
    phoneInputBox: { display: 'none' },
  },
};
