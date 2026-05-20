import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Zap,
  Gift,
  Users,
  CreditCard,
  HelpCircle,
  Sparkles,
  ChevronDown,
  Stethoscope,
  Building2,
  ShoppingBag,
  Briefcase,
  Scale,
  GraduationCap,
  CalendarCheck,
} from "lucide-react";
import logo from "@/assets/logo.png";

const WA_LINK = "https://wa.me/5521993001883";
const MEETING_LINK = "https://wa.me/5521993001883?text=Ol%C3%A1%2C%20gostaria%20de%20agendar%20uma%20reuni%C3%A3o%20para%20conhecer%20o%20AtendeAI";

const navItems = [
  { label: "Como funciona", href: "#como-funciona", icon: Zap },
  { label: "Benefícios", href: "#beneficios", icon: Gift },
  { label: "Sobre a plataforma", href: "#sobre", icon: Users },
  { label: "Planos", href: "#planos", icon: CreditCard },
  { label: "FAQ", href: "#faq", icon: HelpCircle },
];

const solucoesItems = [
  { label: "Clínicas e Saúde", slug: "clinicas-saude", icon: Stethoscope },
  { label: "Imobiliárias", slug: "imobiliarias", icon: Building2 },
  { label: "Ecommerce", slug: "ecommerce", icon: ShoppingBag },
  { label: "Serviços B2B", slug: "servicos-b2b", icon: Briefcase },
  { label: "Advocacia", slug: "advocacia", icon: Scale },
  { label: "Educação", slug: "educacao", icon: GraduationCap },
];

const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [solucoesOpen, setSolucoesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSolucoesOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "glass-surface shadow-[0_1px_0_hsl(168_100%_36%/0.15),0_4px_12px_-4px_hsl(168_100%_36%/0.12)]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5 md:flex-none flex-1 justify-center md:justify-start">
          <img src={logo} alt="AtendeAI" className="h-10 w-10 md:h-14 md:w-14" />
          <span className="font-bold text-lg md:text-2xl text-foreground tracking-tight">AtendeAI</span>
        </a>

        <nav className="hidden md:flex items-center gap-5">
          {/* Soluções dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setSolucoesOpen(!solucoesOpen)}
              onMouseEnter={() => setSolucoesOpen(true)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
            >
              <Zap className="w-3.5 h-3.5" />
              Soluções
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${solucoesOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {solucoesOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  onMouseLeave={() => setSolucoesOpen(false)}
                  className="absolute top-full left-0 mt-2 w-56 py-2 rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl"
                >
                  {solucoesItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.slug}
                        to={`/solucoes/${item.slug}`}
                        onClick={() => setSolucoesOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-colors"
                      >
                        <Icon className="w-4 h-4 text-primary/70" />
                        {item.label}
                      </Link>
                    );
                  })}
                  <div className="border-t border-border/40 my-1.5" />
                  <a
                    href={MEETING_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSolucoesOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-primary font-medium hover:bg-primary/5 transition-colors"
                  >
                    <CalendarCheck className="w-4 h-4 text-primary" />
                    Agendar reunião
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </a>
            );
          })}
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-5 bg-primary text-primary-foreground font-semibold rounded-lg text-sm inline-flex items-center gap-2 hover:shadow-[var(--shadow-glow)] transition-all duration-300"
          >
            <Sparkles className="w-3.5 h-3.5" />
            7 dias grátis
          </a>
        </nav>
      </div>
    </motion.header>
  );
};

export default Header;
