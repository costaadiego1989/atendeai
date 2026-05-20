import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MobileFooterNav from "@/components/MobileFooterNav";
import TrialSignupDialog from "@/components/TrialSignupDialog";
import { niches } from "./data/niches";
import NicheHero from "./components/NicheHero";
import NicheStats from "./components/NicheStats";
import NichePains from "./components/NichePains";
import NicheUseCases from "./components/NicheUseCases";
import NicheIntegrations from "./components/NicheIntegrations";
import NicheFAQ from "./components/NicheFAQ";
import NicheCTA from "./components/NicheCTA";

const SolucoesPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [signupOpen, setSignupOpen] = useState(false);

  const niche = niches.find((n) => n.slug === slug);

  useEffect(() => {
    if (!niche) {
      navigate("/", { replace: true });
    }
  }, [niche, navigate]);

  useEffect(() => {
    if (niche) {
      document.title = `${niche.name} — AtendeAI | Atendimento Inteligente`;
    }
    return () => {
      document.title = "AtendeAI";
    };
  }, [niche]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!niche) return null;

  const openSignup = () => setSignupOpen(true);

  return (
    <main className="min-h-screen">
      <Header />
      <NicheHero niche={niche} onSignupClick={openSignup} />
      <NicheStats niche={niche} />
      <NichePains niche={niche} />
      <NicheUseCases niche={niche} />
      <NicheIntegrations niche={niche} />
      <NicheFAQ niche={niche} />
      <NicheCTA niche={niche} onSignupClick={openSignup} />
      <Footer />
      <MobileFooterNav />

      <TrialSignupDialog
        open={signupOpen}
        onOpenChange={setSignupOpen}
        planCode="TRIAL"
      />
    </main>
  );
};

export default SolucoesPage;
