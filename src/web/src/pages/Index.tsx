import { useState } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import StatsSection from "@/components/StatsSection";
import FeatureShowcase from "@/components/FeatureShowcase";
import PlatformSection from "@/components/PlatformSection";
import HowItWorks from "@/components/HowItWorks";
import BenefitsSection from "@/components/BenefitsSection";
import AboutSection from "@/components/AboutSection";
import PricingSection from "@/components/PricingSection";
import CTASection from "@/components/CTASection";
import FAQSection from "@/components/FAQSection";
import Footer from "@/components/Footer";
import MobileFooterNav from "@/components/MobileFooterNav";
import SectionDivider from "@/components/SectionDivider";
import TrialSignupDialog from "@/components/TrialSignupDialog";

const Index = () => {
  const [signupOpen, setSignupOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("TRIAL");

  const openSignup = (plan = "TRIAL") => {
    setSelectedPlan(plan);
    setSignupOpen(true);
  };

  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <StatsSection />
      <FeatureShowcase />
      <SectionDivider />
      <PlatformSection />
      <HowItWorks />
      <SectionDivider flip />
      <BenefitsSection />
      <SectionDivider />
      <AboutSection />
      <SectionDivider flip />

      <section id="pricing" className="py-24 bg-black/95">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center mb-16">
            <h2 className="text-4xl md:text-6xl font-black text-center mb-4 text-white leading-tight tracking-tighter">
              Planos base para operar. <span className="text-gradient-primary">Módulos para crescer</span>.
            </h2>
            <p className="text-white/40 text-center text-sm md:text-base max-w-xl">
              Responda algumas perguntas rápidas e receba uma recomendação alinhada ao seu nicho, ao seu momento operacional e aos módulos da sua operação.
            </p>
          </div>

          <div id="planos" className="transition-all duration-500">
            <PricingSection onSignupClick={openSignup} hideHeader />
          </div>
        </div>
      </section>

      <SectionDivider />
      <CTASection onSignupClick={() => openSignup("TRIAL")} />
      <SectionDivider flip />
      <FAQSection />
      <Footer />
      <MobileFooterNav />

      <TrialSignupDialog
        open={signupOpen}
        onOpenChange={setSignupOpen}
        planCode={selectedPlan}
      />
    </main>
  );
};

export default Index;
