import { Hero } from '@/components/marketing/sections/Hero';
import { Problem } from '@/components/marketing/sections/Problem';
import { Industries } from '@/components/marketing/sections/Industries';
import { Features } from '@/components/marketing/sections/Features';
import { HowItWorks } from '@/components/marketing/sections/HowItWorks';
import { Pricing } from '@/components/marketing/sections/Pricing';
import { FAQ } from '@/components/marketing/sections/FAQ';
import { FinalCTA } from '@/components/marketing/sections/FinalCTA';
import { Footer } from '@/components/marketing/sections/Footer';
import { SiteJsonLd } from '@/components/marketing/SiteJsonLd';
import { AnalyticsBeacon } from '@/components/marketing/AnalyticsBeacon';

export default function LandingPage() {
  return (
    <>
      <SiteJsonLd />
      <AnalyticsBeacon />

      {/* Full-bleed hero and problem sections flow into each other. */}
      <Hero />
      <Problem />

      {/* Inset card sections sit on the canvas with tight uniform gaps. */}
      <div className="mk-stack pb-3 pt-3 md:pb-4 md:pt-4">
        <Industries />
        <Features />
        <HowItWorks />
        {/* Product demo section is omitted until a real recording exists. */}
        <Pricing />
        <FAQ />
        <FinalCTA />
        <Footer />
      </div>
    </>
  );
}
