/**
 * Landing page copy. All human-editable text lives here so components stay
 * presentational (`hisaflow-landing-visual-spec.md` Section 10.6).
 *
 * Direction comes from `hisaflow-landing-page.md` Section 3. This is a working
 * draft pending a human copy edit before launch.
 */

export const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Industries', href: '#industries' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
] as const;

export const HERO = {
  announcement: {
    chip: 'Early access',
    text: 'Built in Kenya for Kenyan businesses',
    href: '#industries',
  },
  headline: 'Run your shop, guest house or ISP from one app.',
  subheadline:
    'Inventory, billing and daily operations for Kenyan small businesses, built to work with M-Pesa.',
  primaryCta: 'Start free trial',
  secondaryCta: 'See how it works',
  microcopy: '14-day free trial · No card needed.',
} as const;

export interface HeroRailItem {
  id: 'mpesa' | 'kra' | 'card';
  label: string;
  title: string;
  description: string;
  /** Rendered as a warm chip when the capability is not live yet. */
  comingSoonLabel?: string;
}

/** Rotating capability rail beside the hero device. */
export const HERO_RAIL: HeroRailItem[] = [
  {
    id: 'mpesa',
    label: 'M-Pesa',
    title: 'Pay by M-Pesa, matched to the sale',
    description:
      'Every M-Pesa payment is recorded against the sale it belongs to, so reconciliation is not a manual job.',
  },
  {
    id: 'kra',
    label: 'KRA',
    title: 'Tax handled as you sell',
    description:
      'VAT is calculated on every sale and the records stay ready for filing.',
    comingSoonLabel: 'eTIMS filing coming soon',
  },
  {
    id: 'card',
    label: 'Card',
    title: 'Card payments, receipted',
    description:
      'Card sales settle through Paystack and land in the same daily totals as M-Pesa and cash.',
  },
];

export const HERO_AI = {
  title: 'AI that does the admin',
  description:
    'Describe a delivery in a sentence, snap a supplier receipt, or ask what to reorder. HisaFlow AI records it and keeps your books current, so data entry takes minutes.',
  points: [
    'Add stock in plain language',
    'Read receipts and labels',
    'See what needs attention',
  ],
} as const;

export const BUILT_FOR = {
  caption: 'Built for Kenyan businesses of every size',
  verticals: ['Shops', 'Guest houses', 'ISPs', 'Schools'],
} as const;

export interface ProblemCard {
  id: 'stock' | 'payments' | 'tax' | 'admin';
  /** Visual treatment in the bento grid. No two tiles share a colour. */
  tone: 'surface' | 'accent' | 'ink' | 'blue';
  /** The pain, shown small above the fix. */
  problem: string;
  /** How HisaFlow fixes it. */
  title: string;
  description: string;
  chips?: string[];
  footer?: string;
  claimKey?: 'taxEtims' | 'mpesaPayments';
}

export const PROBLEM: {
  eyebrow: string;
  headline: string;
  intro: string;
  resolution: string;
  cta: string;
  cards: ProblemCard[];
} = {
  eyebrow: 'The problem',
  headline: 'Notebooks, WhatsApp and guesswork cost you money.',
  intro:
    'Stock is tracked in a notebook, M-Pesa messages are matched by hand, bookings live in chat and customers get cut off one by one.',
  resolution:
    'HisaFlow keeps stock, sales, payments and bookings in one place, so the numbers are already there when you need them.',
  cta: 'Start free trial',
  cards: [
    {
      id: 'stock',
      tone: 'surface',
      problem: 'Stock runs out unnoticed',
      title: 'Know what is low before a customer asks',
      description: 'Low-stock alerts show what to reorder today.',
    },
    {
      id: 'payments',
      tone: 'accent',
      problem: 'M-Pesa matched by hand',
      title: 'Every payment matched to its sale',
      description: 'M-Pesa, cash and card land in one daily total.',
      chips: ['M-Pesa', 'Cash', 'Card'],
    },
    {
      id: 'tax',
      tone: 'blue',
      problem: 'Tax left to month-end',
      title: 'VAT worked out as you sell',
      description: 'Tax is calculated on every sale and the records stay ready.',
      claimKey: 'taxEtims',
      footer: 'eTIMS filing coming soon',
    },
    {
      id: 'admin',
      tone: 'ink',
      problem: 'Bookings lost in chat',
      title: 'One calendar for rooms and payments',
      description: 'Rooms, guests and payments stay in sync.',
    },
  ],
};

