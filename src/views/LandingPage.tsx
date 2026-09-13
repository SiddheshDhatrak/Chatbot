import { LandingNav, LandingHero, LogoMarquee, Bento, Pricing, Testimonials, FinalCTA } from "@/features/landing/LandingSections";

export default function LandingPage() {
  return (
    <div className="min-h-full">
      <LandingNav />
      <main>
        <LandingHero />
        <LogoMarquee />
        <Bento />
        <Testimonials />
        <Pricing />
        <FinalCTA />
      </main>
    </div>
  );
}
