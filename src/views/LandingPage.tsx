import { LandingNav, LandingHero, Bento, HowItWorks, Guardrails, FinalCTA } from "@/features/landing/LandingSections";

export default function LandingPage() {
  return (
    <div className="min-h-full">
      <LandingNav />
      <main>
        <LandingHero />
        <Bento />
        <HowItWorks />
        <Guardrails />
        <FinalCTA />
      </main>
    </div>
  );
}
