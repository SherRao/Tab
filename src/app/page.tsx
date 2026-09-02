import { getSessionUser } from "@/lib/auth";
import { LandingHeader } from "@/components/marketing/landing-header";
import { HeroSection } from "@/components/marketing/hero-section";
import { ReceiptStack } from "@/components/marketing/receipt-stack";
import { FeatureList } from "@/components/marketing/feature-list";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { LandingFooter } from "@/components/marketing/landing-footer";

export default async function HomePage() {
  const viewer = await getSessionUser();
  return (
    <main className="flex-1">
      {/* header */}
      <LandingHeader viewerSignedIn={viewer != null} />

      {/* hero */}
      <section className="mx-auto grid w-full max-w-6xl gap-12 px-6 pt-10 pb-20 lg:grid-cols-12 lg:gap-8 lg:pt-16">
        <HeroSection viewerSignedIn={viewer != null} />
        <ReceiptStack />
      </section>

      {/* features */}
      <FeatureList />

      {/* how it works */}
      <HowItWorks />

      <LandingFooter />
    </main>
  );
}