export const INDUSTRIES_SECTION = {
  eyebrow: 'Vertical specific',
  headlineBefore: 'Built for how your ',
  headlineAfter: ' business actually works.',
  intro:
    'Pick your business type and HisaFlow shows the tools that fit, from a duka counter to a guest-house reception.',
} as const;

export interface Industry {
  id: string;
  name: string;
  pain: string;
  outcome: string;
  /** Two honest capability labels shown as glass chips on the visual card. */
  mediaTags: [string, string];
  /** Shipped module label for the pill on the feature card. */
  moduleTag: string;
  claimKey: 'shops' | 'guestHouses' | 'isps' | 'schools';
}

export const INDUSTRIES: Industry[] = [
  {
    id: 'shops',
    name: 'Shops & dukas',
    pain: 'Stock runs out before you notice.',
    outcome: 'See what is low and what to reorder, before a customer asks.',
    mediaTags: ['Low stock alerts', 'Reorder today'],
    moduleTag: 'Inventory & sales',
    claimKey: 'shops',
  },
  {
    id: 'guest-houses',
    name: 'Guest houses',
    pain: 'Rooms are booked on WhatsApp and double-booked.',
    outcome: 'One booking calendar with rooms, guests and payments in sync.',
    mediaTags: ['Room calendar', 'Check-in and out'],
    moduleTag: 'Bookings & guests',
    claimKey: 'guestHouses',
  },
  {
    id: 'isps',
    name: 'ISPs',
    pain: 'Subscribers are cut off one by one, by hand.',
    outcome: 'Service plans, router assignments and renewals in one view.',
    mediaTags: ['Router assignments', 'Renewals'],
    moduleTag: 'Subscribers & plans',
    claimKey: 'isps',
  },
  {
    id: 'schools',
    name: 'Schools',
    pain: 'Fees, classes and student records live in separate files.',
    outcome: 'Students, classes and fee balances tracked together.',
    mediaTags: ['Fee balances', 'Classes & students'],
    moduleTag: 'Students & fees',
    claimKey: 'schools',
  },
];

export interface Feature {
  id: string;
  title: string;
  description: string;
  claimKey?: 'taxEtims' | 'mpesaPayments';
}

export const FEATURES = {
  eyebrow: 'Hustle free',
  headlineBefore: 'Scan a barcode, snap a label, let ',
  headlineChip: 'AI',
  headlineAfter: ' do the rest.',
  intro:
    'Barcode and label scanning, receipt capture and plain-language entry all feed the same inventory. You review what the AI proposes before anything changes.',
  items: [
    {
      id: 'barcode',
      title: 'Scan a barcode, find the item',
      description: 'Look up stock or add a new item straight from the shelf.',
    },
    {
      id: 'label',
      title: 'Snap a label, skip the typing',
      description: 'The camera reads the name, category and expiry date.',
    },
    {
      id: 'receipt',
      title: 'Photograph a receipt, post the stock',
      description:
        'AI turns a supplier receipt into purchase entries you confirm.',
    },
  ] satisfies Feature[],
} as const;

