import { useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
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
import FinalCTA from "@/components/FinalCTA";
import TrialSignupDialog from "@/components/TrialSignupDialog";

const Index = () => {
  const [signupOpen, setSignupOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("TRIAL");
  const pricingRef = useRef(null);
  const pricingInView = useInView(pricingRef, { once: true, margin: "-100px" });

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

      <section id="pricing" ref={pricingRef} className="py-24 bg-black/95">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col items-start mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              animate={pricingInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl md:text-6xl font-black text-left mb-4 text-white leading-tight tracking-tighter"
            >
              Planos base para operar. <span className="text-gradient-primary">Módulos para crescer</span>.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={pricingInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="text-white/40 text-left text-sm md:text-base max-w-xl"
            >
              Responda algumas perguntas rápidas e receba uma recomendação alinhada ao seu nicho, ao seu momento operacional e aos módulos da sua operação.
            </motion.p>
          </div>

          <motion.div
            id="planos"
            initial={{ opacity: 0, y: 30 }}
            animate={pricingInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="transition-all duration-500"
          >
            <PricingSection onSignupClick={openSignup} hideHeader />
          </motion.div>
        </div>
      </section>

      <SectionDivider />
      <CTASection onSignupClick={() => openSignup("TRIAL")} />
      <SectionDivider flip />
      <FAQSection />
      <FinalCTA onSignupClick={() => openSignup("TRIAL")} />
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
