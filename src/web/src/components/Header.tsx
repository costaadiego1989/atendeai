import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Zap, Gift, Users, CreditCard, HelpCircle, Sparkles } from "lucide-react";
import WhatsAppIcon from "./WhatsAppIcon";
import logo from "@/assets/logo.png";

const WA_LINK = "https://wa.me/5521993001883";

const navItems = [
  { label: "Como funciona", href: "#como-funciona", icon: Zap },
  { label: "Benefícios", href: "#beneficios", icon: Gift },
  { label: "Sobre nós", href: "#sobre", icon: Users },
  { label: "Planos", href: "#planos", icon: CreditCard },
  { label: "FAQ", href: "#faq", icon: HelpCircle },
];

const Header = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "glass-surface shadow-[0_1px_0_hsl(168_100%_36%/0.05)]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2.5 md:flex-none flex-1 justify-center md:justify-start">
          <img src={logo} alt="AtendeAI" className="h-10 w-10 md:h-14 md:w-14" />
          <span className="font-bold text-lg md:text-2xl text-foreground tracking-tight">AtendeAI</span>
        </a>

        <nav className="hidden md:flex items-center gap-5">
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