export const HOW_IT_WORKS = {
  eyebrow: 'How it works',
  headlineBefore: 'From sign-up to your first ',
  headlineChip: 'sale',
  headlineAfter: ' in minutes.',
  intro: 'Three steps, no training needed, and no card to start.',
  steps: [
    {
      id: 'account',
      title: 'Create your account',
      description: 'Sign up with your email and phone number.',
      chips: ['2 minutes', 'No card needed'],
    },
    {
      id: 'business',
      title: 'Tell us about your business',
      description: 'Choose your business type so the right tools appear.',
      chips: ['Shops', 'Guest houses', 'ISPs', 'Schools'],
    },
    {
      id: 'sale',
      title: 'Record your first sale',
      description: 'Add stock, sell, and watch the numbers update.',
      chips: ['Receipt every sale'],
    },
  ],
} as const;

export const PRICING = {
  eyebrow: 'Pricing',
  headline: 'Simple monthly pricing in KES.',
  intro:
    'Start with a 14-day free trial. Pay with M-Pesa or card when you are ready.',
  microcopy: '14-day free trial · No credit card required · Cancel anytime.',
  paymentNote:
    'M-Pesa renewals need an approval on your phone each month. Card renews automatically.',
  recommendedTier: 'TEAM',
  growthCta: 'Contact us on WhatsApp',
} as const;

export interface FaqItem {
  question: string;
  answer: string;
  claimKey?: 'taxEtims' | 'mpesaPayments';
}

export const FAQ = {
  eyebrow: 'FAQ',
  headline: 'Questions, answered honestly.',
  whatsappNote: 'Still unsure? Ask us on WhatsApp.',
  items: [
    {
      question: 'Do I need a card to start?',
      answer:
        'No. You get a 14-day free trial with full Team access and no card required.',
    },
    {
      question: 'How do I pay, and how does M-Pesa renewal work?',
      answer:
        'You can pay by M-Pesa or card. M-Pesa sends an approval prompt to your phone each billing cycle. A card renews automatically.',
      claimKey: 'mpesaPayments',
    },
    {
      question: 'What happens when my trial ends?',
      answer:
        'Choose a plan to keep going. If a renewal does not go through, there is a grace period before anything is locked, so you are not cut off instantly.',
    },
    {
      question: 'Does it work offline or on poor internet?',
      answer:
        'HisaFlow needs an internet connection today. Offline support is on our roadmap and is not something we claim yet.',
    },
    {
      question: 'Is my data safe, and who can see it?',
      answer:
        'Your data belongs to your organization. Staff only see the organization they belong to, and you control what each staff role can access.',
    },
    {
      question: 'Can I add staff?',
      answer:
        'Yes. The Team plan includes up to three staff logins with role-based permissions.',
    },
    {
      question: 'Does it handle KRA tax invoicing (eTIMS)?',
      answer:
        'Tax compliance is coming soon. We will only state that eTIMS filing is available once it is live and verified.',
      claimKey: 'taxEtims',
    },
    {
      question: 'Can I switch plans or cancel?',
      answer:
        'Yes. Upgrades take effect immediately and downgrades apply at your next renewal. You can cancel anytime.',
    },
  ] satisfies FaqItem[],
} as const;

export const FINAL_CTA = {
  headline: 'Ready to run your business from one app?',
  subline: 'Start your 14-day free trial. No card needed.',
  primaryCta: 'Start free trial',
  secondaryCta: 'Chat on WhatsApp',
} as const;

export const FOOTER = {
  columns: [
    {
      title: 'Product',
      links: [
        { label: 'How it works', href: '#how-it-works' },
        { label: 'Features', href: '#features' },
        { label: 'Pricing', href: '#pricing' },
      ],
    },
    {
      title: 'Industries',
      links: [
        { label: 'Shops & dukas', href: '#industries' },
        { label: 'Guest houses', href: '#industries' },
        { label: 'ISPs', href: '#industries' },
        { label: 'Schools', href: '#industries' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'FAQ', href: '#faq' },
        { label: 'Contact', href: '#final-cta' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy Policy', href: '/legal/privacy' },
        { label: 'Terms of Service', href: '/legal/terms' },
      ],
    },
  ],
} as const;
